import BillingRecord from '../../models/BillingRecord.js';
import BillingDocument from '../../models/BillingDocument.js';
import Integration from '../../models/Integration.js';
import UserVendorConfig from '../../models/UserVendorConfig.js';
import { getProvider } from '../providers/index.js';
import { getStorageService } from '../storage/index.js';
import groupingService from './grouping.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

class InvoiceService {
  /**
   * Sync invoices using the Vendor-First Architecture & Evidence-based grouping.
   */
  async syncInvoices(userId) {
    const integration = await Integration.findOne({
      userId,
      providerName: 'gmail',
      status: 'active',
    });

    if (!integration) {
      throw new AppError('Gmail is not connected. Please connect your Gmail account first.', 400);
    }

    // 1. Load user's vendor config
    const userConfig = await UserVendorConfig.findOne({ userId }).populate('selectedVendors');
    
    if (!userConfig || !userConfig.selectedVendors || userConfig.selectedVendors.length === 0) {
      throw new AppError('No vendors selected. Please configure your vendors in Settings before syncing.', 400);
    }

    // Get existing gmailMessageIds for this user to skip duplicates
    const existingDocuments = await BillingDocument.find(
      { userId, sourceProvider: 'gmail', gmailMessageId: { $ne: null } },
      { gmailMessageId: 1, attachmentId: 1 }
    ).lean();

    const existingMessageIds = new Set(existingDocuments.map((doc) => doc.gmailMessageId));
    const existingKeys = new Set(existingDocuments.map((doc) => `${doc.gmailMessageId}:${doc.attachmentId || 'no-attachment'}`));

    // 2. Fetch invoice data from Gmail
    const provider = getProvider('gmail');
    await provider.connect(integration);

    const { invoices: invoiceDataList, stats } = await provider.fetchInvoices(integration, {
      vendors: userConfig.selectedVendors,
      scanDurationDays: userConfig.scanDurationDays,
      confidenceThreshold: userConfig.confidenceThreshold,
      existingMessageIds,
    });

    console.log(`📥 Processing ${invoiceDataList.length} new raw email events...`);

    const storage = getStorageService();
    let imported = 0;
    let skipped = 0;
    const errors = [];

    // 3. Store valid invoices/documents
    for (const invoiceData of invoiceDataList) {
      const itemsToProcess = [];
      if (invoiceData.attachments && invoiceData.attachments.length > 0) {
        for (const attachment of invoiceData.attachments) {
          itemsToProcess.push({ ...invoiceData, attachment });
        }
      } else {
        itemsToProcess.push({ ...invoiceData, attachment: null });
      }

      for (const item of itemsToProcess) {
        const attachId = item.attachment ? item.attachment.attachmentId : 'no-attachment';
        const key = `${item.messageId}:${attachId}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        try {
          let uploadResult = null;
          if (item.attachment) {
            uploadResult = await storage.uploadFile(item.attachment.data, {
              userId: userId.toString(),
              vendorName: item.vendorName,
              fileName: item.attachment.fileName,
            });
          }

          // We create a temporary Document object to pass to GroupingService
          // We won't save it to DB until we have the billingRecordId
          const documentData = {
            userId,
            vendorId: item.vendorId,
            sourceType: 'email',
            sourceProvider: 'gmail',
            documentSourceType: item.documentSourceType,
            gmailMessageId: item.messageId,
            emailSubject: item.emailSubject,
            emailFrom: item.emailFrom,
            emailDate: item.emailDate,
            snippet: item.snippet,
            attachmentId: item.attachment ? item.attachment.attachmentId : null,
            pdfUrl: uploadResult ? uploadResult.url : null,
            pdfPublicId: uploadResult ? uploadResult.publicId : null,
            fileName: item.attachment ? item.attachment.fileName : null,
            invoiceLink: item.invoiceLink,
            status: 'imported',
            confidenceScore: item.confidenceScore,
            confidenceBreakdown: item.confidenceBreakdown,
          };

          // 4. Grouping logic
          await groupingService.processDocument(documentData, { _id: item.vendorId, name: item.vendorName });

          // Now save the document
          await BillingDocument.create(documentData);

          imported++;
          existingKeys.add(key);
          console.log(`  ✅ Imported: ${item.vendorName} — (Score: ${item.confidenceScore})`);
        } catch (error) {
          if (error.code === 11000) {
            skipped++;
            console.log(`  ⏭️ Skipped (duplicate): ${item.vendorName}`);
          } else {
            errors.push({
              messageId: item.messageId,
              error: error.message,
            });
            console.error(`  ❌ Error: ${item.vendorName}: ${error.message}`);
          }
        }
      }
    }

    // Update last sync time
    userConfig.lastSyncAt = new Date();
    await userConfig.save();

    return {
      imported,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      vendorStats: stats
    };
  }

  async getInvoices(userId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'transactionDate', order = 'desc', vendorId, isRead } = options;

    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    const query = { userId };
    if (vendorId) query.vendorId = vendorId;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const [records, total] = await Promise.all([
      BillingRecord.find(query)
        .populate('documents')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      BillingRecord.countDocuments(query),
    ]);

    // Format output to be similar to old frontend shape if needed, or frontend needs updating
    return {
      invoices: records, // For compatibility with frontend expecting 'invoices' array
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoiceById(userId, recordId) {
    const record = await BillingRecord.findOne({
      _id: recordId,
      userId,
    }).populate('documents').lean();

    if (!record) {
      throw new AppError('Record not found', 404);
    }

    return record;
  }

  async updateReadStatus(userId, recordId, isRead) {
    const record = await BillingRecord.findOneAndUpdate(
      { _id: recordId, userId },
      { $set: { isRead } },
      { new: true }
    );
    if (!record) {
      throw new AppError('Record not found', 404);
    }
    return record;
  }

  async deleteInvoice(userId, recordId) {
    const record = await BillingRecord.findOne({ _id: recordId, userId });
    
    if (!record) {
      throw new AppError('Record not found', 404);
    }

    const documents = await BillingDocument.find({ billingRecordId: recordId });
    const storage = getStorageService();

    // Delete documents & PDFs
    for (const doc of documents) {
      if (doc.pdfPublicId) {
        try {
          await storage.deleteFile(doc.pdfPublicId);
        } catch (error) {
          console.error(`Failed to delete file from storage: ${error.message}`);
        }
      }
      await BillingDocument.deleteOne({ _id: doc._id });
    }

    await BillingRecord.deleteOne({ _id: recordId, userId });
    return { success: true, message: 'Record permanently deleted' };
  }

  async bulkDeleteInvoices(userId, recordIds) {
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      throw new AppError('No record IDs provided', 400);
    }

    const records = await BillingRecord.find({ _id: { $in: recordIds }, userId });
    
    if (records.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const storage = getStorageService();
    let deletedCount = 0;
    
    for (const record of records) {
      const documents = await BillingDocument.find({ billingRecordId: record._id });
      for (const doc of documents) {
        if (doc.pdfPublicId) {
          try {
            await storage.deleteFile(doc.pdfPublicId);
          } catch (error) {
            console.error(`Failed to delete file ${doc.pdfPublicId} from storage: ${error.message}`);
          }
        }
        await BillingDocument.deleteOne({ _id: doc._id });
      }
      await BillingRecord.deleteOne({ _id: record._id });
      deletedCount++;
    }
    
    return { 
      success: true, 
      deletedCount 
    };
  }
}

export default new InvoiceService();
