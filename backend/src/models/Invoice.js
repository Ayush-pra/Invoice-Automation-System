import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vendorName: {
      type: String,
      default: 'Unknown',
      trim: true,
    },
    invoiceNumber: {
      type: String,
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
    invoiceDate: {
      type: Date,
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
    gmailMessageId: {
      type: String,
      default: null,
    },
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
    emailSubject: {
      type: String,
      default: null,
    },
    emailFrom: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['imported', 'processed', 'failed'],
      default: 'imported',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: prevent duplicate imports of same attachment from same email per user
invoiceSchema.index(
  { userId: 1, gmailMessageId: 1, attachmentId: 1 },
  { unique: true, partialFilterExpression: { gmailMessageId: { $ne: null } } }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
