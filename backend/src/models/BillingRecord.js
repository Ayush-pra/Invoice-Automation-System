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
    productName: {
      type: String,
      default: null,
      trim: true,
    },

    // --- Record Type (Evidence Quality Tag) ---
    recordType: {
      type: String,
      enum: ['invoice_pdf', 'invoice_link', 'billing_info_only'],
      default: 'billing_info_only',
    },

    // --- Financial Data ---
    amount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      enum: ['INR', 'USD', null],
      default: null,
      uppercase: true,
    },

    // --- Unique Identifiers (for deduplication) ---
    invoiceNumber: { type: String, default: null },
    orderNumber: { type: String, default: null },
    transactionId: { type: String, default: null },
    receiptNumber: { type: String, default: null },
    paymentReference: { type: String, default: null },
    customerTransactionId: { type: String, default: null },
    merchantTransactionId: { type: String, default: null },
    utr: { type: String, default: null },
    rrn: { type: String, default: null },
    paymentGatewayReference: { type: String, default: null },

    // --- Line Items ---
    lineItems: [
      {
        name: { type: String, required: true },
        amount: { type: Number, required: true },
      }
    ],

    // --- Dates ---
    transactionDate: {
      type: Date,
      default: null,
    },
    billingDate: {
      type: Date,
      default: null,
    },
    billingPeriod: {
      type: String,
      default: null,
      trim: true,
    },

    // --- Subscription / Membership ---
    subscriptionName: {
      type: String,
      default: null,
      trim: true,
    },
    membershipName: {
      type: String,
      default: null,
      trim: true,
    },
    paymentMethod: {
      type: String,
      default: null,
      trim: true,
    },

    // --- Denormalized Quick-Access Fields ---
    pdfUrl: {
      type: String,
      default: null,
    },
    invoiceUrl: {
      type: String,
      default: null,
    },
    emailSubject: {
      type: String,
      default: null,
    },
    senderEmail: {
      type: String,
      default: null,
    },

    // --- Email Tracking ---
    rawEmailIds: {
      type: [String],
      default: [],
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

// Index for deduplication queries
billingRecordSchema.index({ userId: 1, vendorId: 1 });

const BillingRecord = mongoose.model('BillingRecord', billingRecordSchema);
export default BillingRecord;
