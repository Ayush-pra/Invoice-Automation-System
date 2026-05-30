import { getPlatformConfig } from './registry.js'
import { decrypt } from '../utils/encryption.js'

// Cache connector instances to avoid re-importing
const connectorCache = new Map()

/**
 * Get the connector instance for a given platform.
 * Dynamically imports the connector module and caches it.
 * 
 * @param {string} platformName - e.g., 'openai', 'github', 'figma'
 * @returns {Promise<BaseConnector>} connector instance
 */
const getConnector = async (platformName) => {
  const config = getPlatformConfig(platformName) // throws if not found

  if (connectorCache.has(platformName)) {
    return connectorCache.get(platformName)
  }

  try {
    // Dynamic import of the connector module
    const connectorModule = await import(config.connector)
    const ConnectorClass = connectorModule.default
    const instance = new ConnectorClass()
    connectorCache.set(platformName, instance)
    return instance
  } catch (error) {
    console.error(`[ConnectorManager] Failed to load connector for '${platformName}':`, error.message)
    throw Object.assign(
      new Error(`Connector for '${platformName}' is not available. It may not be implemented yet.`),
      { status: 501 }
    )
  }
}

/**
 * Fetch invoices for a subscription.
 * Decrypts credentials, gets the correct connector, and calls fetchInvoices.
 * 
 * @param {Object} subscription - Prisma Subscription record
 * @param {string} subscription.platform - platform name
 * @param {string} subscription.credentials - encrypted credentials JSON string
 * @returns {Promise<Array>} standardized invoice array
 */
const fetchInvoicesForSubscription = async (subscription) => {
  const { platform, method, credentials: encryptedCredentials } = subscription

  try {
    // 1. MANUAL Integration Method
    if (method === 'MANUAL') {
      console.log(`[ConnectorManager] MANUAL integration method selected for subscription ${subscription.id}. Skipping auto-fetch.`)
      return null
    }

    // 2. EMAIL (Gmail scan) Integration Method
    if (method === 'EMAIL') {
      const { scanInvoiceEmails } = await import('./email/gmail.connector.js')
      const { parsePDFInvoice } = await import('../modules/email/email.service.js')
      const { getPlatformConfig } = await import('./registry.js')

      console.log(`[ConnectorManager] Scanning invoice emails for platform ${platform} (User: ${subscription.userId})...`)
      
      // Default to scanning emails from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const emails = await scanInvoiceEmails(subscription.userId, {
        afterDate: thirtyDaysAgo,
      })

      // Filter emails that belong to this platform
      const filteredEmails = emails.filter(e => e.platform.toLowerCase() === platform.toLowerCase())
      const config = getPlatformConfig(platform)

      const invoices = []
      for (const email of filteredEmails) {
        const parsed = await parsePDFInvoice(email.pdfBuffer)
        invoices.push({
          platform: email.platform,
          invoiceId: parsed.invoiceId || `email-${email.emailId}`,
          amount: parsed.amount || 0.0,
          currency: parsed.currency || 'USD',
          date: email.emailDate,
          pdfUrl: null, // URL is null during direct fetch (updated later when uploaded)
          pdfBuffer: email.pdfBuffer,
          type: config.type,
        })
      }

      console.log(`[ConnectorManager] Standardized ${invoices.length} invoice(s) fetched via EMAIL method from ${platform}`)
      return invoices
    }

    // 3. API or BROWSER Integration Methods
    if (method === 'API' || method === 'BROWSER') {
      // Step 1: Decrypt credentials
      const decryptedJson = decrypt(encryptedCredentials)
      const credentials = JSON.parse(decryptedJson)

      // Step 2: Get correct connector
      const connector = await getConnector(platform)

      // Step 3: Fetch invoices
      console.log(`[ConnectorManager] Fetching invoices via ${method} connector for ${platform} (Subscription: ${subscription.id})`)
      const invoices = await connector.fetchInvoices(credentials)

      console.log(`[ConnectorManager] Fetched ${invoices.length} invoice(s) from ${platform}`)
      return invoices
    }

    throw new Error(`Unsupported integration method: ${method}`)

  } catch (error) {
    // Don't crash the whole system — log and return error info
    console.error(`[ConnectorManager] Error for subscription ${subscription.id} (${platform}):`, error.message)
    
    // Re-throw with context if it's an auth error
    if (error.status === 401 || error.status === 400) {
      throw error
    }

    // For unexpected errors, wrap with connector context
    throw Object.assign(
      new Error(`Invoice fetch failed for ${platform}: ${error.message}`),
      { status: error.status || 500 }
    )
  }
}

export { getConnector, fetchInvoicesForSubscription }
