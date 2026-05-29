import BillingRecord from '../../models/BillingRecord.js';

class GroupingService {
  /**
   * Group a newly fetched billing document into a BillingRecord.
   * Modifies the document object with the resulting billingRecordId.
   */
  async processDocument(document, vendor) {
    // 1. Extract Evidence
    const evidence = this._extractEvidence(document, vendor);
    
    // 2. Find Candidate Records (same vendor, within +/- 15 days)
    const candidates = await this._findCandidates(document, vendor);
    
    // 3. Match against candidates
    let match = null;
    let confidence = 'low';

    for (const candidate of candidates) {
      const matchResult = this._evaluateMatch(document, evidence, candidate);
      if (matchResult.confidence === 'high') {
        match = candidate;
        confidence = 'high';
        break; // Stop looking if we have a high confidence match
      }
      
      if (matchResult.confidence === 'medium' && !match) {
        match = candidate;
        confidence = 'medium';
      }
    }

    let recordCompleteness = this._calculateCompleteness(document, evidence);

    if (match) {
      // We found a match! Merge it.
      
      if (confidence === 'high') {
        // High confidence merges automatically
        match.reviewStatus = 'auto_merged';
      } else {
        // Medium confidence merges but needs review
        // Only override to needs_review if it wasn't already reviewed
        if (match.reviewStatus !== 'reviewed') {
          match.reviewStatus = 'needs_review';
        }
      }
      
      match.groupingConfidence = confidence;
      
      // Upgrade completeness score if this document provides better/new evidence
      if (recordCompleteness > match.recordCompleteness) {
        match.recordCompleteness = recordCompleteness;
      }

      // Merge evidence if missing from candidate
      if (evidence.invoiceNumber && !match.invoiceNumber) match.invoiceNumber = evidence.invoiceNumber;
      if (evidence.orderNumber && !match.orderNumber) match.orderNumber = evidence.orderNumber;
      if (evidence.transactionId && !match.transactionId) match.transactionId = evidence.transactionId;
      if (evidence.paymentReference && !match.paymentReference) match.paymentReference = evidence.paymentReference;
      
      // Update amount/date if they were previously null
      if (evidence.amount && !match.amount) match.amount = evidence.amount;
      
      await match.save();
      document.billingRecordId = match._id;
      
    } else {
      // No match found, create a new BillingRecord (Low Confidence)
      const newRecord = await BillingRecord.create({
        userId: document.userId,
        vendorId: vendor._id,
        vendorName: vendor.name,
        transactionDate: document.emailDate,
        amount: evidence.amount || null,
        currency: null,
        groupingConfidence: 'low',
        reviewStatus: 'separate',
        invoiceNumber: evidence.invoiceNumber,
        orderNumber: evidence.orderNumber,
        transactionId: evidence.transactionId,
        paymentReference: evidence.paymentReference,
        recordCompleteness,
      });
      
      document.billingRecordId = newRecord._id;
    }
  }

  _extractEvidence(document, vendor) {
    const evidence = {
      invoiceNumber: null,
      orderNumber: null,
      transactionId: null,
      paymentReference: null,
      amount: null
    };

    const textToSearch = `${document.emailSubject || ''} ${document.snippet || ''}`;

    // Very basic regex parsing (can be enhanced over time)
    // Looking for Order #, Invoice No., etc.
    const orderMatch = textToSearch.match(/(?:Order|Order Number|Order #)[:#]?\s*([A-Z0-9-]+)/i);
    if (orderMatch) evidence.orderNumber = orderMatch[1].trim();

    const invoiceMatch = textToSearch.match(/(?:Invoice|Invoice No|Invoice Number)[:#]?\s*([A-Z0-9-]+)/i);
    if (invoiceMatch) evidence.invoiceNumber = invoiceMatch[1].trim();

    const txMatch = textToSearch.match(/(?:Transaction|Transaction ID)[:#]?\s*([A-Z0-9-]+)/i);
    if (txMatch) evidence.transactionId = txMatch[1].trim();
    
    // Amount extraction ($12.99, Rs. 100, etc)
    const amountMatch = textToSearch.match(/(?:USD|\$|₹|INR|Rs\.?)\s*([0-9,]+\.[0-9]{2})/i);
    if (amountMatch) {
      evidence.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    return evidence;
  }

  async _findCandidates(document, vendor) {
    // Find records for this user & vendor within +/- 15 days of this email
    const emailDate = document.emailDate || new Date();
    const startDate = new Date(emailDate);
    startDate.setDate(startDate.getDate() - 15);
    
    const endDate = new Date(emailDate);
    endDate.setDate(endDate.getDate() + 15);

    return await BillingRecord.find({
      userId: document.userId,
      vendorId: vendor._id,
      transactionDate: {
        $gte: startDate,
        $lte: endDate
      }
    });
  }

  _evaluateMatch(document, evidence, candidate) {
    // 1. High Confidence: Hard ID Match
    if (evidence.invoiceNumber && candidate.invoiceNumber === evidence.invoiceNumber) return { confidence: 'high' };
    if (evidence.orderNumber && candidate.orderNumber === evidence.orderNumber) return { confidence: 'high' };
    if (evidence.transactionId && candidate.transactionId === evidence.transactionId) return { confidence: 'high' };
    if (evidence.paymentReference && candidate.paymentReference === evidence.paymentReference) return { confidence: 'high' };

    // 2. High Confidence: Exact amount on the same day (or adjacent day)
    if (evidence.amount && candidate.amount === evidence.amount) {
      const diffTime = Math.abs(document.emailDate - candidate.transactionDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays <= 2) {
        return { confidence: 'high' };
      }
    }

    // 3. Medium Confidence: Matching Billing Period from Subject
    const subject = document.emailSubject || '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    for (const month of months) {
      if (subject.includes(month)) {
        // If the email subject contains the month, and the candidate date is in that month
        if (candidate.transactionDate && candidate.transactionDate.getMonth() === months.indexOf(month)) {
          return { confidence: 'medium' };
        }
      }
    }

    return { confidence: 'low' };
  }

  _calculateCompleteness(document, evidence) {
    let score = 0;
    
    switch (document.documentSourceType) {
      case 'pdf_invoice':
        score = 100;
        break;
      case 'invoice_link':
        score = 80;
        break;
      case 'receipt_email':
        score = 70;
        break;
      case 'payment_confirmation':
      case 'order_confirmation':
        score = 60;
        break;
      case 'subscription_renewal':
      case 'membership_confirmation':
      case 'utility_bill':
        score = 50;
        break;
      default:
        score = 30; // Unknown but we have an email
    }

    // Boost score if we extracted hard evidence
    if (evidence.amount) score += 10;
    if (evidence.invoiceNumber || evidence.orderNumber || evidence.transactionId) score += 10;
    
    return Math.min(score, 100);
  }
}

export default new GroupingService();
