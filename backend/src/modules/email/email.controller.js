import * as emailService from './email.service.js'

/**
 * GET /api/email/gmail/connect
 * Generates the Google OAuth2 consent screen URL.
 */
const getGoogleAuthUrl = async (req, res, next) => {
  try {
    const url = emailService.getGoogleAuthUrl()
    res.json({ url })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/email/gmail/callback
 * Google OAuth2 callback endpoint. Exchanges code for tokens and saves them.
 */
const handleGoogleCallback = async (req, res, next) => {
  try {
    const { code } = req.query
    if (!code) {
      throw Object.assign(new Error('Google authorization code is required'), { status: 400 })
    }

    const result = await emailService.handleGoogleCallback(code, req.user.id)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/email/gmail/status
 * Checks if the current user has linked their Gmail account.
 */
const checkGmailStatus = async (req, res, next) => {
  try {
    const connected = await emailService.isGmailConnected(req.user.id)
    res.json({ connected })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/email/gmail/scan
 * Scans user's Gmail for invoice emails and downloads, parses, and saves invoices.
 */
const scanInvoices = async (req, res, next) => {
  try {
    const { id: userId, companyId } = req.user
    const summary = await emailService.scanAndFetchInvoices(userId, companyId)
    res.json(summary)
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/email/gmail/disconnect
 * Disconnects Gmail, revokes Google OAuth tokens, and cleans database record.
 */
const disconnectGmail = async (req, res, next) => {
  try {
    const result = await emailService.disconnectGmail(req.user.id)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export {
  getGoogleAuthUrl,
  handleGoogleCallback,
  checkGmailStatus,
  scanInvoices,
  disconnectGmail,
}
