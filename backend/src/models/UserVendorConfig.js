import mongoose from 'mongoose';

const userVendorConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    selectedVendors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorCatalog',
      },
    ],
    scanDurationDays: {
      type: Number,
      default: 90,
      min: 7,
      max: 365,
    },
    confidenceThreshold: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const UserVendorConfig = mongoose.model('UserVendorConfig', userVendorConfigSchema);
export default UserVendorConfig;
