/**
 * BaseConnector — Abstract base class that every platform connector must extend.
 * 
 * Every connector MUST implement fetchInvoices(credentials) which returns
 * an array of standardized invoice objects.
 */
class BaseConnector {
  constructor(platform) {
    if (new.target === BaseConnector) {
      throw new Error('BaseConnector is abstract and cannot be instantiated directly')
    }
    this.platform = platform
  }

  /**
   * Fetch invoices from the platform.
   * 
   * @param {Object} credentials - Decrypted credentials for the platform
   * @returns {Promise<Array<{
   *   platform: string,
   *   invoiceId: string,
   *   amount: number,
   *   currency: string,
   *   date: Date,
   *   pdfUrl: string|null,
   *   pdfBuffer: Buffer|null,
   *   type: 'metered'|'fixed'|'annual'|'subscription_only'
   * }>>}
   */
  async fetchInvoices(credentials) {
    throw new Error(`fetchInvoices() must be implemented by ${this.platform} connector`)
  }
}

export default BaseConnector
