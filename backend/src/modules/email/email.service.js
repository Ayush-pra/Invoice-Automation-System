import { google } from 'googleapis'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')
import prisma from '../../config/db.js'
import * as gmailConnector from '../../connectors/email/gmail.connector.js'
import * as cloudinary from '../../utils/cloudinary.js'
import { decrypt } from '../../utils/encryption.js'

/**
 * Configure Google OAuth2 Client helper
 */
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

/**
 * Generates Google OAuth2 consent screen URL for read-only Gmail access
 * 
 * @returns {string} Auth URL
 */
const getGoogleAuthUrl = () => {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh token
    prompt: 'consent',     // Forces consent prompt to always get refresh token
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  })
}

/**
 * Exchanges auth callback code for Google tokens and stores them
 * 
 * @param {string} code - Google authorization code
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} Status info
 */
const handleGoogleCallback = async (code, userId) => {
  const oauth2Client = getOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  
  if (!tokens.refresh_token) {
    console.warn('[Email Service] Warning: No refresh token returned. User might need to re-consent.')
  }

  await gmailConnector.connectGmail(userId, tokens)
  return { success: true, message: 'Google account connected successfully!' }
}

/**
 * Check if the user currently has a valid Gmail token connected.
 * 
 * @param {string} userId - User's ID
 * @returns {Promise<boolean>}
 */
const isGmailConnected = async (userId) => {
  const token = await prisma.emailToken.findUnique({
    where: { userId },
  })
  if (!token) return false
  
  // Gmail connection is active as long as we have a refresh token
  return !!token.refreshToken
}

/**
 * Scans email inbox, downloads PDF invoices, parses data, uploads to Cloudinary, and saves in DB.
 * 
 * @param {string} userId - User ID who triggered the scan
 * @param {string} companyId - Tenant scoping ID
 * @returns {Promise<Object>} Scan results summary
 */
const scanAndFetchInvoices = async (userId, companyId) => {
  const connected = await isGmailConnected(userId)
  if (!connected) {
    throw Object.assign(new Error('Gmail not connected. Please login first.'), { status: 400 })
  }

  // Look back 30 days by default
  const afterDate = new Date()
  afterDate.setDate(afterDate.getDate() - 30)

  console.log(`[Email Service] Starting invoice email scan for user ${userId} in company ${companyId}...`)
  const foundEmails = await gmailConnector.scanInvoiceEmails(userId, {
    afterDate,
    maxResults: 50,
  })

  let scanned = foundEmails.length
  let created = 0
  let duplicates = 0
  let failed = 0

  for (const email of foundEmails) {
    try {
      const { platform, emailId, emailDate, subject, senderEmail, pdfBuffer, filename } = email

      // Create a unique external ID to prevent duplicates
      const externalId = `email-${emailId}-${filename}`

      // Check if invoice already exists in DB
      const existing = await prisma.invoice.findFirst({
        where: {
          companyId,
          externalId,
        },
      })

      if (existing) {
        duplicates++
        console.log(`[Email Service] Invoice already exists for email id ${emailId}, skipping...`)
        continue
      }

      // Step 1: Parse PDF data using pdf-parse
      const parsedData = await parsePDFInvoice(pdfBuffer)
      
      // Determine final invoice details (fallbacks if regex extraction yields nothing)
      const amount = parsedData.amount || 0.0
      const invoiceNumber = parsedData.invoiceId || `INV-${emailId.slice(0, 8)}`
      const currency = parsedData.currency || 'USD'

      // Step 2: Upload original PDF attachment to Cloudinary
      const dateObj = new Date(emailDate)
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const folderPath = `invoices/${companyId}/${year}/${month}`
      
      const cleanFilename = `${platform}-${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '')}`
      
      console.log(`[Email Service] Uploading ${filename} to Cloudinary folder ${folderPath}...`)
      const uploadResult = await cloudinary.uploadPDF(pdfBuffer, folderPath, cleanFilename)

      // Step 3: Ensure subscription mapping exists (creates a generic EMAIL subscription if not found)
      let subscription = await prisma.subscription.findFirst({
        where: {
          platform,
          companyId,
        },
      })

      if (!subscription) {
        console.log(`[Email Service] Creating automatic EMAIL subscription record for platform: ${platform}`)
        
        // Dynamic integration mapping
        const methodMap = {
          api: 'API',
          email: 'EMAIL',
          browser: 'BROWSER',
          manual: 'MANUAL',
        }
        
        // Try mapping platform details if exists in registry
        let method = 'EMAIL'
        let billingType = 'FIXED'

        try {
          const { getPlatformConfig } = await import('../../connectors/registry.js')
          const config = getPlatformConfig(platform)
          method = methodMap[config.method] || 'EMAIL'
          billingType = config.type.toUpperCase()
        } catch {
          // Fallback if platform is not in registry
        }

        subscription = await prisma.subscription.create({
          data: {
            platform,
            method,
            billingType,
            credentials: '***email-integration***', // Masked email-based credential
            userId,
            companyId,
          },
        })
      }

      // Step 4: Create final invoice record
      await prisma.invoice.create({
        data: {
          externalId,
          platform,
          amount,
          currency,
          billingDate: dateObj,
          pdfUrl: uploadResult.url,
          status: 'PROCESSED',
          subscriptionId: subscription.id,
          companyId,
          rawData: {
            subject,
            sender: senderEmail,
            filename,
            parsedInvoiceId: parsedData.invoiceId,
          },
        },
      })

      created++
      console.log(`[Email Service] Successfully scanned and stored invoice ${invoiceNumber} from ${platform} ($${amount})`)

    } catch (err) {
      failed++
      console.error(`[Email Service] Failed importing invoice for email ${email.emailId}:`, err.message)
    }
  }

  return {
    scanned,
    found: scanned,
    created,
    duplicates,
    failed,
  }
}

