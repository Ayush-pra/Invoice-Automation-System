import invoiceService from '../services/invoice/invoice.service.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * POST /api/invoices/sync
 * Triggers Gmail billing record sync for the authenticated user.
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
 * Returns paginated list of billing records for the authenticated user.
 * Query params: page, limit, sortBy, order, vendorId, isRead
 */
export const getInvoices = asyncHandler(async (req, res) => {
  const { page, limit, sortBy, order, vendorId, isRead } = req.query;

  const result = await invoiceService.getInvoices(req.user._id, {
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    sortBy,
    order,
    vendorId,
    isRead,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/invoices/:id
 * Returns a single billing record by ID.
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

/**
 * PATCH /api/invoices/:id/read
 * Updates read status of a billing record.
 */
export const updateReadStatus = asyncHandler(async (req, res) => {
  const { isRead } = req.body;
  const invoice = await invoiceService.updateReadStatus(req.user._id, req.params.id, isRead);

  res.json({
    success: true,
    data: invoice,
  });
});

/**
 * DELETE /api/invoices/:id
 * Deletes a single billing record and its documents.
 */
export const deleteInvoice = asyncHandler(async (req, res) => {
  await invoiceService.deleteInvoice(req.user._id, req.params.id);

  res.json({
    success: true,
    message: 'Billing record deleted successfully',
  });
});

/**
 * POST /api/invoices/bulk-delete
 * Bulk deletes billing records.
 */
export const bulkDeleteInvoices = asyncHandler(async (req, res) => {
  const { invoiceIds } = req.body;
  const result = await invoiceService.bulkDeleteInvoices(req.user._id, invoiceIds);

  res.json({
    success: true,
    message: `${result.deletedCount} billing records deleted successfully`,
  });
});
