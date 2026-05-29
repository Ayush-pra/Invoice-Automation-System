export const vendorCredentialRegistry = {
  OpenAI: {
    authType: 'apiKey',
    fields: [
      {
        name: 'apiKey',
        label: 'OpenAI API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-proj-...',
      },
    ],
  },
  AWS: {
    authType: 'accessKey',
    fields: [
      {
        name: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: true,
        placeholder: 'AKIA...',
      },
      {
        name: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    ],
  },
  Cloudflare: {
    authType: 'apiToken',
    fields: [
      {
        name: 'apiToken',
        label: 'API Token',
        type: 'password',
        required: true,
        placeholder: 'Your Cloudflare API Token',
      },
    ],
  },
  Razorpay: {
    authType: 'basicAuth',
    fields: [
      {
        name: 'keyId',
        label: 'Razorpay Key ID',
        type: 'text',
        required: true,
        placeholder: 'rzp_live_...',
      },
      {
        name: 'keySecret',
        label: 'Razorpay Key Secret',
        type: 'password',
        required: true,
        placeholder: 'Your Razorpay Key Secret',
      },
    ],
  },
  Vercel: {
    authType: 'personalAccessToken',
    fields: [
      {
        name: 'token',
        label: 'Personal Access Token',
        type: 'password',
        required: true,
        placeholder: 'Your Vercel Token',
      },
    ],
  },
  GitHub: {
    authType: 'personalAccessToken',
    fields: [
      {
        name: 'token',
        label: 'Personal Access Token',
        type: 'password',
        required: true,
        placeholder: 'ghp_...',
      },
    ],
  },
};

/**
 * Returns required fields for a specific vendor, or null if not supported.
 */
export const getVendorCredentialFields = (vendorName) => {
  // Try exact match first
  if (vendorCredentialRegistry[vendorName]) {
    return vendorCredentialRegistry[vendorName];
  }
  
  // Try case insensitive match
  const key = Object.keys(vendorCredentialRegistry).find(
    (k) => k.toLowerCase() === vendorName.toLowerCase()
  );
  
  return key ? vendorCredentialRegistry[key] : null;
};
