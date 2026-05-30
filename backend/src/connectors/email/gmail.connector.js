import { google } from 'googleapis'
import prisma from '../../config/db.js'
import { encrypt, decrypt } from '../../utils/encryption.js'
import { getPlatformFromSender, getAllSenderEmails } from './senderMap.js'

/**
 * Stores or updates the encrypted access and refresh tokens for a user.
 * 
 * @param {string} userId - User's ID
 * @param {Object} tokens - Google token object (accessToken, refreshToken, expiryDate)
 */
const connectGmail = async (userId, tokens) => {
  const encryptedAccess = encrypt(tokens.access_token)
  const encryptedRefresh = encrypt(tokens.refresh_token || '')
  const expiresAt = new Date(tokens.expiry_date)

  // Use upsert to handle create/update seamlessly
  await prisma.emailToken.upsert({
    where: { userId },
    update: {
      accessToken: encryptedAccess,
      // Only overwrite refresh token if a new one is returned (Google sometimes only returns access token)
      ...(tokens.refresh_token ? { refreshToken: encryptedRefresh } : {}),
      expiresAt,
    },
    create: {
      userId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt,
    },
  })
}

/**
 * Authenticates and returns a Gmail client for a given user.
 * Auto-refreshes expired access tokens.
 * 
 * @param {string} userId - User's ID
 * @returns {Promise<gmail_v1.Gmail>} Authenticated Gmail client
 */
const getGmailClient = async (userId) => {
  const emailToken = await prisma.emailToken.findUnique({
    where: { userId },
  })

  if (!emailToken) {
    throw Object.assign(
      new Error('Gmail account not connected. Please connect via OAuth first.'),
      { status: 400 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  const accessToken = decrypt(emailToken.accessToken)
  const refreshToken = decrypt(emailToken.refreshToken)

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: emailToken.expiresAt.getTime(),
  })

  // Set up auto-update on token refresh
  oauth2Client.on('tokens', async (newTokens) => {
    console.log('[Gmail Connector] Tokens refreshed automatically for user:', userId)
    await connectGmail(userId, {
      access_token: newTokens.access_token || accessToken,
      refresh_token: newTokens.refresh_token || refreshToken,
      expiry_date: newTokens.expiry_date || Date.now() + 3600 * 1000,
    })
  })

  // Force a manual refresh if expired or near expiry to avoid failures
  if (emailToken.expiresAt.getTime() <= Date.now() + 60000) {
    console.log('[Gmail Connector] Token expired or near expiry. Manually refreshing...')
    try {
      const refreshed = await oauth2Client.refreshAccessToken()
      await connectGmail(userId, refreshed.credentials)
    } catch (err) {
      console.error('[Gmail Connector] Failed to refresh access token:', err.message)
      throw Object.assign(
        new Error('Gmail session has expired. Please disconnect and reconnect your Google account.'),
        { status: 401 }
      )
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/**
 * Download all PDF attachments from a specific Gmail message.
 * 
 * @param {gmail_v1.Gmail} gmail - Gmail client
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Array<{ filename: string, buffer: Buffer }>>}
 */
const extractPDFAttachments = async (gmail, messageId) => {
  const attachments = []

  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    })

    const message = res.data
    const parts = message.payload.parts || []

    // Recursive function to search for PDF attachments inside multi-part emails
    const searchParts = async (partsList) => {
      for (const part of partsList) {
        if (part.mimeType === 'application/pdf' && part.body.attachmentId) {
          const attachRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: part.body.attachmentId,
          })

          const data = attachRes.data.data
          // Convert base64url data to standard Buffer
          const buffer = Buffer.from(data, 'base64')
          attachments.push({
            filename: part.filename || `invoice-${messageId}.pdf`,
            buffer,
          })
        }

        // Search nested parts
        if (part.parts) {
          await searchParts(part.parts)
        }
      }
    }

    await searchParts(parts)
  } catch (error) {
    console.error(`[Gmail Connector] Error extracting attachments from ${messageId}:`, error.message)
  }

  return attachments
}

/**
 * Scan the user's inbox for invoice emails matching known SaaS platform senders.
 * 
 * @param {string} userId - User's ID
 * @param {Object} options - { afterDate: Date, maxResults: number }
 * @returns {Promise<Array>} Standard standardized parsed email object
 */
const scanInvoiceEmails = async (userId, options = {}) => {
  const gmail = await getGmailClient(userId)
  const senders = getAllSenderEmails().join(' OR ')
  
  let q = `from:(${senders}) has:attachment`
  if (options.afterDate) {
    const dateStr = options.afterDate.toISOString().slice(0, 10).replace(/-/g, '/')
    q += ` after:${dateStr}`
  }

  console.log('[Gmail Connector] Gmail Scan Query:', q)

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: options.maxResults || 50,
  })

  const messages = listRes.data.messages || []
  const parsedEmails = []

  for (const msg of messages) {
    try {
      const emailDetailRes = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })

      const headers = emailDetailRes.data.payload.headers
      const fromHeader = headers.find(h => h.name === 'From')?.value || ''
      const subject = headers.find(h => h.name === 'Subject')?.value || ''
      const dateHeader = headers.find(h => h.name === 'Date')?.value || ''

      const platform = getPlatformFromSender(fromHeader)
      if (!platform) continue

      const attachments = await extractPDFAttachments(gmail, msg.id)
      if (attachments.length === 0) continue

      for (const attachment of attachments) {
        parsedEmails.push({
          platform,
          emailId: msg.id,
          emailDate: new Date(dateHeader),
          subject,
          senderEmail: fromHeader,
          pdfBuffer: attachment.buffer,
          filename: attachment.filename,
        })
      }
    } catch (err) {
      // Catch error for this specific email to prevent failing the entire scan
      console.error(`[Gmail Connector] Failed scanning email ${msg.id}:`, err.message)
    }
  }

  return parsedEmails
}

export {
  connectGmail,
  getGmailClient,
  extractPDFAttachments,
  scanInvoiceEmails,
}
