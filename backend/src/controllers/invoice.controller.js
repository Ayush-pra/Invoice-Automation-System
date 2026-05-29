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

export const updateReadStatus = asyncHandler(async (req, res) => {
  const { isRead } = req.body;
  const invoice = await invoiceService.updateReadStatus(req.user._id, req.params.id, isRead);
  
  res.json({
    success: true,
    data: invoice,
  });
});

export const deleteInvoice = asyncHandler(async (req, res) => {
  await invoiceService.deleteInvoice(req.user._id, req.params.id);
  
  res.json({
    success: true,
    message: 'Invoice deleted successfully'
  });
});

export const bulkDeleteInvoices = asyncHandler(async (req, res) => {
  const { invoiceIds } = req.body;
  const result = await invoiceService.bulkDeleteInvoices(req.user._id, invoiceIds);
  
  res.json({
    success: true,
    message: `${result.deletedCount} invoices deleted successfully`
  });
});

export const resolveGrouping = asyncHandler(async (req, res) => {
  const { recordId } = req.params;
  const { action } = req.body; // 'confirm' or 'separate'
  
  const record = await invoiceService.getInvoiceById(req.user._id, recordId);
  
  if (action === 'confirm') {
    record.reviewStatus = 'reviewed';
    record.groupingConfidence = 'manual';
    await record.save();
  } else if (action === 'separate') {
    // Logic to separate documents into a new BillingRecord would go here
    // For now, we'll just mark it as separated
    record.reviewStatus = 'separate';
    await record.save();
  }
  
  res.json({
    success: true,
    data: record
  });
});
