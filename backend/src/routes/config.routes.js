import { Router } from 'express';
import { getConfig, updateConfig } from '../controllers/config.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getConfig);
router.put('/', updateConfig);

export default router;
