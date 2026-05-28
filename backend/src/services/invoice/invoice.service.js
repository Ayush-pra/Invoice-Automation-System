import Invoice from '../../models/Invoice.js';
import Integration from '../../models/Integration.js';
import { getProvider } from '../providers/index.js';
import { getStorageService } from '../storage/index.js';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Invoice service.
 * Orchestrates the full invoice collection pipeline:
 * Provider → Download → Storage → Database
 */
class InvoiceService {
  /**
   * Sync invoices from all connected providers for a user.
   * Currently supports Gmail only.
   *
   * @param {string} userId - The user's MongoDB ID.
   * @returns {Object} Sync result with counts and errors.
   */
  async syncInvoices(userId) {
    // Find active Gmail integration
    const integration = await Integration.findOne({
      userId,
      providerName: 'gmail',
      status: 'active',
    });

    if (!integration) {
      throw new AppError(
        'Gmail is not connected. Please connect your Gmail account first.',
        400
      );
    }

    // Get existing gmailMessageIds for this user to skip duplicates
    const existingInvoices = await Invoice.find(
      { userId, sourceProvider: 'gmail', gmailMessageId: { $ne: null } },
      { gmailMessageId: 1, attachmentId: 1 }
    ).lean();

    const existingMessageIds = new Set(
      existingInvoices.map((inv) => inv.gmailMessageId)
    );
    const existingKeys = new Set(
      existingInvoices.map((inv) => `${inv.gmailMessageId}:${inv.attachmentId}`)
    );

    // Fetch invoice data from Gmail
    const provider = getProvider('gmail');
    await provider.connect(integration);

    const invoiceDataList = await provider.fetchInvoices(integration, {
      existingMessageIds,
    });

    console.log(
      `📥 Processing ${invoiceDataList.length} new invoice emails...`
    );

    const storage = getStorageService();
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const invoiceData of invoiceDataList) {
      for (const attachment of invoiceData.attachments) {
        // Double-check duplicate at attachment level
        const key = `${invoiceData.messageId}:${attachment.attachmentId}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        try {
          // Upload PDF to Cloudinary
          const uploadResult = await storage.uploadFile(attachment.data, {
            userId: userId.toString(),
            vendorName: invoiceData.vendorName,
            fileName: attachment.fileName,
          });

          // Create invoice record
          await Invoice.create({
            userId,
            vendorName: invoiceData.vendorName,
            invoiceNumber: null, // Will be extracted when pdf-parse is added
            amount: null,
            currency: null,
            invoiceDate: invoiceData.emailDate,
            sourceType: 'email',
            sourceProvider: 'gmail',
            gmailMessageId: invoiceData.messageId,
            attachmentId: attachment.attachmentId,
            pdfUrl: uploadResult.url,
            pdfPublicId: uploadResult.publicId,
            fileName: attachment.fileName,
            emailSubject: invoiceData.emailSubject,
            emailFrom: invoiceData.emailFrom,
            status: 'imported',
          });

          imported++;
          existingKeys.add(key); // Prevent duplicates within the same sync
          console.log(
            `  ✅ Imported: ${invoiceData.vendorName} — ${attachment.fileName}`
          );
        } catch (error) {
          // Handle duplicate key error gracefully
          if (error.code === 11000) {
            skipped++;
            console.log(
              `  ⏭️  Skipped (duplicate): ${invoiceData.vendorName} — ${attachment.fileName}`
            );
          } else {
            errors.push({
              messageId: invoiceData.messageId,
              fileName: attachment.fileName,
              error: error.message,
            });
            console.error(
              `  ❌ Error: ${invoiceData.vendorName} — ${attachment.fileName}: ${error.message}`
            );
          }
        }
      }
    }

    const result = {
      imported,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      total: invoiceDataList.reduce(
        (sum, inv) => sum + inv.attachments.length,
        0
      ),
    };

    console.log(
      `📊 Sync complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`
    );

    return result;
  }

  /**
   * Get paginated invoices for a user.
   */
  async getInvoices(userId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;

    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    const [invoices, total] = await Promise.all([
      Invoice.find({ userId })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments({ userId }),
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single invoice by ID, scoped to a user.
   */
  async getInvoiceById(userId, invoiceId) {
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId,
    }).lean();

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    return invoice;
  }
}

// Export singleton instance
export default new InvoiceService();
