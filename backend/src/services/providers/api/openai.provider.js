import BaseApiProvider from './baseApi.provider.js';
import axios from 'axios';

class OpenAIProvider extends BaseApiProvider {
  /**
   * Since there is no public API endpoint for OpenAI invoices via personal API keys, 
   * this is a mocked structural implementation that would use Stripe's customer API 
   * or a private OpenAI billing endpoint in a real scenario.
   * 
   * Assuming a real endpoint exists: GET https://api.openai.com/v1/billing/invoices
   */
  async fetchBillingRecords(credentials, options = {}) {
    const { apiKey } = credentials;

    if (!apiKey) {
      throw new Error('Missing OpenAI API Key');
    }

    try {
      // Example real API call if OpenAI exposed this directly:
      const response = await axios.get('https://api.openai.com/v1/organization/billing/invoices', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      });

      const invoices = response.data.data || [];
      const records = [];

      for (const invoice of invoices) {
        // Skip if outside scan window
        if (options.scanDurationDays) {
          const daysOld = (Date.now() - (invoice.created * 1000)) / (1000 * 60 * 60 * 24);
          if (daysOld > options.scanDurationDays) continue;
        }

        records.push(
          this.createBillingRecord({
            vendorName: 'OpenAI',
            amount: invoice.amount_due / 100, // Assuming cents
            currency: invoice.currency.toUpperCase(),
            billingDate: new Date(invoice.created * 1000),
            invoiceNumber: invoice.number,
            transactionId: invoice.id,
            invoiceLink: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf, // URL to download PDF
            invoiceAvailability: invoice.invoice_pdf ? 'PDF' : 'LINK',
            rawData: invoice,
          })
        );
      }

      return records;

    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('Invalid OpenAI API Key');
      }
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  }
}

export default OpenAIProvider;
