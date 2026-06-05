import mongoose from 'mongoose';

const vendorCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    domains: {
      type: [String],
      default: [],
    },
    senderPatterns: {
      type: [String],
      default: [],
    },
    subjectPatterns: {
      type: [String],
      default: [],
    },
    invoiceKeywords: {
      type: [String],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for search
vendorCatalogSchema.index({ name: 'text', category: 'text', aliases: 'text' });
vendorCatalogSchema.index({ category: 1 });
vendorCatalogSchema.index({ active: 1 });

const VendorCatalog = mongoose.model('VendorCatalog', vendorCatalogSchema);
export default VendorCatalog;
