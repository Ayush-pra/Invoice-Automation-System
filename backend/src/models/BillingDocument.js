import mongoose from 'mongoose';

const billingDocumentSchema = new mongoose.Schema(
  {
    billingRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BillingRecord',
      required: true,
      index: true,
    },
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
    sourceType: {
      type: String,
      required: true,
      enum: ['email', 'api', 'manual'],
      default: 'email',
    },
    sourceProvider: {
      type: String,
      required: true,
      enum: ['gmail', 'outlook', 'stripe', 'aws', 'openai', 'adobe', 'manual'],
      default: 'gmail',
    },
    
    // New source classification
    documentSourceType: {
      type: String,
      enum: [
        'pdf_invoice',
        'invoice_link',
        'receipt_email',
        'membership_confirmation',
        'subscription_renewal',
        'payment_confirmation',
        'order_confirmation',
        'utility_bill',
        'unknown'
      ],
      default: 'unknown'
    },
    
    // Raw email identifiers
    gmailMessageId: {
      type: String,
      default: null,
    },
    emailSubject: {
      type: String,
      default: null,
    },
    emailFrom: {
      type: String,
      default: null,
    },
    emailDate: {
      type: Date,
      default: null,
    },
    
    // Attachments (optional)
    attachmentId: {
      type: String,
      default: null,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    pdfPublicId: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    
    // Hosted Links
    invoiceLink: { type: String, default: null },
    receiptLink: { type: String, default: null },
    billingPortalLink: { type: String, default: null },

    status: {
      type: String,
      enum: ['imported', 'processed', 'failed'],
      default: 'imported',
    },
    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    confidenceBreakdown: {
      domainMatch: { type: Number, default: 0 },
      senderMatch: { type: Number, default: 0 },
      subjectMatch: { type: Number, default: 0 },
      keywordMatch: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// We still want to prevent duplicate imports of the same message/attachment
billingDocumentSchema.index(
  { userId: 1, gmailMessageId: 1, attachmentId: 1 },
  { unique: true, partialFilterExpression: { gmailMessageId: { $ne: null } } }
);

// Index for emails without attachments
billingDocumentSchema.index(
  { userId: 1, gmailMessageId: 1 },
  { unique: true, partialFilterExpression: { attachmentId: null, gmailMessageId: { $ne: null } } }
);

const BillingDocument = mongoose.model('BillingDocument', billingDocumentSchema);
export default BillingDocument;
