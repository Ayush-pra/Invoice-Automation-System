import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import authorize from '../../middlewares/role.middleware.js'
import {
  generateReportHandler,
  sendReportHandler,
  getReportsHandler,
  getReportByIdHandler,
  getReportDownloadUrlHandler,
} from './report.controller.js'

const router = Router()

// All report routes require authentication
router.use(protect)

// Apply authorization constraints so only COMPANY_ADMIN and FINANCE can manage reports
router.use(authorize('COMPANY_ADMIN', 'FINANCE'))

// POST /api/reports/generate — generate monthly report
router.post('/generate', generateReportHandler)

// POST /api/reports/:id/send — send report PDF to CA via email
router.post('/:id/send', sendReportHandler)

// GET /api/reports — list all reports for the company
router.get('/', getReportsHandler)

// GET /api/reports/:id — get report details by ID
router.get('/:id', getReportByIdHandler)

// GET /api/reports/:id/download — get temporary signed download URL
router.get('/:id/download', getReportDownloadUrlHandler)

export default router
