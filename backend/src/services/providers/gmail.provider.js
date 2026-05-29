import { google } from 'googleapis';
import config from '../../config/index.js';
import BaseInvoiceProvider from './base.provider.js';
import qualificationService from '../invoice/qualification.service.js';

/**
 * Gmail Billing Provider (Deterministic Billing Collection)
 * 
 * Scans Gmail for billing emails from selected vendors.
 * Uses deterministic qualification: Amount (mandatory) + Positive Billing Indicator.
 */
class GmailProvider extends BaseInvoiceProvider {
  constructor() {
    super();
    this.gmail = null;
    this.oauth2Client = null;
  }

  async connect(integration) {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    const integrationObj = integration.toObject({ getters: true });

    this.oauth2Client.setCredentials({
      access_token: integrationObj.accessToken,
      refresh_token: integrationObj.refreshToken,
      expiry_date: integration.tokenExpiry
        ? integration.tokenExpiry.getTime()
        : null,
    });

    this.oauth2Client.on('tokens', async (tokens) => {
      console.log('🔄 Gmail tokens refreshed');
      if (tokens.access_token) {
        integration.accessToken = tokens.access_token;
      }
      if (tokens.refresh_token) {
        integration.refreshToken = tokens.refresh_token;
      }
      if (tokens.expiry_date) {
        integration.tokenExpiry = new Date(tokens.expiry_date);
      }
      await integration.save();
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Fetch billing records based on specific vendors.
   */
  async fetchInvoices(integration, options = {}) {
    const {
      vendors = [],
      existingMessageIds = new Set(),
      scanDurationDays = 90,
    } = options;

    if (!this.gmail) {
      await this.connect(integration);
    }

    const allInvoices = [];
    const debugStats = [];
    
    // Track message IDs processed in this run to avoid processing the same email for multiple vendors
    const processedInThisRun = new Set();

    for (const vendor of vendors) {
      const vendorStats = {
        vendor: vendor.name,
        vendorId: vendor._id.toString(),
        emailsFound: 0,
        invoicesImported: 0,
        ignored: 0,
        rejectionReasons: {},
      };

      if (!vendor.domains || vendor.domains.length === 0) {
        debugStats.push(vendorStats);
        continue;
      }

      // Generate query for this vendor
      const domainQuery = vendor.domains.map(d => `from:(${d})`).join(' OR ');
      const query = `newer_than:${scanDurationDays}d (${domainQuery})`;

      console.log(`📧 Searching Gmail for [${vendor.name}]: ${query}`);

      const messageIds = await this._listMessages(query);
      vendorStats.emailsFound = messageIds.length;

      for (const messageId of messageIds) {
        if (existingMessageIds.has(messageId) || processedInThisRun.has(messageId)) {
          vendorStats.ignored++;
          continue;
        }

        try {
          const processResult = await this._processMessage(messageId, vendor);

          if (processResult.qualified) {
            allInvoices.push(processResult.invoiceData);
            vendorStats.invoicesImported++;
            processedInThisRun.add(messageId);
          } else {
            vendorStats.ignored++;
            const reason = processResult.reason || 'Unknown';
            vendorStats.rejectionReasons[reason] = (vendorStats.rejectionReasons[reason] || 0) + 1;
          }
        } catch (error) {
          console.error(`⚠️ Failed to process message ${messageId}:`, error.message);
          vendorStats.ignored++;
          vendorStats.rejectionReasons['Error: ' + error.message] = (vendorStats.rejectionReasons['Error: ' + error.message] || 0) + 1;
        }
      }

      // Print debug stats for this vendor
      console.log(`\n📊 Vendor: ${vendor.name}`);
      console.log(`Emails Scanned: ${vendorStats.emailsFound}`);
      console.log(`Rejected: ${vendorStats.ignored}`);
      if (Object.keys(vendorStats.rejectionReasons).length > 0) {
        console.log(`Reasons:`);
        for (const [reason, count] of Object.entries(vendorStats.rejectionReasons)) {
          console.log(`  - ${reason} (${count})`);
        }
      }
      console.log(`Qualified: ${vendorStats.invoicesImported}\n`);

      debugStats.push(vendorStats);
    }

    return {
      invoices: allInvoices,
      stats: debugStats,
    };
  }

  async _listMessages(query) {
    const messageIds = [];
    let pageToken = null;

    do {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        pageToken,
      });

      if (response.data.messages) {
        messageIds.push(...response.data.messages.map((m) => m.id));
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    return messageIds;
  }

  async _processMessage(messageId, vendor) {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = this._parseHeaders(message.payload.headers);
    const emailSubject = headers.subject || '';
    const emailFrom = headers.from || '';
    const emailDate = headers.date ? new Date(headers.date) : new Date();

    // Find PDF attachments
    const pdfAttachments = this._findPdfAttachments(message.payload);

    // Extract body for link parsing and data extraction
    const bodyText = this._extractBody(message.payload);
    const invoiceLink = this._extractInvoiceLink(bodyText);

    // --- Deterministic Qualification ---
    const qualification = qualificationService.qualifyEmail(
      emailSubject,
      message.snippet,
      bodyText,
      pdfAttachments.length > 0,
      !!invoiceLink
    );

    if (!qualification.qualified) {
      return { qualified: false, reason: qualification.reason };
    }

    // --- Extract All Billing Fields ---
    const identifiers = qualificationService.extractIdentifiers(emailSubject, message.snippet, bodyText);
    const billingPeriod = qualificationService.extractBillingPeriod(emailSubject, message.snippet);
    const { subscriptionName, membershipName } = qualificationService.extractSubscriptionInfo(emailSubject, message.snippet);
    const paymentMethod = qualificationService.extractPaymentMethod(bodyText);
    const productName = qualificationService.extractProductName(emailSubject, message.snippet, bodyText);
    const lineItems = qualificationService.extractLineItems(bodyText);

    // Download PDFs
    const attachments = [];
    for (const attachment of pdfAttachments) {
      try {
        const attachmentData = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachment.attachmentId,
        });

        const buffer = Buffer.from(attachmentData.data.data, 'base64');

        attachments.push({
          attachmentId: attachment.attachmentId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          data: buffer,
          size: attachment.size,
        });
      } catch (error) {
        console.error(`⚠️ Failed to download attachment ${attachment.fileName}:`, error.message);
      }
    }

    return {
      qualified: true,
      invoiceData: {
        messageId,
        vendorId: vendor._id,
        vendorName: vendor.name,
        emailSubject,
        emailFrom,
        emailDate,
        snippet: message.snippet,
        attachments,
        // Extracted data
        recordType: qualification.recordType,
        amount: qualification.amount,
        currency: qualification.currency,
        identifiers,
        productName,
        lineItems,
        billingPeriod,
        subscriptionName,
        membershipName,
        paymentMethod,
        invoiceLink,
      },
    };
  }

  _extractBody(payload) {
    let body = '';
    if (payload.body && payload.body.data) {
      body += Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        body += this._extractBody(part);
      }
    }
    return body;
  }

  _extractInvoiceLink(bodyText) {
    // Look for invoice/receipt/billing links
    const match = bodyText.match(
      /(?:href=|"|')(https?:\/\/[^\s"'<>]+?(?:invoice|receipt|billing|download)[^\s"'<>]*)(?:"|'|>)/i
    );
    return match ? match[1] : null;
  }

  _parseHeaders(headers) {
    const result = {};
    const targetHeaders = ['from', 'to', 'subject', 'date'];

    for (const header of headers) {
      const name = header.name.toLowerCase();
      if (targetHeaders.includes(name)) {
        result[name] = header.value;
      }
    }

    return result;
  }

  _findPdfAttachments(payload, results = []) {
    if (payload.mimeType === 'application/pdf' && payload.body?.attachmentId) {
      results.push({
        attachmentId: payload.body.attachmentId,
        fileName: payload.filename || 'invoice.pdf',
        mimeType: payload.mimeType,
        size: payload.body.size || 0,
      });
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        this._findPdfAttachments(part, results);
      }
    }

    return results;
  }
}

export default GmailProvider;
