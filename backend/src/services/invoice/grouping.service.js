import BillingRecord from '../../models/BillingRecord.js';

/**
 * Deterministic Grouping / Deduplication Service
 * 
 * Rules:
 * 1. Extract identifiers from document (invoiceNumber, orderNumber, transactionId, receiptNumber, paymentReference)
 * 2. Search existing BillingRecords for SAME vendor + SAME identifier (any of the 5 fields)
 * 3. If exact identifier match → Duplicate → Link to existing record
 * 4. If no identifier match → Create new BillingRecord
 * 
 * CRITICAL: Same Vendor + Same Amount ≠ Duplicate (e.g., YouTube ₹79 monthly)
 * ONLY: Same Vendor + Same Identifier = Duplicate (e.g., OpenAI OP-1001)
 */
class GroupingService {
  /**
   * Process a new billing document — either link to existing record or create new one.
   * Mutates `document.billingRecordId` with the resulting record ID.
   * 
   * @param {Object} document - Document data (not yet saved to DB)
   * @param {Object} vendor - { _id, name }
   * @param {Object} extractedData - All extracted billing fields
   */
  async processDocument(document, vendor, extractedData) {
    const {
      amount,
      currency,
      recordType,
      identifiers,
      productName,
      lineItems,
      billingPeriod,
      subscriptionName,
      membershipName,
      paymentMethod,
      invoiceLink,
      pdfUrl,
    } = extractedData;

    // Step 1: Try to find an existing record with a matching identifier
    const existingRecord = await this._findByIdentifier(document.userId, vendor._id, identifiers);

    if (existingRecord) {
      // DUPLICATE — link this document to the existing record
      document.billingRecordId = existingRecord._id;

      // Upgrade record type if this document provides better evidence
      // Priority: invoice_pdf > invoice_link > billing_info_only
      const typePriority = { invoice_pdf: 3, invoice_link: 2, billing_info_only: 1 };
      if (typePriority[recordType] > typePriority[existingRecord.recordType]) {
        existingRecord.recordType = recordType;
      }

      // Fill in any missing fields from this new document
      if (amount && !existingRecord.amount) existingRecord.amount = amount;
      if (currency && !existingRecord.currency) existingRecord.currency = currency;
      
      // Merge Identifiers
      const idKeys = ['invoiceNumber', 'orderNumber', 'transactionId', 'receiptNumber', 'paymentReference', 'customerTransactionId', 'merchantTransactionId', 'utr', 'rrn', 'paymentGatewayReference'];
      for (const key of idKeys) {
        if (identifiers[key] && !existingRecord[key]) existingRecord[key] = identifiers[key];
      }

      if (productName && !existingRecord.productName) existingRecord.productName = productName;
      if (billingPeriod && !existingRecord.billingPeriod) existingRecord.billingPeriod = billingPeriod;
      if (subscriptionName && !existingRecord.subscriptionName) existingRecord.subscriptionName = subscriptionName;
      if (membershipName && !existingRecord.membershipName) existingRecord.membershipName = membershipName;
      if (paymentMethod && !existingRecord.paymentMethod) existingRecord.paymentMethod = paymentMethod;
      if (pdfUrl && !existingRecord.pdfUrl) existingRecord.pdfUrl = pdfUrl;
      if (invoiceLink && !existingRecord.invoiceUrl) existingRecord.invoiceUrl = invoiceLink;

      // Merge Line Items (avoid duplicates by name)
      if (lineItems && lineItems.length > 0) {
        const existingNames = new Set(existingRecord.lineItems.map(item => item.name.toLowerCase()));
        for (const item of lineItems) {
          if (!existingNames.has(item.name.toLowerCase())) {
            existingRecord.lineItems.push(item);
            existingNames.add(item.name.toLowerCase());
          }
        }
      }

      // Track the email ID
      if (document.gmailMessageId && !existingRecord.rawEmailIds.includes(document.gmailMessageId)) {
        existingRecord.rawEmailIds.push(document.gmailMessageId);
      }

      await existingRecord.save();
      console.log(`  🔗 Linked to existing record (duplicate): ${vendor.name} — ID match`);
    } else {
      // NEW RECORD — create a fresh BillingRecord
      const newRecord = await BillingRecord.create({
        userId: document.userId,
        vendorId: vendor._id,
        vendorName: vendor.name,
        productName: productName || null,
        recordType,
        amount: amount || null,
        currency: currency || null,
        transactionDate: document.emailDate,
        billingDate: document.emailDate, // Best guess; same as email date
        billingPeriod: billingPeriod || null,
        invoiceNumber: identifiers.invoiceNumber,
        orderNumber: identifiers.orderNumber,
        transactionId: identifiers.transactionId,
        receiptNumber: identifiers.receiptNumber,
        paymentReference: identifiers.paymentReference,
        customerTransactionId: identifiers.customerTransactionId,
        merchantTransactionId: identifiers.merchantTransactionId,
        utr: identifiers.utr,
        rrn: identifiers.rrn,
        paymentGatewayReference: identifiers.paymentGatewayReference,
        lineItems: lineItems || [],
        subscriptionName: subscriptionName || null,
        membershipName: membershipName || null,
        paymentMethod: paymentMethod || null,
        pdfUrl: pdfUrl || null,
        invoiceUrl: invoiceLink || null,
        emailSubject: document.emailSubject,
        senderEmail: document.emailFrom,
        rawEmailIds: document.gmailMessageId ? [document.gmailMessageId] : [],
      });

      document.billingRecordId = newRecord._id;
    }
  }

  /**
   * Find an existing BillingRecord that shares at least one identifier with the incoming data.
   * Priority order: invoiceNumber → orderNumber → transactionId → receiptNumber → paymentReference
   * 
   * @param {ObjectId} userId
   * @param {ObjectId} vendorId
   * @param {Object} identifiers
   * @returns {Document|null}
   */
  async _findByIdentifier(userId, vendorId, identifiers) {
    // Build OR conditions for all non-null identifiers
    const orConditions = [];

    const idKeys = ['invoiceNumber', 'orderNumber', 'transactionId', 'receiptNumber', 'paymentReference', 'customerTransactionId', 'merchantTransactionId', 'utr', 'rrn', 'paymentGatewayReference'];
    for (const key of idKeys) {
      if (identifiers[key]) {
        orConditions.push({ [key]: identifiers[key] });
      }
    }

    // No identifiers to match — this is always a new record
    if (orConditions.length === 0) {
      return null;
    }

    // Find by same vendor + any matching identifier
    return await BillingRecord.findOne({
      userId,
      vendorId,
      $or: orConditions,
    });
  }
}

export default new GroupingService();
