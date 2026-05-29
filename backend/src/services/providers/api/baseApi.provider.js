/**
 * Base class for all API-based billing providers.
 * Enforces a strict Unified Billing Response contract.
 */
export default class BaseApiProvider {
  /**
   * Fetches billing records using the vendor's API.
   * @param {Object} credentials - The decrypted credentials from VendorIntegration
   * @param {Object} options - Sync options (e.g. scanDurationDays)
   * @returns {Promise<Array>} Array of standardized billing record objects
   */
  async fetchBillingRecords(credentials, options = {}) {
    throw new Error('fetchBillingRecords must be implemented by subclass');
  }

  /**
   * Helper to format the standard unified response required by the orchestrator.
   */
  createBillingRecord({
    vendorName,
    amount,
    currency,
    billingDate,
    invoiceNumber = null,
    orderId = null,
    transactionId = null,
    invoicePdf = null,
    invoiceLink = null,
    invoiceAvailability = 'JSON_ONLY', // 'PDF', 'LINK', 'JSON_ONLY'
    rawData = {},
  }) {
    return {
      vendorName,
      amount,
      currency,
      billingDate,
      invoiceNumber,
      orderId,
      transactionId,
      invoicePdf,
      invoiceLink,
      invoiceAvailability,
      rawData,
    };
  }
}
