import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import authorize from '../../middlewares/role.middleware.js'
import {
  getOverviewHandler,
  getDepartmentBreakdownHandler,
  getEmployeeBreakdownHandler,
  getPlatformBreakdownHandler,
  getSpendTrendHandler,
  getDuplicateSubscriptionsHandler,
  getUnusedSubscriptionsHandler,
  getRenewalAlertsHandler,
} from './dashboard.controller.js'

const router = Router()

// All dashboard routes require authentication
router.use(protect)

// Restrict to COMPANY_ADMIN and FINANCE roles
router.use(authorize('COMPANY_ADMIN', 'FINANCE'))

// GET /api/dashboard/overview?month=5&year=2026
router.get('/overview', getOverviewHandler)

// GET /api/dashboard/departments?month=5&year=2026
router.get('/departments', getDepartmentBreakdownHandler)

// GET /api/dashboard/employees?month=5&year=2026
router.get('/employees', getEmployeeBreakdownHandler)

// GET /api/dashboard/platforms?month=5&year=2026
router.get('/platforms', getPlatformBreakdownHandler)

// GET /api/dashboard/trend?months=6
router.get('/trend', getSpendTrendHandler)

// GET /api/dashboard/duplicates
router.get('/duplicates', getDuplicateSubscriptionsHandler)

// GET /api/dashboard/unused
router.get('/unused', getUnusedSubscriptionsHandler)

// GET /api/dashboard/renewals
router.get('/renewals', getRenewalAlertsHandler)

export default router
