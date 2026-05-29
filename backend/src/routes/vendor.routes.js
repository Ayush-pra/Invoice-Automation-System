import { Router } from 'express';
import { getVendors, searchVendors } from '../controllers/vendor.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getVendors);
router.get('/search', searchVendors);

export default router;
