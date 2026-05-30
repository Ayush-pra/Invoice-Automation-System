import Razorpay from 'razorpay'
import BaseConnector from '../base.connector.js'

class RazorpayConnector extends BaseConnector {
  constructor() {
    super('razorpay')
  }

  /**
   * Fetch invoices from Razorpay using the official Node.js SDK.
   *
   * @param {Object} credentials - { keyId: string, keySecret: string }
   * @returns {Promise<Array>} standardized invoice objects
   */
  async fetchInvoices(credentials) {
    const { keyId, keySecret } = credentials

    if (!keyId || !keySecret) {
      throw Object.assign(
        new Error('Razorpay keyId and keySecret are required'),
        { status: 400 }
      )
    }

    try {
      const client = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      })

      // Fetch all invoices from Razorpay
      const invoices = await client.invoices.all({ count: 100 })

      // If no invoices found, return an empty usage record
      if (!invoices || !invoices.items || invoices.items.length === 0) {
        return [{
          platform: 'razorpay',
          invoiceId: `razorpay-${new Date().toISOString().slice(0, 7)}`,
          amount: 0,
          currency: 'INR',
          date: new Date(),
          pdfUrl: null,
          pdfBuffer: null,
          type: 'metered',
          rawData: { message: 'No invoices found in Razorpay account' },
        }]
      }

      // Map each Razorpay invoice to the standard format
      return invoices.items.map((invoice) => ({
        platform: 'razorpay',
        invoiceId: invoice.id,
        amount: (invoice.amount || 0) / 100, // Razorpay stores amounts in paise → divide by 100 for INR
        currency: (invoice.currency || 'INR').toUpperCase(),
        date: invoice.date
          ? new Date(invoice.date * 1000)   // Razorpay date is Unix timestamp
          : new Date(invoice.created_at * 1000),
        pdfUrl: invoice.short_url || null,
        pdfBuffer: null,
        type: 'metered',
        rawData: {
          id: invoice.id,
          status: invoice.status,
          description: invoice.description,
          customer: invoice.customer_details,
          receipt: invoice.receipt,
        },
      }))

    } catch (error) {
      if (error.status) throw error

      // Handle Razorpay SDK specific errors
      if (error.statusCode === 401 || error.error?.code === 'BAD_REQUEST_ERROR') {
        throw Object.assign(
          new Error(`Razorpay authentication failed: ${error.error?.description || 'Invalid API keys'}`),
          { status: 401 }
        )
      }

      console.error(`[Razorpay Connector] Error fetching invoices:`, error.message)
      throw Object.assign(
        new Error(`Failed to fetch Razorpay invoices: ${error.message}`),
        { status: 502 }
      )
    }
  }
}

export default RazorpayConnector
