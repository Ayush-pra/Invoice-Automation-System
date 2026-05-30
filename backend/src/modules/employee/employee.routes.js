import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import authorize from '../../middlewares/role.middleware.js'
import { inviteEmployeeHandler, listEmployeesHandler } from './employee.controller.js'

const router = Router()

// All employee routes require authentication
router.use(protect)

// GET /api/employees — list employees in the company
router.get('/', authorize('COMPANY_ADMIN', 'FINANCE'), listEmployeesHandler)

// POST /api/employees — invite / create new employee
router.post('/', authorize('COMPANY_ADMIN', 'FINANCE'), inviteEmployeeHandler)

export default router
