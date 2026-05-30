import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import authorize from '../../middlewares/role.middleware.js'
import * as controller from './subscription.controller.js'

const router = Router()

// All subscription routes require authentication
router.use(protect)

// GET /api/subscriptions/platforms — list supported platforms (any authenticated user)
router.get('/platforms', controller.getPlatforms)

// GET /api/subscriptions/my — employee sees own subscriptions
router.get('/my', authorize('EMPLOYEE', 'COMPANY_ADMIN', 'FINANCE'), controller.getMySubscriptions)

// GET /api/subscriptions — admin/finance sees all company subscriptions
router.get('/', authorize('COMPANY_ADMIN', 'FINANCE'), controller.getAllCompanySubscriptions)

// POST /api/subscriptions — employee or admin creates a subscription
router.post('/', authorize('EMPLOYEE', 'COMPANY_ADMIN'), controller.create)

// POST /api/subscriptions/:id/fetch — manually trigger invoice fetch (admin only)
router.post('/:id/fetch', authorize('COMPANY_ADMIN'), controller.triggerFetch)

// DELETE /api/subscriptions/:id — owner or admin deletes
router.delete('/:id', authorize('EMPLOYEE', 'COMPANY_ADMIN'), controller.remove)

export default router
