import BaseConnector from '../base.connector.js'

class FigmaConnector extends BaseConnector {
  constructor() {
    super('figma')
    this.loginUrl = 'https://www.figma.com/login'
    this.billingUrl = 'https://www.figma.com/settings/billing'
  }

  /**
   * Fetch invoices from Figma using Playwright browser automation.
   * 
   * This is a Layer 3 fallback — only used when API and email methods
   * are not available. Browser automation is fragile and may break
   * if Figma changes their UI.
   * 
   * @param {Object} credentials - { email: string, password: string }
   * @returns {Promise<Array>} standardized invoice objects
   */
  async fetchInvoices(credentials) {
    const { email, password } = credentials

    if (!email || !password) {
      throw Object.assign(new Error('Figma email and password are required'), { status: 400 })
    }

    let browser = null

    try {
      // Dynamically import playwright to avoid loading it unless needed
      const { chromium } = await import('playwright')

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()

      // Step 1: Navigate to login
      console.log('[Figma Connector] Navigating to login page...')
      await page.goto(this.loginUrl, { waitUntil: 'networkidle', timeout: 30000 })

      // Step 2: Fill login form
      await page.fill('input[name="email"], input[type="email"]', email)
      await page.fill('input[name="password"], input[type="password"]', password)

      // Step 3: Submit login
      await page.click('button[type="submit"]')

      // Step 4: Wait for navigation after login
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 })
      } catch {
        // Some logins redirect without full navigation event
      }

      // Step 5: Check for login errors
      const pageContent = await page.content()
      if (pageContent.includes('Invalid email or password') || pageContent.includes('incorrect')) {
        throw Object.assign(new Error('Invalid Figma credentials'), { status: 401 })
      }

      // Step 6: Check for 2FA
      if (pageContent.includes('two-factor') || pageContent.includes('verification code')) {
        throw Object.assign(
          new Error('Figma account has 2FA enabled. Browser automation cannot handle 2FA. Use email parsing or manual upload instead.'),
          { status: 400 }
        )
      }

      // Step 7: Navigate to billing page
      console.log('[Figma Connector] Navigating to billing page...')
      await page.goto(this.billingUrl, { waitUntil: 'networkidle', timeout: 30000 })

      // Step 8: Extract invoice data
      const invoices = await this._extractInvoices(page)

      await browser.close()
      return invoices

    } catch (error) {
      if (browser) await browser.close()
      if (error.status) throw error
      console.error(`[Figma Connector] Browser automation error:`, error.message)
      throw Object.assign(
        new Error(`Figma invoice fetch failed: ${error.message}. Consider using email parsing as an alternative.`),
        { status: 502 }
      )
    }
  }

  /**
   * Extract invoice data from Figma billing page
   */
  async _extractInvoices(page) {
    try {
      // Look for invoice rows/links on the billing page
      const invoiceElements = await page.$$('a[href*="invoice"], tr[data-testid*="invoice"], .invoice-row, [class*="invoice"]')

      if (invoiceElements.length === 0) {
        console.log('[Figma Connector] No invoice elements found on billing page')
        // Return a record indicating we accessed billing but found no downloadable invoices
        return [{
          platform: 'figma',
          invoiceId: `figma-billing-${new Date().toISOString().slice(0, 7)}`,
          amount: 0,
          currency: 'USD',
          date: new Date(),
          pdfUrl: null,
          pdfBuffer: null,
          type: 'fixed',
          rawData: { 
            note: 'Billing page accessed but no downloadable invoices found. Check Figma billing page manually or use email parsing.',
          },
        }]
      }

      const invoices = []

      for (const element of invoiceElements) {
        try {
          const text = await element.textContent()
          const href = await element.getAttribute('href')

          // Try to extract amount and date from the text
          const amountMatch = text?.match(/\$?([\d,]+\.?\d*)/)?.[1]
          const dateMatch = text?.match(/(\w+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})/)?.[1]

          const invoice = {
            platform: 'figma',
            invoiceId: `figma-${Date.now()}-${invoices.length}`,
            amount: amountMatch ? parseFloat(amountMatch.replace(',', '')) : 0,
            currency: 'USD',
            date: dateMatch ? new Date(dateMatch) : new Date(),
            pdfUrl: href || null,
            pdfBuffer: null,
            type: 'fixed',
            rawData: { text, href },
          }

          // If there's a PDF link, try to download it
          if (href && (href.includes('.pdf') || href.includes('invoice'))) {
            try {
              const downloadResponse = await page.request.get(href)
              if (downloadResponse.ok()) {
                invoice.pdfBuffer = await downloadResponse.body()
              }
            } catch (downloadErr) {
              console.warn(`[Figma Connector] Could not download PDF:`, downloadErr.message)
            }
          }

          invoices.push(invoice)
        } catch (elementErr) {
          console.warn(`[Figma Connector] Error processing invoice element:`, elementErr.message)
        }
      }

      return invoices.length > 0 ? invoices : [{
        platform: 'figma',
        invoiceId: `figma-${new Date().toISOString().slice(0, 7)}`,
        amount: 0,
        currency: 'USD',
        date: new Date(),
        pdfUrl: null,
        pdfBuffer: null,
        type: 'fixed',
        rawData: { note: 'Could not parse invoice details from billing page' },
      }]

    } catch (err) {
      console.error(`[Figma Connector] Error extracting invoices:`, err.message)
      return []
    }
  }
}

export default FigmaConnector
