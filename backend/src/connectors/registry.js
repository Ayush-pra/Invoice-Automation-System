/**
 * Platform Registry — Central configuration map for all supported SaaS platforms.
 * 
 * Each entry defines:
 *   - method: how invoices are fetched (api, email, browser, manual)
 *   - type: billing model (metered, fixed, annual, subscription_only)
 *   - connector: relative path to the connector module
 *   - senderEmails: email addresses used for invoice email parsing (Layer 2)
 */
const PLATFORM_REGISTRY = {
  razorpay: {
    name: 'Razorpay',
    method: 'api',
    type: 'metered',
    connector: './api/razorpay.connector.js',
    senderEmails: ['noreply@razorpay.com'],
    credentialFields: ['keyId', 'keySecret'],
  },
  openai: {
    name: 'OpenAI',
    method: 'api',
    type: 'metered',
    connector: './api/openai.connector.js',
    senderEmails: ['billing@openai.com'],
    credentialFields: ['apiKey'],
  },
  github: {
    name: 'GitHub',
    method: 'api',
    type: 'fixed',
    connector: './api/github.connector.js',
    senderEmails: ['billing@github.com'],
    credentialFields: ['token', 'orgName'],
  },
  figma: {
    name: 'Figma',
    method: 'browser',
    type: 'fixed',
    connector: './browser/figma.connector.js',
    senderEmails: ['no-reply@figma.com'],
    credentialFields: ['email', 'password'],
  },
  aws: {
    name: 'AWS',
    method: 'api',
    type: 'metered',
    connector: './api/aws.connector.js',
    senderEmails: ['invoices@amazon.com'],
    credentialFields: ['accessKeyId', 'secretAccessKey'],
  },
  adobe: {
    name: 'Adobe',
    method: 'email',
    type: 'annual',
    senderEmails: ['billing@adobe.com'],
    credentialFields: [],
  },
  notion: {
    name: 'Notion',
    method: 'email',
    type: 'fixed',
    senderEmails: ['noreply@notion.so'],
    credentialFields: [],
  },
  vercel: {
    name: 'Vercel',
    method: 'email',
    type: 'fixed',
    senderEmails: ['billing@vercel.com'],
    credentialFields: [],
  },
}

/**
 * Get configuration for a specific platform
 * @param {string} platformName - lowercase platform name (e.g., 'openai')
 * @returns {Object} platform config
 * @throws {Error} if platform not found
 */
const getPlatformConfig = (platformName) => {
  const config = PLATFORM_REGISTRY[platformName.toLowerCase()]
  if (!config) {
    throw Object.assign(
      new Error(`Platform '${platformName}' is not supported. Supported: ${getSupportedPlatforms().join(', ')}`),
      { status: 400 }
    )
  }
  return config
}

/**
 * Get list of all supported platform names
 * @returns {string[]}
 */
const getSupportedPlatforms = () => {
  return Object.keys(PLATFORM_REGISTRY)
}

/**
 * Get full registry (for admin dashboard display)
 * @returns {Object}
 */
const getFullRegistry = () => {
  return Object.entries(PLATFORM_REGISTRY).map(([key, config]) => ({
    id: key,
    name: config.name,
    method: config.method,
    type: config.type,
    credentialFields: config.credentialFields,
  }))
}

export { PLATFORM_REGISTRY, getPlatformConfig, getSupportedPlatforms, getFullRegistry }
