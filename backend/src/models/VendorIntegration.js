import mongoose from 'mongoose';
import encryptionService from '../services/security/encryption.service.js';

const vendorIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vendorName: {
      type: String,
      required: true,
      index: true,
    },
    authType: {
      type: String,
      required: true,
    },
    // We store credentials as a Map so we can hold arbitrary keys (apiKey, accessKeyId, etc.)
    credentials: {
      type: Map,
      of: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['connected', 'invalid_credentials', 'error'],
      default: 'connected',
    },
    lastValidatedAt: {
      type: Date,
      default: Date.now,
    },
    lastSuccessfulSyncAt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
    syncFailures: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to encrypt credentials before saving to the database
vendorIntegrationSchema.pre('save', function () {
  if (this.isModified('credentials')) {
    const creds = this.credentials;
    for (const [key, value] of creds.entries()) {
      if (value) {
        // If it's already encrypted (starts with hex iv + :), skip encrypting again.
        // A naive check: does it look like 32 chars of hex + ':'?
        const isLikelyEncrypted = /^[0-9a-f]{32}:/i.test(value);
        if (!isLikelyEncrypted) {
          const encryptedValue = encryptionService.encrypt(value);
          creds.set(key, encryptedValue);
        }
      }
    }
  }
});

// Helper to decrypt credentials dynamically
vendorIntegrationSchema.methods.getDecryptedCredentials = function () {
  const decrypted = {};
  for (const [key, value] of this.credentials.entries()) {
    try {
      decrypted[key] = encryptionService.decrypt(value);
    } catch (err) {
      console.error(`Failed to decrypt credential ${key} for vendor ${this.vendorName}`);
      decrypted[key] = null;
    }
  }
  return decrypted;
};

// Ensure uniqueness per user and vendor
vendorIntegrationSchema.index({ userId: 1, vendorName: 1 }, { unique: true });

const VendorIntegration = mongoose.model('VendorIntegration', vendorIntegrationSchema);

export default VendorIntegration;
