import { Router } from 'express'
import multer from 'multer'
import protect from '../../middlewares/auth.middleware.js'
import {
  listInvoicesHandler,
  getInvoiceByIdHandler,
  triggerFetchHandler,
  createManualInvoiceHandler,
  parseUploadedPDFHandler,
} from './invoice.controller.js'

const router = Router()

// Configure Multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // limit to 5MB
  },
})

// All routes require authentication
router.use(protect)

// GET /api/invoices — list invoices with filters
router.get('/', listInvoicesHandler)

// GET /api/invoices/:id — get single invoice details
router.get('/:id', getInvoiceByIdHandler)

// POST /api/invoices/trigger/:subscriptionId — manually trigger fetch for subscription
router.post('/trigger/:subscriptionId', triggerFetchHandler)

// POST /api/invoices/manual — create manual invoice with optional PDF upload
router.post('/manual', upload.single('pdf'), createManualInvoiceHandler)

// POST /api/invoices/parse-pdf — parse an uploaded PDF without saving (dry-run prefill)
router.post('/parse-pdf', upload.single('pdf'), parseUploadedPDFHandler)

export default router
