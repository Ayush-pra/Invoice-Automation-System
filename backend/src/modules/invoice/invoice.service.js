import prisma from '../../config/db.js'
import { addInvoiceJob } from '../../queues/invoice.queue.js'
import { uploadPDF } from '../../utils/cloudinary.js'
import { parsePDF } from '../../utils/pdfParser.js'

/**
 * Get all invoices based on user role and filters.
 * Scope: 
 * - EMPLOYEE: sees only invoices for subscriptions they own.
 * - COMPANY_ADMIN/FINANCE: sees all invoices for the entire company.
 */
const getInvoices = async (userId, companyId, role, filters = {}) => {
  const where = {
    companyId,
  }

  // Enforce role-based access scoping
  if (role === 'EMPLOYEE') {
    where.subscription = {
      userId,
    }
  }

  // Apply filters
  if (filters.platform) {
    where.platform = filters.platform.toLowerCase()
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.subscriptionId) {
    where.subscriptionId = filters.subscriptionId
  }

  if (filters.startDate || filters.endDate) {
    where.billingDate = {}
    if (filters.startDate) {
      where.billingDate.gte = new Date(filters.startDate)
    }
    if (filters.endDate) {
      where.billingDate.lte = new Date(filters.endDate)
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      subscription: {
        select: {
          id: true,
          platform: true,
          method: true,
          billingType: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      billingDate: 'desc',
    },
  })

  return invoices
}

/**
 * Get invoice details by ID.
 * Scope:
 * - Must belong to user's company.
 * - If EMPLOYEE, must belong to a subscription owned by the employee.
 */
const getInvoiceById = async (id, userId, companyId, role) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      subscription: {
        select: {
          userId: true,
        },
      },
    },
  })

  if (!invoice) {
    throw Object.assign(new Error('Invoice not found'), { status: 404 })
  }

  if (invoice.companyId !== companyId) {
    throw Object.assign(new Error('Access denied'), { status: 403 })
  }

  if (role === 'EMPLOYEE' && invoice.subscription.userId !== userId) {
    throw Object.assign(new Error('Access denied'), { status: 403 })
  }

  return invoice
}

/**
 * Trigger background fetch/sync immediately for a specific subscription.
 */
const triggerFetchForSubscription = async (subscriptionId, userId, companyId, role) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  })

  if (!subscription) {
    throw Object.assign(new Error('Subscription not found'), { status: 404 })
  }

  if (subscription.companyId !== companyId) {
    throw Object.assign(new Error('Access denied'), { status: 403 })
  }

  if (role === 'EMPLOYEE' && subscription.userId !== userId) {
    throw Object.assign(new Error('Access denied to this subscription'), { status: 403 })
  }

  if (subscription.method === 'MANUAL') {
    throw Object.assign(new Error('Cannot trigger automatic fetch for MANUAL subscription'), { status: 400 })
  }

  // Add fetch job to BullMQ queue immediately
  const job = await addInvoiceJob({
    subscriptionId: subscription.id,
    userId: subscription.userId,
    companyId: subscription.companyId,
    platform: subscription.platform,
    method: subscription.method,
    triggerType: 'manual',
  })

  return {
    message: 'Invoice fetch job queued successfully',
    jobId: job.id,
  }
}

/**
 * Trigger manual extraction & creation of invoice with optional uploaded PDF.
 */
const createManualInvoice = async (data, pdfFile, userId, companyId, role) => {
  const { subscriptionId, amount, currency, billingDate, invoiceId } = data

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  })

  if (!subscription) {
    throw Object.assign(new Error('Subscription not found'), { status: 404 })
  }

  if (subscription.companyId !== companyId) {
    throw Object.assign(new Error('Access denied'), { status: 403 })
  }

  if (role === 'EMPLOYEE' && subscription.userId !== userId) {
    throw Object.assign(new Error('Access denied to this subscription'), { status: 403 })
  }

  const externalId = invoiceId || `manual-${Date.now()}`

  // Check duplicate
  const existing = await prisma.invoice.findFirst({
    where: {
      companyId,
      externalId,
    },
  })

  if (existing) {
    throw Object.assign(new Error(`Invoice with ID ${externalId} already exists`), { status: 400 })
  }

  let pdfUrl = null

  if (pdfFile) {
    const dateObj = new Date(billingDate || Date.now())
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const folderPath = `invoices/${companyId}/${year}/${month}`
    const cleanFilename = `${subscription.platform}-${externalId.replace(/[^a-zA-Z0-9-_]/g, '')}`

    const uploadResult = await uploadPDF(pdfFile.buffer, folderPath, cleanFilename)
    pdfUrl = uploadResult.url
  }

  const invoice = await prisma.invoice.create({
    data: {
      externalId,
      platform: subscription.platform,
      amount: parseFloat(amount) || 0.0,
      currency: currency || 'USD',
      billingDate: billingDate ? new Date(billingDate) : new Date(),
      pdfUrl,
      status: 'PROCESSED',
      subscriptionId: subscription.id,
      companyId,
      rawData: {
        createdVia: 'manual_upload',
        uploaderId: userId,
        originalFilename: pdfFile ? pdfFile.originalname : null,
      },
    },
  })

  return invoice
}

/**
 * Parse an uploaded PDF to return extracted fields (dry run pre-fill).
 */
const parseUploadedPDF = async (pdfFile) => {
  if (!pdfFile || !pdfFile.buffer) {
    throw Object.assign(new Error('No PDF file provided for parsing'), { status: 400 })
  }

  const parsed = await parsePDF(pdfFile.buffer)
  return {
    amount: parsed.amount,
    currency: parsed.currency,
    invoiceId: parsed.invoiceId,
    date: parsed.date,
    platformName: parsed.platformName,
  }
}

export {
  getInvoices,
  getInvoiceById,
  triggerFetchForSubscription,
  createManualInvoice,
  parseUploadedPDF,
}