/**
 * Disconnects the Gmail integration. Deletes from database and revokes authorization token.
 * 
 * @param {string} userId - User's ID
 * @returns {Promise<Object>} Status info
 */
const disconnectGmail = async (userId) => {
  const token = await prisma.emailToken.findUnique({
    where: { userId },
  })

  if (!token) {
    throw Object.assign(new Error('Gmail account not connected.'), { status: 400 })
  }

  const oauth2Client = getOAuth2Client()
  const refreshToken = decrypt(token.refreshToken)

  // Try revoking the token from Google side
  if (refreshToken) {
    try {
      await oauth2Client.revokeToken(refreshToken)
      console.log('[Email Service] Successfully revoked Google token.')
    } catch (err) {
      console.warn('[Email Service] Failed revoking Google OAuth token:', err.message)
    }
  }

  // Delete from database
  await prisma.emailToken.delete({
    where: { userId },
  })

  return { success: true, message: 'Google account disconnected successfully!' }
}

/**
 * Helper to extract invoice numbers, amounts, and currency from raw PDF text content.
 * 
 * @param {Buffer} buffer - Raw PDF buffer
 * @returns {Promise<Object>} { amount, invoiceId, currency }
 */
const parsePDFInvoice = async (buffer) => {
  try {
    let text = ''
    if (typeof buffer === 'string') {
      text = buffer
    } else if (Buffer.isBuffer(buffer) || buffer instanceof Uint8Array) {
      const p = new PDFParse(new Uint8Array(buffer))
      const res = await p.getText()
      text = res.text || ''
    }

    // Extract amount
    let amount = 0
    const amountRegexes = [
      /total\s*(?:due|amount|charged)?\s*(?::|\$)?\s*([\d,]+\.\d{2})/i,
      /amount\s*(?:due|paid)?\s*(?::|\$)?\s*([\d,]+\.\d{2})/i,
      /balance\s*due\s*(?::|\$)?\s*([\d,]+\.\d{2})/i,
      /\$([\d,]+\.\d{2})/,
      /([\d,]+\.\d{2})\s*(?:usd|inr)/i,
    ]
    for (const regex of amountRegexes) {
      const match = text.match(regex)
      if (match) {
        amount = parseFloat(match[1].replace(/,/g, ''))
        break
      }
    }

    // Extract invoice number
    let invoiceId = null
    const invRegexes = [
      /invoice\s*(?:number|no|id|#)?\s*(?::)?\s*([a-zA-Z0-9-_#]+)/i,
      /receipt\s*(?:number|no|id|#)?\s*(?::)?\s*([a-zA-Z0-9-_#]+)/i,
    ]
    for (const regex of invRegexes) {
      const match = text.match(regex)
      if (match && match[1]) {
        invoiceId = match[1].trim()
        break
      }
    }

    // Extract currency (USD, INR, EUR, etc.)
    let currency = 'USD'
    const curMatch = text.match(/(usd|inr|eur|gbp)/i)
    if (curMatch) {
      currency = curMatch[1].toUpperCase()
    }

    return { amount, invoiceId, currency }
  } catch (err) {
    console.error('[PDF Parser] Error parsing PDF text:', err.message)
    return { amount: 0, invoiceId: null, currency: 'USD' }
  }
}

export {
  getGoogleAuthUrl,
  handleGoogleCallback,
  isGmailConnected,
  scanAndFetchInvoices,
  disconnectGmail,
  parsePDFInvoice,
}
