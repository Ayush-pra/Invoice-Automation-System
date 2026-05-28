import { google } from 'googleapis';
import config from '../../config/index.js';
import BaseInvoiceProvider from './base.provider.js';
import { decrypt } from '../../utils/encryption.js';

/**
 * Gmail invoice provider.
 * Searches Gmail for invoice-related emails with PDF attachments.
 */
class GmailProvider extends BaseInvoiceProvider {
  constructor() {
    super();
    this.gmail = null;
    this.oauth2Client = null;

    // Keywords that indicate an invoice-related email
    this.invoiceKeywords = [
      'invoice',
      'receipt',
      'billing',
      'payment',
      'subscription',
      'statement',
      'order confirmation',
    ];
  }

  /**
   * Create an authenticated Gmail client from integration tokens.
   */
  async connect(integration) {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    // Get decrypted tokens
    const integrationObj = integration.toObject({ getters: true });

    this.oauth2Client.setCredentials({
      access_token: integrationObj.accessToken,
      refresh_token: integrationObj.refreshToken,
      expiry_date: integration.tokenExpiry
        ? integration.tokenExpiry.getTime()
        : null,
    });

    // Handle automatic token refresh
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
   * Fetch invoice emails with PDF attachments from Gmail.
   * @returns {Array<Object>} Array of invoice data objects.
   */
  async fetchInvoices(integration, options = {}) {
    const { existingMessageIds = new Set() } = options;

    if (!this.gmail) {
      await this.connect(integration);
    }

    // Build Gmail search query
    const keywordQuery = this.invoiceKeywords
      .map((k) => `"${k}"`)
      .join(' OR ');
    const query = `has:attachment filename:pdf newer_than:90d (${keywordQuery})`;

    console.log(`📧 Searching Gmail with query: ${query}`);

    // Fetch message IDs matching query
    const messageIds = await this._listMessages(query);
    console.log(`📧 Found ${messageIds.length} matching messages`);

    const invoiceResults = [];

    for (const messageId of messageIds) {
      // Skip if already imported
      if (existingMessageIds.has(messageId)) {
        continue;
      }

      try {
        const invoiceData = await this._processMessage(messageId);
        if (invoiceData) {
          invoiceResults.push(invoiceData);
        }
      } catch (error) {
        console.error(
          `⚠️  Failed to process message ${messageId}:`,
          error.message
        );
        // Continue processing other messages
      }
    }

    return invoiceResults;
  }

  /**
   * List all message IDs matching the search query.
   * Handles pagination automatically.
   */
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

  /**
   * Process a single Gmail message.
   * Extracts metadata and PDF attachments.
   */
  async _processMessage(messageId) {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = this._parseHeaders(message.payload.headers);
    const vendorName = this._extractVendorName(headers.from);
    const emailDate = headers.date ? new Date(headers.date) : new Date();

    // Find PDF attachments
    const pdfAttachments = this._findPdfAttachments(message.payload);

    if (pdfAttachments.length === 0) {
      return null;
    }

    // Download each PDF attachment
    const attachments = [];
    for (const attachment of pdfAttachments) {
      try {
        const attachmentData = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachment.attachmentId,
        });

        // Gmail returns base64url-encoded data
        const buffer = Buffer.from(attachmentData.data.data, 'base64');

        attachments.push({
          attachmentId: attachment.attachmentId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          data: buffer,
          size: attachment.size,
        });
      } catch (error) {
        console.error(
          `⚠️  Failed to download attachment ${attachment.fileName}:`,
          error.message
        );
      }
    }

    if (attachments.length === 0) {
      return null;
    }

    return {
      messageId,
      vendorName,
      emailSubject: headers.subject || 'No Subject',
      emailFrom: headers.from || 'Unknown',
      emailDate,
      attachments,
    };
  }

  /**
   * Parse email headers into a key-value object.
   */
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

  /**
   * Extract vendor name from email sender.
   * Example: "OpenAI <billing@openai.com>" → "OpenAI"
   * Example: "billing@openai.com" → "OpenAI"
   */
  _extractVendorName(from) {
    if (!from) return 'Unknown';

    // Try to extract display name: "Display Name <email>"
    const displayNameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (displayNameMatch) {
      return displayNameMatch[1].trim();
    }

    // Fall back to domain name from email
    const emailMatch = from.match(/@([^.>]+)/);
    if (emailMatch) {
      // Capitalize first letter
      const domain = emailMatch[1];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }

    return from.trim();
  }

  /**
   * Recursively find PDF attachments in message payload.
   * Handles multipart messages.
   */
  _findPdfAttachments(payload, results = []) {
    if (payload.mimeType === 'application/pdf' && payload.body?.attachmentId) {
      results.push({
        attachmentId: payload.body.attachmentId,
        fileName: payload.filename || 'invoice.pdf',
        mimeType: payload.mimeType,
        size: payload.body.size || 0,
      });
    }

    // Recursively check parts (for multipart messages)
    if (payload.parts) {
      for (const part of payload.parts) {
        this._findPdfAttachments(part, results);
      }
    }

    return results;
  }
}

export default GmailProvider;
