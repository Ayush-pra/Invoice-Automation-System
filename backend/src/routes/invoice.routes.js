import { Router } from 'express';
import {
  syncInvoices,
  getInvoices,
  getInvoiceById,
  updateReadStatus,
  deleteInvoice,
  bulkDeleteInvoices,
} from '../controllers/invoice.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// All billing routes require authentication
router.use(authMiddleware);

router.post('/sync', syncInvoices);
router.post('/bulk-delete', bulkDeleteInvoices);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.patch('/:id/read', updateReadStatus);
router.delete('/:id', deleteInvoice);

export default router;
