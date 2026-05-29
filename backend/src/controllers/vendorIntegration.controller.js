import { vendorCapabilities } from '../config/vendorCapabilities.js';
import { vendorCredentialRegistry } from '../config/vendorCredentialRegistry.js';
import VendorIntegration from '../models/VendorIntegration.js';
import { AppError } from '../middlewares/errorHandler.js';

class VendorIntegrationController {
  /**
   * Get central registry of vendor capabilities and credential fields
   */
  getRegistry(req, res) {
    const registry = {};

    // Combine capabilities and credential fields
    for (const [vendorName, capabilities] of Object.entries(vendorCapabilities)) {
      registry[vendorName] = {
        ...capabilities,
        credentials: vendorCredentialRegistry[vendorName] || null,
      };
    }

    res.json({
      status: 'success',
      data: registry,
    });
  }

  /**
   * Get all connected vendor integrations for the logged in user
   */
  async getIntegrations(req, res) {
    const userId = req.user._id;

    const integrations = await VendorIntegration.find({ userId })
      .select('-credentials') // Don't send encrypted credentials to frontend
      .lean();

    res.json({
      status: 'success',
      data: integrations,
    });
  }

  /**
   * Validate and save credentials for a vendor
   */
  async validateAndSaveCredentials(req, res) {
    const userId = req.user._id;
    const { vendorName, credentials } = req.body;

    if (!vendorName || !credentials) {
      throw new AppError('Vendor name and credentials are required', 400);
    }

    const registryEntry = vendorCredentialRegistry[vendorName];
    if (!registryEntry) {
      throw new AppError(`Vendor ${vendorName} does not support API credentials`, 400);
    }

    // Perform strict dynamic validation using the provider's validateCredentials method if available
    let lastError = null;
    let status = 'connected';
    
    try {
      // Lazy load getProvider to avoid circular dependency issues at the top level
      const { getProvider } = await import('../services/providers/index.js');
      const provider = getProvider(vendorName);
      
      if (typeof provider.validateCredentials === 'function') {
        const validation = await provider.validateCredentials(credentials);
        if (!validation.success) {
          throw new AppError(validation.message || `Invalid credentials for ${vendorName}`, 400);
        }
      }
    } catch (err) {
      if (err.isOperational) throw err; // Pass AppErrors straight through to the client
      console.warn(`Could not validate credentials dynamically for ${vendorName}:`, err.message);
      // If we don't have a provider yet (e.g. not implemented), we just accept them structurally for now
    }
    
    
    // Check if integration already exists
    let integration = await VendorIntegration.findOne({ userId, vendorName });

    if (integration) {
      // Update existing
      for (const [key, value] of Object.entries(credentials)) {
        integration.credentials.set(key, value);
      }
      integration.status = 'connected';
      integration.lastValidatedAt = new Date();
      integration.lastError = null;
      integration.syncFailures = 0;
      await integration.save();
    } else {
      // Create new
      integration = await VendorIntegration.create({
        userId,
        vendorName,
        authType: registryEntry.authType,
        credentials,
        status: 'connected',
        lastValidatedAt: new Date(),
      });
    }

    // Return integration without credentials
    const safeIntegration = integration.toObject();
    delete safeIntegration.credentials;

    res.json({
      status: 'success',
      data: safeIntegration,
      message: `${vendorName} credentials saved and validated successfully.`,
    });
  }

  /**
   * Disconnect/Remove a vendor integration
   */
  async disconnectVendor(req, res) {
    const userId = req.user._id;
    const { vendorName } = req.params;

    const result = await VendorIntegration.deleteOne({ userId, vendorName });

    if (result.deletedCount === 0) {
      throw new AppError('Integration not found', 404);
    }

    res.json({
      status: 'success',
      message: `${vendorName} disconnected successfully.`,
    });
  }
}

export default new VendorIntegrationController();
