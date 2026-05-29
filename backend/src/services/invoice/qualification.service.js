class QualificationService {
  constructor() {
    this.hardBlockList = [
      'security alert',
      'critical security alert',
      'verification code',
      'otp',
      'account recovery',
      'password reset',
      'two-factor authentication',
      'login attempt',
      'suspicious sign-in',
      'policy update',
      'terms of service',
      'privacy policy',
      'community guidelines',
      'newsletter',
      'announcement',
      'feature update',
      'new feature',
      'release notes',
      'product update',
      'marketing',
      'promotion',
      'discount',
      'offer',
      'survey',
      'feedback request',
      'welcome', // careful with "welcome to" membership
      'account created',
      'login alert',
      'device login',
      'suspicious activity',
      'google maps policy reminder',
      'gemini updates',
      'gemini update',
      'i/o updates',
      'i/o update',
      'stitch updates',
      'google verification code',
      "what's new",
      'see what\'s new',
      'bring your ai',
      'open-sources',
      'get more done',
      'is here',
      'you have access to',
      'tips and tricks',
      'latest news'
    ];

    this.positiveSignals = [
      'invoice',
      'tax invoice',
      'receipt',
      'payment',
      'payment successful',
      'amount paid',
      'purchase',
      'purchase confirmation',
      'order confirmation',
      'your order',
      'subscription',
      'subscription renewal',
      'membership',
      'membership renewal',
      'billing',
      'billing statement',
      'payment receipt',
      'charged',
      'renewed',
      'renewal',
      'payment method',
      'invoice number',
      'order number',
      'transaction id',
      'receipt number',
      'tax amount',
      'total amount',
      'amount due',
      'plan renewed',
      'membership activated'
    ];
  }

  /**
   * Qualifies an email to determine if it is a billing event.
   * @param {Object} vendor - The matched vendor
   * @param {string} subject - Email subject
   * @param {string} snippet - Email snippet
   * @param {string} body - Email body (text/html)
   * @param {boolean} hasPdf - Whether a PDF is attached
   * @param {boolean} hasLink - Whether an invoice link was found
   * @returns {Object} { qualified: boolean, reason: string, score: number }
   */
  qualifyEmail(vendor, subject, snippet, body, hasPdf, hasLink) {
    const textToSearch = `${subject} ${snippet}`.toLowerCase();
    
    // 1. Hard Block List Check
    const blockMatch = this.hardBlockList.find(term => textToSearch.includes(term.toLowerCase()));
    if (blockMatch) {
      // Exception: "welcome" might trigger on "welcome to YouTube Premium"
      if (blockMatch === 'welcome' && textToSearch.includes('membership')) {
        // Allow pass through
      } else {
        return {
          qualified: false,
          reason: `Rejected: Hard Block Match -> "${blockMatch}"`,
          score: 0
        };
      }
    }

    let score = 0;
    
    // Vendor domain/sender baseline
    score += 10;

    // 2. Positive Signals Check
    let positiveHits = 0;
    for (const signal of this.positiveSignals) {
      // Use regex with word boundaries to avoid matching "in order to" as "order"
      const regex = new RegExp(`\\b${signal}\\b`, 'i');
      if (regex.test(textToSearch)) {
        positiveHits++;
        score += 10;
      }
    }

    // 3. Evidence Extraction (Strong Signals)
    const evidence = this._extractEvidence(textToSearch, body);
    
    let hasConcreteData = hasPdf || hasLink || !!evidence.invoiceNumber || !!evidence.orderNumber || !!evidence.transactionId;
    if (evidence.amount) { score += 20; }
    if (hasConcreteData) { score += 30; }
    if (hasPdf) score += 40;
    if (hasLink) score += 30;

    // 4. Strict Billing Evidence Requirement (100% Accuracy Mode)
    // We MUST have concrete data (PDF, Link, Order ID, Invoice ID, or Transaction ID).
    // Amount alone or positive keywords are NO LONGER sufficient to bypass this.
    if (!hasConcreteData) {
      return {
        qualified: false,
        reason: 'Rejected: Missing concrete billing data (No PDF, Link, Order/Invoice/Transaction ID)',
        score
      };
    }

    // Pass
    return {
      qualified: true,
      reason: 'Qualified',
      score: Math.min(score, 100)
    };
  }

  _extractEvidence(textToSearch, body) {
    const evidence = {
      invoiceNumber: null,
      orderNumber: null,
      transactionId: null,
      amount: null
    };

    const combined = `${textToSearch} ${body || ''}`.toLowerCase();

    // Regex extractors (Stricter matching requiring specific prefixes)
    const orderMatch = combined.match(/\b(?:order number|order id|order\s*[:#])\s*([a-z0-9A-Z-]+)\b/i);
    if (orderMatch) evidence.orderNumber = orderMatch[1].trim();

    const invoiceMatch = combined.match(/\b(?:invoice no|invoice number|invoice id|invoice\s*[:#])\s*([a-z0-9A-Z-]+)\b/i);
    if (invoiceMatch) evidence.invoiceNumber = invoiceMatch[1].trim();

    const txMatch = combined.match(/\b(?:transaction id|transaction no|transaction\s*[:#])\s*([a-z0-9A-Z-]+)\b/i);
    if (txMatch) evidence.transactionId = txMatch[1].trim();
    
    // Amount matching is generally safe
    const amountMatch = combined.match(/(?:usd|\$|₹|inr|rs\.?)\s*([0-9,]+\.[0-9]{2})/i);
    if (amountMatch) evidence.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    return evidence;
  }
}

export default new QualificationService();
