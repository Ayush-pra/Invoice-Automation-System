import { Router } from 'express';
import {
  syncInvoices,
  getInvoices,
  getInvoiceById,
} from '../controllers/invoice.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// All invoice routes require authentication
router.use(authMiddleware);

router.post('/sync', syncInvoices);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);

export default router;
