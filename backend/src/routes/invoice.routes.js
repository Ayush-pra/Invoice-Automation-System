import { Router } from 'express';
import {
  syncInvoices,
  getInvoices,
  getInvoiceById,
  updateReadStatus,
  deleteInvoice,
  bulkDeleteInvoices,
  resolveGrouping
} from '../controllers/invoice.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// All invoice routes require authentication
router.use(authMiddleware);

router.post('/sync', syncInvoices);
router.post('/bulk-delete', bulkDeleteInvoices);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/:recordId/resolve', resolveGrouping);
router.patch('/:id/read', updateReadStatus);
router.delete('/:id', deleteInvoice);

export default router;
