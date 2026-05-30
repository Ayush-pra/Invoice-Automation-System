import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import authorize from '../../middlewares/role.middleware.js'
import {
  setBudgetHandler,
  getBudgetsHandler,
  deleteBudgetHandler,
} from './budget.controller.js'

const router = Router()

// All budget routes require authentication
router.use(protect)

// POST /api/budget — set/upsert department budget (COMPANY_ADMIN only)
router.post('/', authorize('COMPANY_ADMIN'), setBudgetHandler)

// GET /api/budget?month=5&year=2026 — get budget vs actual (COMPANY_ADMIN, FINANCE)
router.get('/', authorize('COMPANY_ADMIN', 'FINANCE'), getBudgetsHandler)

// DELETE /api/budget/:id — delete budget (COMPANY_ADMIN only)
router.delete('/:id', authorize('COMPANY_ADMIN'), deleteBudgetHandler)

export default router
