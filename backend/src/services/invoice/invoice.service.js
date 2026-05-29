import BillingRecord from '../../models/BillingRecord.js';
import BillingDocument from '../../models/BillingDocument.js';
import Integration from '../../models/Integration.js';
import UserVendorConfig from '../../models/UserVendorConfig.js';
import { getProvider } from '../providers/index.js';
import { getStorageService } from '../storage/index.js';
import groupingService from './grouping.service.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { getVendorCapability } from '../../config/vendorCapabilities.js';
import VendorIntegration from '../../models/VendorIntegration.js';

class InvoiceService {
  async syncInvoices(userId) {
    // 1. Load user's vendor config
    const userConfig = await UserVendorConfig.findOne({ userId }).populate('selectedVendors');

    if (!userConfig || !userConfig.selectedVendors || userConfig.selectedVendors.length === 0) {
      throw new AppError('No vendors selected. Please configure your vendors in Settings before syncing.', 400);
    }

    const apiQueue = [];
    const emailQueue = [];

    // 2. Determine capabilities and sort into queues
    for (const vendor of userConfig.selectedVendors) {
      const capability = getVendorCapability(vendor.name);
      if (capability.supportsApi) {
        apiQueue.push({ vendor, capability });
      } else if (capability.supportsEmail) {
        emailQueue.push(vendor);
      }
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];
    const vendorStatsList = [];
    const storage = getStorageService();

    // 3. Process API Queue
    for (const { vendor, capability } of apiQueue) {
      let fallBackToEmail = false;
      let apiSuccess = false;

      const integration = await VendorIntegration.findOne({ userId, vendorName: vendor.name });

      if (!integration || integration.status !== 'connected') {
        console.log(`⚠️ Missing or invalid credentials for API vendor ${vendor.name}. Skipping API.`);
        if (!integration && capability.supportsEmail) {
          fallBackToEmail = true;
          console.log(`🔄 Falling back to Email for ${vendor.name} due to missing credentials.`);
        } else {
          errors.push({ vendorName: vendor.name, error: 'Missing or invalid API credentials' });
          vendorStatsList.push({ vendor: vendor.name, ignored: 1, invoicesImported: 0, rejectionReasons: {'Credentials Error': 1} });
        }
      } else {
        const provider = getProvider(vendor.name);
        let retries = 0;
        const maxRetries = 3;
        const backoffDelays = [2000, 5000, 10000];
        
        const credentials = integration.getDecryptedCredentials();

        while (retries < maxRetries && !apiSuccess) {
          try {
            console.log(`🚀 Calling API for ${vendor.name} (Attempt ${retries + 1})...`);
            const records = await provider.fetchBillingRecords(credentials, { scanDurationDays: userConfig.scanDurationDays });
            apiSuccess = true;
            
            let vendorImported = 0;
            let vendorSkipped = 0;

            for (const record of records) {
              // Same deduplication logic
              const documentData = {
                userId,
                vendorId: vendor._id,
                sourceType: 'api',
                sourceProvider: vendor.name,
                documentSourceType: record.invoiceAvailability,
                emailSubject: `API Import: ${record.invoiceNumber || 'Record'}`,
                emailDate: record.billingDate,
                invoiceLink: record.invoiceLink,
                status: 'imported',
              };

              const extractedData = {
                amount: record.amount,
                currency: record.currency,
                recordType: record.invoiceAvailability === 'PDF' ? 'invoice_pdf' : 'billing_info_only',
                identifiers: {
                  invoiceNumber: record.invoiceNumber,
                  orderNumber: record.orderId,
                  transactionId: record.transactionId,
                },
                productName: record.vendorName,
                invoiceLink: record.invoiceLink,
              };

              try {
                await groupingService.processDocument(
                  documentData,
                  { _id: vendor._id, name: vendor.name },
                  extractedData
                );
                await BillingDocument.create(documentData);
                vendorImported++;
                imported++;
              } catch (err) {
                if (err.code === 11000) {
                  vendorSkipped++;
                  skipped++;
                } else {
                  console.error(`Error saving API record for ${vendor.name}: ${err.message}`);
                }
              }
            }

            integration.lastSuccessfulSyncAt = new Date();
            integration.syncFailures = 0;
            await integration.save();
            
            vendorStatsList.push({
              vendor: vendor.name,
              emailsFound: records.length,
              invoicesImported: vendorImported,
              ignored: vendorSkipped,
              rejectionReasons: {}
            });

          } catch (err) {
            retries++;
            integration.syncFailures = retries;
            integration.lastError = err.message;
            await integration.save();
            console.error(`❌ API Error for ${vendor.name} (Attempt ${retries}): ${err.message}`);
            
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, backoffDelays[retries-1]));
            }
          }
        }

