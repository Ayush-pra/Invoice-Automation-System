const vendorCapabilities = {
  OpenAI: {
    supportsApi: true,
    supportsEmail: true,
  },
  AWS: {
    supportsApi: true,
    supportsEmail: true,
  },
  Cloudflare: {
    supportsApi: true,
    supportsEmail: true,
  },
  Razorpay: {
    supportsApi: true,
    supportsEmail: true,
    priority: "api"
  },
  'Airtel Digital TV': {
    supportsApi: false,
    supportsEmail: true,
  },
  'Airtel Broadband': {
    supportsApi: false,
    supportsEmail: true,
  },
  'Airtel Postpaid': {
    supportsApi: false,
    supportsEmail: true,
  },
  'Airtel Black': {
    supportsApi: false,
    supportsEmail: true,
  },
  'YouTube Premium': {
    supportsApi: false,
    supportsEmail: true,
  },
  'Google AI Pro': {
    supportsApi: false,
    supportsEmail: true,
  },
  Figma: {
    supportsApi: false, // Maybe in future
    supportsEmail: true,
  },
  Canva: {
    supportsApi: false,
    supportsEmail: true,
  },
  Notion: {
    supportsApi: false,
    supportsEmail: true,
  },
  Vercel: {
    supportsApi: false, // Not implemented yet
    supportsEmail: true,
  },
  GitHub: {
    supportsApi: false, // Not implemented yet
    supportsEmail: true,
  },
  Slack: {
    supportsApi: false,
    supportsEmail: true,
  },
  Zoom: {
    supportsApi: false,
    supportsEmail: true,
  },
};

/**
 * Normalizes vendor name to match registry keys.
 */
const getVendorCapability = (vendorName) => {
  // Try exact match first
  if (vendorCapabilities[vendorName]) {
    return vendorCapabilities[vendorName];
  }
  
  // Try case insensitive match
  const key = Object.keys(vendorCapabilities).find(
    (k) => k.toLowerCase() === vendorName.toLowerCase()
  );
  
  if (key) return vendorCapabilities[key];

  // Default to email only if unknown vendor
  return {
    supportsApi: false,
    supportsEmail: true,
  };
};

export { vendorCapabilities, getVendorCapability };
