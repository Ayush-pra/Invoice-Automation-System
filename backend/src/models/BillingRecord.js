import mongoose from 'mongoose';

const billingRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorCatalog',
      default: null,
    },
    vendorName: {
      type: String,
      default: 'Unknown',
      trim: true,
    },
    transactionDate: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: null,
      uppercase: true,
    },
    
    // Grouping & Confidence
    groupingConfidence: {
      type: String,
      enum: ['high', 'medium', 'low', 'manual'],
      default: 'low',
    },
    reviewStatus: {
      type: String,
      enum: ['auto_merged', 'needs_review', 'reviewed', 'separate'],
      default: 'separate',
    },
    
    // Evidence (Identifiers used for grouping)
    invoiceNumber: { type: String, default: null },
    orderNumber: { type: String, default: null },
    transactionId: { type: String, default: null },
    paymentReference: { type: String, default: null },
    
    // Completeness Score (0-100)
    recordCompleteness: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for attached documents
billingRecordSchema.virtual('documents', {
  ref: 'BillingDocument',
  localField: '_id',
  foreignField: 'billingRecordId',
});

// Ensure virtuals are included when converting to JSON/Object
billingRecordSchema.set('toObject', { virtuals: true });
billingRecordSchema.set('toJSON', { virtuals: true });

const BillingRecord = mongoose.model('BillingRecord', billingRecordSchema);
export default BillingRecord;
