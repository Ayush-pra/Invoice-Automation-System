import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import * as controller from './email.controller.js'

const router = Router()

// All email/Gmail integrations require standard auth protect
router.use(protect)

// GET /api/email/gmail/connect — returns OAuth connect consent URL
router.get('/gmail/connect', controller.getGoogleAuthUrl)

// GET /api/email/gmail/callback — handles code redirect callback from Google
router.get('/gmail/callback', controller.handleGoogleCallback)

// GET /api/email/gmail/status — checks connection state for the employee
router.get('/gmail/status', controller.checkGmailStatus)

// POST /api/email/gmail/scan — manually triggers scan and invoice fetching
router.post('/gmail/scan', controller.scanInvoices)

// DELETE /api/email/gmail/disconnect — unlinks and revokes access tokens
router.delete('/gmail/disconnect', controller.disconnectGmail)

export default router
