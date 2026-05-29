import BaseApiProvider from './baseApi.provider.js';
import axios from 'axios';

class CloudflareProvider extends BaseApiProvider {
  /**
   * Cloudflare doesn't have a direct "list invoices" endpoint in v4 API that is widely documented,
   * but usually it would be an enterprise billing endpoint.
   * We will implement the structural request to the Cloudflare API.
   * Assuming a GET request to https://api.cloudflare.com/client/v4/user/billing/history
   */
  async fetchBillingRecords(credentials, options = {}) {
    const { apiToken } = credentials;

    if (!apiToken) {
      throw new Error('Missing Cloudflare API Token');
    }

    try {
      const response = await axios.get('https://api.cloudflare.com/client/v4/user/billing/history', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const invoices = response.data.result || [];
      const records = [];

      for (const invoice of invoices) {
        if (options.scanDurationDays) {
          const daysOld = (Date.now() - new Date(invoice.date).getTime()) / (1000 * 60 * 60 * 24);
          if (daysOld > options.scanDurationDays) continue;
        }

        records.push(
          this.createBillingRecord({
            vendorName: 'Cloudflare',
            amount: parseFloat(invoice.amount),
            currency: invoice.currency || 'USD',
            billingDate: new Date(invoice.date),
            invoiceNumber: invoice.id,
            transactionId: invoice.transaction_id,
            invoicePdf: null, 
            invoiceLink: null,
            invoiceAvailability: 'JSON_ONLY',
            rawData: invoice,
          })
        );
      }

      return records;

    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('Invalid Cloudflare API Token');
      }
      throw new Error(`Cloudflare API Error: ${error.message}`);
    }
  }
}

export default CloudflareProvider;
