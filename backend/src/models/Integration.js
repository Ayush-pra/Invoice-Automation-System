import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

const integrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerName: {
      type: String,
      required: true,
      enum: ['gmail', 'outlook', 'stripe', 'aws', 'openai', 'adobe'],
    },
    type: {
      type: String,
      required: true,
      enum: ['email', 'billing', 'cloud'],
    },
    accessToken: {
      type: String,
      required: true,
      set: encrypt,
      get: decrypt,
    },
    refreshToken: {
      type: String,
      default: null,
      set: (val) => (val ? encrypt(val) : null),
      get: (val) => (val ? decrypt(val) : null),
    },
    tokenExpiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { getters: false }, // Never expose decrypted tokens in JSON responses
    toObject: { getters: true },
  }
);

// Compound unique index: one integration per provider per user
integrationSchema.index({ userId: 1, providerName: 1 }, { unique: true });

const Integration = mongoose.model('Integration', integrationSchema);
export default Integration;
