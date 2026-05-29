import axios from 'axios';
import BaseApiProvider from './baseApi.provider.js';

export default class RazorpayProvider extends BaseApiProvider {
  constructor() {
    super();
    this.baseUrl = 'https://api.razorpay.com/v1';
  }

  /**
   * Helper to create Axios instance with Razorpay Basic Auth
   */
  getApiClient(credentials) {
    const { keyId, keySecret } = credentials;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Instantly validates credentials by making a lightweight API call.
   */
  async validateCredentials(credentials) {
    try {
      const api = this.getApiClient(credentials);
      // Fetching 1 payment is a fast, read-only way to verify keys
      await api.get('/payments?count=1');
      return { success: true };
    } catch (error) {
      if (error.response && error.response.status === 401) {
        return { success: false, message: 'Invalid Razorpay Key ID or Key Secret.' };
      }
      return { success: false, message: 'Failed to connect to Razorpay API.' };
    }
  }

  /**
   * Main method to fetch billing records from Razorpay.
   */
  async fetchBillingRecords(credentials, options = {}) {
    const api = this.getApiClient(credentials);
    const records = [];
    
    // Calculate timestamp bounds
    const days = options.scanDurationDays || 30;
    const fromTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const toTimestamp = Math.floor(Date.now() / 1000);

    const queryParams = `?from=${fromTimestamp}&to=${toTimestamp}&count=100`;

    try {
      // 1. Fetch Invoices (User refers to these as 'payments' because they have a link and are paid)
      try {
        const invoicesResponse = await api.get(`/invoices${queryParams}`);
        if (invoicesResponse.data && invoicesResponse.data.items) {
          for (const inv of invoicesResponse.data.items) {
            // Only include successfully paid invoices (user called these 'successful payments')
            if (inv.status === 'paid') {
              records.push(this.createBillingRecord({
                vendorName: 'Razorpay',
                amount: (inv.amount / 100).toFixed(2), // amount is in paise
                currency: inv.currency || 'INR',
                billingDate: new Date((inv.paid_at || inv.issued_at) * 1000),
                invoiceNumber: inv.invoice_number,
                orderId: inv.order_id || null, // we can leave this or null it out if they hate seeing ORD. Actually invoiceNumber takes precedence in UI.
                transactionId: inv.id,
                invoicePdf: null,
                invoiceLink: inv.short_url,
                invoiceAvailability: 'LINK',
                rawData: inv,
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Razorpay fetch invoices failed:', err.message);
      }

      return records;
    } catch (error) {
      console.error('Razorpay API Error:', error.response?.data || error.message);
      throw new Error(`Razorpay API sync failed: ${error.message}`);
    }
  }
}
