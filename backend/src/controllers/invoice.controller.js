import invoiceService from '../services/invoice/invoice.service.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * POST /api/invoices/sync
 * Triggers Gmail invoice sync for the authenticated user.
 */
export const syncInvoices = asyncHandler(async (req, res) => {
  const result = await invoiceService.syncInvoices(req.user._id);

  res.json({
    success: true,
    message: `Sync complete: ${result.imported} imported, ${result.skipped} skipped`,
    data: result,
  });
});

/**
 * GET /api/invoices
 * Returns paginated list of invoices for the authenticated user.
 * Query params: page, limit, sortBy, order
 */
export const getInvoices = asyncHandler(async (req, res) => {
  const { page, limit, sortBy, order } = req.query;

  const result = await invoiceService.getInvoices(req.user._id, {
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    sortBy,
    order,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/invoices/:id
 * Returns a single invoice by ID for the authenticated user.
 */
export const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(
    req.user._id,
    req.params.id
  );

  res.json({
    success: true,
    data: invoice,
  });
});
