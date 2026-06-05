/**
 * Abstract base class for invoice providers.
 * All providers (Gmail, Outlook, Stripe, etc.) must extend this class.
 * This ensures a uniform contract for fetching invoices from any source.
 */
class BaseInvoiceProvider {
  /**
   * Initialize the provider with credentials from an integration.
   * @param {Object} integration - The Integration document with tokens.
   * @returns {Promise<void>}
   */
  async connect(integration) {
    throw new Error('connect() must be implemented by provider');
  }

  /**
   * Fetch invoice data from the provider.
   * @param {Object} integration - The Integration document.
   * @param {Object} options - Fetch options (date ranges, filters, etc.)
   * @param {Set<string>} [options.existingMessageIds] - Message IDs already imported.
   * @returns {Promise<Array<Object>>} Array of invoice data objects.
   */
  async fetchInvoices(integration, options = {}) {
    throw new Error('fetchInvoices() must be implemented by provider');
  }
}

export default BaseInvoiceProvider;
