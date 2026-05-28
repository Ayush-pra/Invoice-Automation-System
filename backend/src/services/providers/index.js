import GmailProvider from './gmail.provider.js';

/**
 * Provider registry.
 * Maps provider names to their implementation classes.
 * Add new providers here as they are built.
 */
const providers = {
  gmail: GmailProvider,
  // Future providers:
  // outlook: OutlookProvider,
  // stripe: StripeProvider,
  // aws: AwsProvider,
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
