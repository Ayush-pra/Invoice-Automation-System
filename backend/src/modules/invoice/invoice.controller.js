import * as invoiceService from './invoice.service.js'

const listInvoicesHandler = async (req, res, next) => {
  try {
    const { id: userId, companyId, role } = req.user
    const { platform, status, subscriptionId, startDate, endDate } = req.query

    const invoices = await invoiceService.getInvoices(userId, companyId, role, {
      platform,
      status,
      subscriptionId,
      startDate,
      endDate,
    })

    res.json(invoices)
  } catch (error) {
    next(error)
  }
}

const getInvoiceByIdHandler = async (req, res, next) => {
  try {
    const { id: userId, companyId, role } = req.user
    const { id } = req.params

    const invoice = await invoiceService.getInvoiceById(id, userId, companyId, role)
    res.json(invoice)
  } catch (error) {
    next(error)
  }
}

const triggerFetchHandler = async (req, res, next) => {
  try {
    const { id: userId, companyId, role } = req.user
    const { subscriptionId } = req.params

    const result = await invoiceService.triggerFetchForSubscription(
      subscriptionId,
      userId,
      companyId,
      role
    )

    res.json(result)
  } catch (error) {
    next(error)
  }
}

const createManualInvoiceHandler = async (req, res, next) => {
  try {
    const { id: userId, companyId, role } = req.user
    const pdfFile = req.file

    const invoice = await invoiceService.createManualInvoice(
      req.body,
      pdfFile,
      userId,
      companyId,
      role
    )

    res.status(201).json(invoice) // 201 Created
  } catch (error) {
    next(error)
  }
}

const parseUploadedPDFHandler = async (req, res, next) => {
  try {
    const pdfFile = req.file
    const result = await invoiceService.parseUploadedPDF(pdfFile)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export {
  listInvoicesHandler,
  getInvoiceByIdHandler,
  triggerFetchHandler,
  createManualInvoiceHandler,
  parseUploadedPDFHandler,
}