        if (!apiSuccess) {
          if (capability.supportsEmail) {
            fallBackToEmail = true;
            console.log(`🔄 Falling back to Email scanning for ${vendor.name} after 3 API failures.`);
          } else {
            errors.push({ vendorName: vendor.name, error: `API failed ${maxRetries} times and no email fallback available.` });
            vendorStatsList.push({ vendor: vendor.name, ignored: 1, invoicesImported: 0, rejectionReasons: {'API Failure': 1} });
          }
        }
      }

      if (fallBackToEmail) {
        emailQueue.push(vendor);
      }
    }

    // 4. Process Email Queue (Gmail Provider)
    if (emailQueue.length > 0) {
      const gmailIntegration = await Integration.findOne({
        userId,
        providerName: 'gmail',
        status: 'active',
      });

      if (!gmailIntegration) {
        errors.push({ error: 'Gmail is not connected. Skipping email queue.' });
      } else {
        const existingDocuments = await BillingDocument.find(
          { userId, sourceProvider: 'gmail', gmailMessageId: { $ne: null } },
          { gmailMessageId: 1, attachmentId: 1 }
        ).lean();

        const existingMessageIds = new Set(existingDocuments.map((doc) => doc.gmailMessageId));
        const existingKeys = new Set(existingDocuments.map((doc) => `${doc.gmailMessageId}:${doc.attachmentId || 'no-attachment'}`));

        const gmailProvider = getProvider('gmail');
        await gmailProvider.connect(gmailIntegration);

        const { invoices: invoiceDataList, stats } = await gmailProvider.fetchInvoices(gmailIntegration, {
          vendors: emailQueue,
          scanDurationDays: userConfig.scanDurationDays,
          existingMessageIds,
        });

        // Add to main stats
        vendorStatsList.push(...stats);

        for (const item of invoiceDataList) {
          const attachId = item.attachments && item.attachments.length > 0 ? item.attachments[0].attachmentId : 'no-attachment';
          const key = `${item.messageId}:${attachId}`;
          if (existingKeys.has(key)) {
            skipped++;
            continue;
          }

          try {
            let uploadResult = null;
            if (item.attachments && item.attachments.length > 0) {
              uploadResult = await storage.uploadFile(item.attachments[0].data, {
                userId: userId.toString(),
                vendorName: item.vendorName,
                fileName: item.attachments[0].fileName,
              });
            }

            const pdfUrl = uploadResult ? uploadResult.url : null;

            const documentData = {
              userId,
              vendorId: item.vendorId,
              sourceType: 'email',
              sourceProvider: 'gmail',
              documentSourceType: item.recordType,
              gmailMessageId: item.messageId,
              emailSubject: item.emailSubject,
              emailFrom: item.emailFrom,
              emailDate: item.emailDate,
              attachmentId: item.attachments && item.attachments.length > 0 ? item.attachments[0].attachmentId : null,
              pdfUrl,
              pdfPublicId: uploadResult ? uploadResult.publicId : null,
              fileName: item.attachments && item.attachments.length > 0 ? item.attachments[0].fileName : null,
              invoiceLink: item.invoiceLink,
              status: 'imported',
            };

            const extractedData = {
              amount: item.amount,
              currency: item.currency,
              recordType: item.recordType,
              identifiers: item.identifiers,
              productName: item.productName,
              lineItems: item.lineItems,
              billingPeriod: item.billingPeriod,
              subscriptionName: item.subscriptionName,
              membershipName: item.membershipName,
              paymentMethod: item.paymentMethod,
              invoiceLink: item.invoiceLink,
              pdfUrl,
            };

            await groupingService.processDocument(
              documentData,
              { _id: item.vendorId, name: item.vendorName },
              extractedData
            );
            await BillingDocument.create(documentData);

            imported++;
            existingKeys.add(key);
          } catch (error) {
            if (error.code === 11000) {
              skipped++;
            } else {
              errors.push({ error: error.message });
            }
          }
        }
      }
    }

    userConfig.lastSyncAt = new Date();
    await userConfig.save();

    return {
      imported,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      vendorStats: vendorStatsList,
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

    return {
      invoices: records,
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
      deletedCount,
    };
  }
}

export default new InvoiceService();
