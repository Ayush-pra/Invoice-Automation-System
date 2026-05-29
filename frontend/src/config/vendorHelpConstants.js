export const VENDOR_HELP_CONTENT = {
  OpenAI: {
    description: "Connect OpenAI to automatically import your API usage billing and subscription invoices.",
    required: ["API Key"],
    steps: [
      "Login to the OpenAI Platform dashboard.",
      "Navigate to the API Keys section.",
      "Click 'Create new secret key'.",
      "Copy the generated key.",
      "Paste the key below to connect."
    ],
    docLink: "https://platform.openai.com/api-keys"
  },
  AWS: {
    description: "Connect Amazon Web Services to import your monthly cloud infrastructure invoices and usage reports.",
    required: ["Access Key ID", "Secret Access Key"],
    steps: [
      "Open the AWS Management Console.",
      "Go to IAM (Identity and Access Management).",
      "Navigate to Users, select your user, and click 'Security credentials'.",
      "Under Access keys, click 'Create access key'.",
      "Copy both the Access Key ID and Secret Access Key."
    ],
    docLink: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html"
  },
  Cloudflare: {
    description: "Connect Cloudflare to import your domain renewals, zero trust subscriptions, and zone billing.",
    required: ["API Token"],
    steps: [
      "Log in to the Cloudflare Dashboard.",
      "Go to My Profile -> API Tokens.",
      "Click 'Create Token'.",
      "Select the 'Billing' read permissions template if available, or create a custom token with Billing Read permissions.",
      "Copy the generated API Token."
    ],
    docLink: "https://dash.cloudflare.com/profile/api-tokens"
  },
  Razorpay: {
    description: "Connect Razorpay to automatically import platform fees, payment links, and service subscriptions.",
    required: ["Key ID", "Key Secret"],
    steps: [
      "Log in to your Razorpay Dashboard.",
      "Go to Settings -> API Keys.",
      "Click 'Generate Key Pair'.",
      "Copy the Key ID and Key Secret shown in the modal.",
      "Paste them below."
    ],
    docLink: "https://razorpay.com/docs/api/authentication/"
  },
  Vercel: {
    description: "Connect Vercel to track your team deployments, edge functions, and bandwidth billing.",
    required: ["Personal Access Token"],
    steps: [
      "Log in to the Vercel Dashboard.",
      "Go to Account Settings -> Tokens.",
      "Create a new token with at least 'View' scope for Billing.",
      "Copy the generated Personal Access Token."
    ],
    docLink: "https://vercel.com/account/tokens"
  },
  GitHub: {
    description: "Connect GitHub to track your Copilot, Actions, and team seat billing records.",
    required: ["Personal Access Token"],
    steps: [
      "Go to GitHub Settings.",
      "Navigate to Developer Settings -> Personal access tokens.",
      "Generate a new token (classic or fine-grained).",
      "Ensure the token has permissions to read billing.",
      "Copy the token."
    ],
    docLink: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
  }
};
