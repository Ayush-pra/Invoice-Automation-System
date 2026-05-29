import GmailProvider from './gmail.provider.js';
import OpenAIProvider from './api/openai.provider.js';
import AWSProvider from './api/aws.provider.js';
import CloudflareProvider from './api/cloudflare.provider.js';
import RazorpayProvider from './api/razorpay.provider.js';

/**
 * Provider registry.
 * Maps provider names to their implementation classes.
 * Add new providers here as they are built.
 */
const providers = {
  gmail: GmailProvider,
  OpenAI: OpenAIProvider,
  AWS: AWSProvider,
  Cloudflare: CloudflareProvider,
  Razorpay: RazorpayProvider,
};

/**
 * Factory function to get a provider instance by name.
 * @param {string} providerName - Name of the provider.
 * @returns {BaseInvoiceProvider} Provider instance.
 */
export function getProvider(providerName) {
  const ProviderClass = providers[providerName];

  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(providers).join(', ')}`);
  }

  return new ProviderClass();
}

export default getProvider;
