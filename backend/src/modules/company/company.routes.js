import { Router } from 'express'
import protect from '../../middlewares/auth.middleware.js'
import authorize from '../../middlewares/role.middleware.js'

const router = Router()

// All company routes require authentication
router.use(protect)

// GET /api/companies — get current user's company
router.get('/', async (req, res) => {
  res.json({ message: 'Company routes — coming soon' })
})

export default router
