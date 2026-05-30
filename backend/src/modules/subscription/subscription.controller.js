import * as subscriptionService from './subscription.service.js'
import { fetchInvoicesForSubscription } from '../../connectors/connectorManager.js'
import { getById } from './subscription.service.js'

/**
 * POST /api/subscriptions — Create a new subscription
 */
const create = async (req, res) => {
  const { id: userId, companyId } = req.user
  const data = await subscriptionService.create(userId, companyId, req.body)
  res.status(201).json(data)
}

/**
 * GET /api/subscriptions/my — Get current employee's subscriptions
 */
const getMySubscriptions = async (req, res) => {
  const data = await subscriptionService.getMySubscriptions(req.user.id)
  res.json(data)
}

/**
 * GET /api/subscriptions — Get all company subscriptions (admin/finance)
 */
const getAllCompanySubscriptions = async (req, res) => {
  const data = await subscriptionService.getAllCompanySubscriptions(req.user.companyId)
  res.json(data)
}

/**
 * DELETE /api/subscriptions/:id — Delete a subscription
 */
const remove = async (req, res) => {
  const { id: userId, companyId, role } = req.user
  const data = await subscriptionService.remove(req.params.id, userId, companyId, role)
  res.json(data)
}

/**
 * GET /api/subscriptions/platforms — Get list of supported platforms
 */
const getPlatforms = (req, res) => {
  const data = subscriptionService.getPlatforms()
  res.json(data)
}

/**
 * POST /api/subscriptions/:id/fetch — Manually trigger invoice fetch
 * Useful for testing connectors end-to-end
 */
const triggerFetch = async (req, res) => {
  const { companyId } = req.user
  const subscription = await getById(req.params.id)

  // Ensure subscription belongs to the same company
  if (subscription.companyId !== companyId) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const invoices = await fetchInvoicesForSubscription(subscription)
  res.json({
    platform: subscription.platform,
    invoiceCount: invoices.length,
    invoices: invoices.map(inv => ({
      ...inv,
      pdfBuffer: inv.pdfBuffer ? `<Buffer ${inv.pdfBuffer.length} bytes>` : null,
    })),
  })
}

export { create, getMySubscriptions, getAllCompanySubscriptions, remove, getPlatforms, triggerFetch }
