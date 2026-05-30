import BaseConnector from '../base.connector.js'

class OpenAIConnector extends BaseConnector {
  constructor() {
    super('openai')
    this.baseUrl = 'https://api.openai.com'
  }

  /**
   * Fetch invoices from OpenAI Billing API.
   * 
   * @param {Object} credentials - { apiKey: string }
   * @returns {Promise<Array>} standardized invoice objects
   */
  async fetchInvoices(credentials) {
    const { apiKey } = credentials

    if (!apiKey) {
      throw Object.assign(new Error('OpenAI API key is required'), { status: 400 })
    }

    try {
      // Fetch billing invoices from OpenAI
      const response = await fetch(`${this.baseUrl}/v1/organization/costs?start_time=${this._getStartOfMonth()}&end_time=${this._getEndOfMonth()}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorBody = await response.text()
        if (response.status === 401) {
          throw Object.assign(new Error('Invalid OpenAI API key'), { status: 401 })
        }
        throw new Error(`OpenAI API error (${response.status}): ${errorBody}`)
      }

      const data = await response.json()

      // Also try to fetch actual invoices list
      const invoicesResponse = await fetch(`${this.baseUrl}/v1/organization/invoices?limit=12`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json()
        return this._mapInvoices(invoicesData)
      }

      // Fallback: create usage-based record from costs endpoint
      return this._mapCostsToInvoices(data)

    } catch (error) {
      if (error.status) throw error // Re-throw our custom errors
      console.error(`[OpenAI Connector] Error fetching invoices:`, error.message)
      throw Object.assign(
        new Error(`Failed to fetch OpenAI invoices: ${error.message}`),
        { status: 502 }
      )
    }
  }

  /**
   * Map OpenAI invoices endpoint response to standard format
   */
  _mapInvoices(data) {
    const invoices = data.data || []
    return invoices.map((inv) => ({
      platform: 'openai',
      invoiceId: inv.id || `openai-${Date.now()}`,
      amount: (inv.total || 0) / 100, // OpenAI returns cents
      currency: (inv.currency || 'usd').toUpperCase(),
      date: new Date(inv.created ? inv.created * 1000 : Date.now()),
      pdfUrl: inv.hosted_invoice_url || null,
      pdfBuffer: null,
      type: 'metered',
      rawData: inv,
    }))
  }

  /**
   * Fallback: create a usage summary record from costs data
   */
  _mapCostsToInvoices(data) {
    const results = data.data || []
    if (results.length === 0) return []

    const totalAmount = results.reduce((sum, r) => {
      const costs = r.results || []
      return sum + costs.reduce((s, c) => s + (c.amount?.value || 0), 0)
    }, 0)

    return [{
      platform: 'openai',
      invoiceId: `openai-usage-${new Date().toISOString().slice(0, 7)}`,
      amount: totalAmount,
      currency: 'USD',
      date: new Date(),
      pdfUrl: null,
      pdfBuffer: null,
      type: 'metered',
      rawData: data,
    }]
  }

  _getStartOfMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return Math.floor(start.getTime() / 1000)
  }

  _getEndOfMonth() {
    return Math.floor(Date.now() / 1000)
  }
}

export default OpenAIConnector
