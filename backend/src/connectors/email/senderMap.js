/**
 * Known billing email senders mapped to SaaS platform identifiers.
 */
const SENDER_MAP = {
  'billing@razorpay.com':        'razorpay',
  'noreply@razorpay.com':        'razorpay',
  'noreply@github.com':          'github',
  'billing@github.com':          'github',
  'invoices@figma.com':          'figma',
  'billing@figma.com':           'figma',
  'billing@adobe.com':           'adobe',
  'noreply@adobe.com':           'adobe',
  'aws-billing@amazon.com':      'aws',
  'billing@openai.com':          'openai',
  'noreply@notion.so':           'notion',
  'billing@vercel.com':          'vercel',
  'noreply@netlify.com':         'netlify',
  'accounts@google.com':         'google',
  'billing@digitalocean.com':    'digitalocean',
}

/**
 * Clean and extract email address from raw "From" header (e.g. "Github Billing <noreply@github.com>" -> "noreply@github.com")
 * 
 * @param {string} rawFrom - Raw sender header string
 * @returns {string} Cleaned email address
 */
const cleanSenderEmail = (rawFrom) => {
  if (!rawFrom) return ''
  const match = rawFrom.match(/<([^>]+)>/)
  return (match ? match[1] : rawFrom).trim().toLowerCase()
}

/**
 * Find the platform name associated with a sender email address.
 * 
 * @param {string} emailAddress - Raw or clean email address
 * @returns {string|null} Platform identifier or null if unknown
 */
const getPlatformFromSender = (emailAddress) => {
  const cleanEmail = cleanSenderEmail(emailAddress)
  return SENDER_MAP[cleanEmail] || null
}

/**
 * Get a flat array of all registered sender email addresses.
 * 
 * @returns {string[]}
 */
const getAllSenderEmails = () => {
  return Object.keys(SENDER_MAP)
}

/**
 * Check if the sender email address is registered as a known billing source.
 * 
 * @param {string} emailAddress - Raw or clean email address
 * @returns {boolean}
 */
const isKnownBillingSender = (emailAddress) => {
  const cleanEmail = cleanSenderEmail(emailAddress)
  return cleanEmail in SENDER_MAP
}

export {
  SENDER_MAP,
  getPlatformFromSender,
  getAllSenderEmails,
  isKnownBillingSender,
  cleanSenderEmail,
}
