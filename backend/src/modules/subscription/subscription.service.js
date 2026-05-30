import prisma from '../../config/db.js'
import { encrypt, decrypt } from '../../utils/encryption.js'
import { getPlatformConfig, getSupportedPlatforms, getFullRegistry } from '../../connectors/registry.js'

/**
 * Create a new subscription for an employee.
 * Validates platform, encrypts credentials, saves to DB.
 */
const create = async (userId, companyId, data) => {
  const { platform, credentials } = data

  // Validate platform exists in registry
  const config = getPlatformConfig(platform) // throws 400 if not found

  // Validate required credential fields
  const missingFields = config.credentialFields.filter(
    (field) => !credentials[field]
  )
  if (missingFields.length > 0) {
    throw Object.assign(
      new Error(`Missing credential fields for ${config.name}: ${missingFields.join(', ')}`),
      { status: 400 }
    )
  }

  // Encrypt credentials before storing
  const encryptedCredentials = encrypt(JSON.stringify(credentials))

  // Map registry method/type to Prisma enums
  const methodMap = { api: 'API', email: 'EMAIL', browser: 'BROWSER', manual: 'MANUAL' }
  const typeMap = { metered: 'METERED', fixed: 'FIXED', annual: 'ANNUAL', subscription_only: 'SUBSCRIPTION_ONLY' }

  const subscription = await prisma.subscription.create({
    data: {
      platform: platform.toLowerCase(),
      method: methodMap[config.method],
      billingType: typeMap[config.type],
      credentials: encryptedCredentials,
      userId,
      companyId,
    },
  })

  return {
    ...subscription,
    credentials: '***encrypted***', // Never return encrypted creds to client
  }
}

/**
 * Get subscriptions for the current employee only.
 * Scoped to userId — employee sees only their own subscriptions.
 */
const getMySubscriptions = async (userId) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return subscriptions.map((sub) => ({
    ...sub,
    credentials: '***encrypted***',
  }))
}

/**
 * Get all subscriptions for the company.
 * Used by COMPANY_ADMIN and FINANCE roles.
 * Scoped to companyId — never exposes other company data.
 */
const getAllCompanySubscriptions = async (companyId) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { companyId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return subscriptions.map((sub) => ({
    ...sub,
    credentials: '***encrypted***',
  }))
}

/**
 * Get a subscription by ID (for internal use by workers/connectors).
 * Returns the full record including encrypted credentials.
 */
const getById = async (id) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  })

  if (!subscription) {
    throw Object.assign(new Error('Subscription not found'), { status: 404 })
  }

  return subscription
}

/**
 * Delete a subscription.
 * Owner (employee) or COMPANY_ADMIN can delete.
 * Scoped to companyId for safety.
 */
const remove = async (id, userId, companyId, userRole) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  })

  if (!subscription) {
    throw Object.assign(new Error('Subscription not found'), { status: 404 })
  }

  // Ensure subscription belongs to the same company
  if (subscription.companyId !== companyId) {
    throw Object.assign(new Error('Access denied'), { status: 403 })
  }

  // Only the owner or a COMPANY_ADMIN can delete
  if (subscription.userId !== userId && userRole !== 'COMPANY_ADMIN') {
    throw Object.assign(new Error('Only the subscription owner or company admin can delete'), { status: 403 })
  }

  await prisma.subscription.delete({ where: { id } })
  return { message: 'Subscription deleted successfully' }
}

/**
 * Get list of supported platforms (for frontend dropdown).
 */
const getPlatforms = () => {
  return getFullRegistry()
}

export { create, getMySubscriptions, getAllCompanySubscriptions, getById, remove, getPlatforms }
