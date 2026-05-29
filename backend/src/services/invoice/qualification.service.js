/**
 * Deterministic Billing Qualification Service
 * 
 * Rules (in order):
 * 1. Check Negative Indicators → If match AND no amount → REJECT
 * 2. Extract Amount → If NO amount → REJECT (mandatory gate)
 * 3. Check Positive Billing Indicators → Must have at least one
 * 4. Amount + Positive Indicator → QUALIFY
 * 5. Classify record type: PDF → "invoice_pdf", Link → "invoice_link", else → "billing_info_only"
 */
class QualificationService {
  constructor() {
    // --- Negative indicators: immediate reject if present AND no amount ---
    this.negativeIndicators = [
      'verification code',
      'otp',
      'security alert',
      'critical security alert',
      'account recovery',
      'password reset',
      'login alert',
      'suspicious activity',
      'suspicious sign-in',
      'login attempt',
      'two-factor authentication',
      'policy update',
      'terms of service',
      'privacy policy',
      'feature update',
      'new feature',
      'release notes',
      'product update',
      'newsletter',
      'promotion',
      'marketing',
      'announcement',
      'survey',
      'feedback request',
      'welcome email',
      'account created',
      'device login',
      'discount',
      'offer',
      'google maps policy reminder',
      'gemini updates',
      'gemini update',
      'i/o updates',
      'i/o update',
      'stitch updates',
      'google verification code',
      "what's new",
      "see what's new",
      'bring your ai',
      'open-sources',
      'get more done',
      'is here',
      'you have access to',
      'tips and tricks',
      'latest news',
      'community guidelines',
    ];

    // --- Positive billing indicators: at least one must be present ---
    this.positiveIndicators = [
      'invoice',
      'tax invoice',
      'receipt',
      'payment',
      'payment successful',
      'charged',
      'renewal',
      'renewed',
      'subscription',
      'membership',
      'purchase',
      'purchase confirmation',
      'order',
      'order confirmation',
      'billing',
      'statement',
      'payment receipt',
      'transaction',
      'amount paid',
      'amount due',
      'total amount',
      'plan renewed',
      'membership activated',
    ];

    // --- Amount regex patterns (INR and USD only) ---
    this.amountPatterns = [
      // ₹499 or ₹1,499.00 or ₹ 499 - anchored by word boundary or space/start to avoid matching inside URLs
      /(?:^|\s|>)(?:₹|INR)\s*([0-9,]+(?:\.[0-9]{1,2})?)\b/i,
      // Rs. 499 or Rs 499 or Rs.499
      /\bRs\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)\b/i,
      // $20 or $49.99 or $ 20 or USD 20
      /(?:^|\s|>)(?:\$|USD)\s*([0-9,]+(?:\.[0-9]{1,2})?)\b/i,
    ];

    // --- Currency detection (maps pattern index to currency) ---
    this.currencyMap = [
      'INR', // ₹ or INR
      'INR', // Rs.
      'USD', // $ or USD
    ];
  }

  /**
   * Strip HTML tags from a string to prevent regex matching on CSS, URLs, or tracking pixels.
   */
  stripHtml(html) {
    if (!html) return '';
    // Remove script and style blocks entirely
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode common entities
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Qualifies an email to determine if it is a billing event.
   * @param {string} subject - Email subject
   * @param {string} snippet - Email snippet
   * @param {string} body - Email body (text/html)
   * @param {boolean} hasPdf - Whether a PDF is attached
   * @param {boolean} hasInvoiceLink - Whether an invoice link was found
   * @returns {Object} { qualified, reason, recordType, amount, currency }
   */
  qualifyEmail(subject, snippet, body, hasPdf, hasInvoiceLink) {
    const cleanBody = this.stripHtml(body);
    const textToSearch = `${subject || ''} ${snippet || ''}`.toLowerCase();
    const fullText = `${textToSearch} ${cleanBody}`.toLowerCase();

    // Step 1: Extract amount (mandatory gate)
    const amountResult = this._extractAmount(fullText);

    // Step 2: Check negative indicators
    const negativeMatch = this.negativeIndicators.find(term =>
      textToSearch.includes(term.toLowerCase())
    );

    if (negativeMatch && !amountResult.amount) {
      return {
        qualified: false,
        reason: `Rejected: Negative indicator "${negativeMatch}" with no amount`,
        recordType: null,
        amount: null,
        currency: null,
      };
    }

    // Step 3: Amount is mandatory — no amount = reject
    if (!amountResult.amount) {
      return {
        qualified: false,
        reason: 'Rejected: No monetary amount found',
        recordType: null,
        amount: null,
        currency: null,
      };
    }

    // Step 4: Check positive billing indicators — need at least one
    let hasPositiveSignal = false;
    for (const signal of this.positiveIndicators) {
      const regex = new RegExp(`\\b${signal}\\b`, 'i');
      if (regex.test(textToSearch)) {
        hasPositiveSignal = true;
        break;
      }
    }

    // PDF or invoice link are strong positive signals themselves
    if (hasPdf || hasInvoiceLink) {
      hasPositiveSignal = true;
    }

    if (!hasPositiveSignal) {
      return {
        qualified: false,
        reason: 'Rejected: Amount found but no positive billing indicator',
        recordType: null,
        amount: amountResult.amount,
        currency: amountResult.currency,
      };
    }

    // Step 5: Classify record type
    let recordType = 'billing_info_only';
    if (hasPdf) {
      recordType = 'invoice_pdf';
    } else if (hasInvoiceLink) {
      recordType = 'invoice_link';
    }

    // QUALIFIED
    return {
      qualified: true,
      reason: 'Qualified',
      recordType,
      amount: amountResult.amount,
      currency: amountResult.currency,
    };
  }

  /**
   * Extract monetary amount and currency from text.
   * @param {string} text - Full text to search
   * @returns {{ amount: number|null, currency: string|null }}
   */
  _extractAmount(text) {
    for (let i = 0; i < this.amountPatterns.length; i++) {
      const match = text.match(this.amountPatterns[i]);
      if (match) {
        const rawAmount = match[1].replace(/,/g, '');
        const amount = parseFloat(rawAmount);
        if (!isNaN(amount) && amount > 0) {
          return { amount, currency: this.currencyMap[i] };
        }
      }
    }
    return { amount: null, currency: null };
  }

  /**
   * Validate if an extracted string looks like a real transaction identifier.
   * - Must contain at least one digit
   * - Must be alphanumeric/dashes (no spaces, no random symbols)
   * - Must have meaningful length (>= 5)
   * - Must not be a generic word or HTML fragment
   */
  _isValidIdentifier(id) {
    if (!id) return false;
    if (id.length < 5) return false;
    
    // Must contain at least one digit (prevents words like "ormatting", "payment")
    if (!/\d/.test(id)) return false;
    
    // Must be alphanumeric with optional dashes/dots
    if (!/^[a-zA-Z0-9-.]+$/.test(id)) return false;
    
    // Reject known bad words
    const lowerId = id.toLowerCase();
    const badWords = [
      'payment', 'invoice', 'receipt', 'download', 'order', 'transaction', 
      'reference', 'span', 'div', 'class', 'href', 'html', 'body'
    ];
    if (badWords.some(word => lowerId.includes(word))) return false;
    
    return true;
  }

  /**
   * Extract all billing identifiers from email text.
   * Used by grouping service for deduplication.
   * @param {string} subject
   * @param {string} snippet
   * @param {string} body
   * @returns {Object} Extracted identifiers
   */
  extractIdentifiers(subject, snippet, body) {
    const cleanBody = this.stripHtml(body);
    const combined = `${subject || ''} ${snippet || ''} ${cleanBody || ''}`;

    const identifiers = {
      invoiceNumber: null,
      orderNumber: null,
      transactionId: null,
      receiptNumber: null,
      paymentReference: null,
      customerTransactionId: null,
      merchantTransactionId: null,
      utr: null,
      rrn: null,
      paymentGatewayReference: null,
    };

    // Helper to safely set valid identifiers
    const trySet = (key, regexList) => {
      if (identifiers[key]) return; // already set
      for (const regex of regexList) {
        const match = combined.match(regex);
        if (match && this._isValidIdentifier(match[1].trim())) {
          identifiers[key] = match[1].trim();
          break;
        }
      }
    };

    // Invoice Number
    trySet('invoiceNumber', [
      /(?:invoice\s*(?:no|number|id|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Order Number
    trySet('orderNumber', [
      /(?:order\s*(?:no|number|id|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Transaction ID
    trySet('transactionId', [
      /(?:transaction\s*(?:id|no|number|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i,
      /(?:txn\s*(?:id|no|number|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Receipt Number
    trySet('receiptNumber', [
      /(?:receipt\s*(?:no|number|id|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Payment Reference
    trySet('paymentReference', [
      /(?:(?:payment\s*)?ref(?:erence)?\s*(?:no|number|id|#)?[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Customer Transaction ID
    trySet('customerTransactionId', [
      /(?:customer\s*transaction\s*(?:id|no|number|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Merchant Transaction ID
    trySet('merchantTransactionId', [
      /(?:merchant\s*transaction\s*(?:id|no|number|#)[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // UTR
    trySet('utr', [
      /(?:utr\s*(?:no|number|#)?[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // RRN
    trySet('rrn', [
      /(?:rrn\s*(?:no|number|#)?[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    // Payment Gateway Reference
    trySet('paymentGatewayReference', [
      /(?:payment\s*gateway\s*ref(?:erence)?\s*(?:no|number|id|#)?[.:#]?\s*)([a-zA-Z0-9-.]+)/i
    ]);

    return identifiers;
  }

  /**
   * Extract Product Name
   * Looks for specific product references separately from the vendor.
   * E.g. "Google AI Pro", "YouTube Premium"
   */
  extractProductName(subject, snippet, body) {
    const cleanBody = this.stripHtml(body);
    const text = `${subject || ''} ${snippet || ''} ${cleanBody || ''}`;
    let productName = null;

    // Look for "Your [Product Name] membership/subscription/purchase"
    const membershipMatch = text.match(/(?:your|changes\s*to\s*your)\s+([a-zA-Z0-9\s]+?)\s+(?:membership|subscription|plan)/i);
    if (membershipMatch) {
      productName = membershipMatch[1].trim();
    } else {
      // Look for "receipt for [Product Name]"
      const receiptMatch = text.match(/receipt\s*for\s+([a-zA-Z0-9\s]+?)(?:\s+from|\.|$)/i);
      if (receiptMatch) productName = receiptMatch[1].trim();
    }
    
    // Clean up generic prefixes
    if (productName && productName.toLowerCase().startsWith('purchase of ')) {
      productName = productName.substring(12);
    }
    
    return productName;
  }

  /**
   * Extract Line Items (Best-effort heuristic)
   * Looks for lists or tables in text indicating itemized billing.
   */
  extractLineItems(body) {
    if (!body) return [];
    const cleanBody = this.stripHtml(body);
    const lineItems = [];
    
    // Simple heuristic: Line items often appear as "Item Name   ₹XX.XX" or similar.
    // E.g. Airtel: TELEMEDIA 07929408155_wifi 370.52
    // We will look for sequences of text followed by a currency amount.
    const lines = cleanBody.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Match something like "Some Item Name 370.52" or "Some Item Name ₹ 370.52"
      // Excluding lines that are clearly totals or taxes
      const lower = trimmed.toLowerCase();
      if (lower.includes('total') || lower.includes('tax') || lower.includes('sgst') || lower.includes('cgst') || lower.includes('amount due') || lower.includes('amount paid')) {
        continue;
      }
      
      const itemMatch = trimmed.match(/^(.+?)\s+(?:₹|Rs\.?|INR|\$|USD)?\s?([0-9,]+\.\d{2})$/i);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        // Skip lines that are just numbers or very short
        if (name.length > 3 && !/^\d+$/.test(name) && !name.toLowerCase().includes('invoice') && !name.toLowerCase().includes('receipt')) {
          const rawAmount = itemMatch[2].replace(/,/g, '');
          const amount = parseFloat(rawAmount);
          if (!isNaN(amount) && amount > 0) {
            lineItems.push({ name, amount });
          }
        }
      }
    }
    
    return lineItems;
  }

  /**
   * Extract billing period from email text.
   * E.g., "May 2026", "May 1 – May 31", "01/05/2026 - 31/05/2026"
   * @param {string} subject
   * @param {string} snippet
   * @returns {string|null}
   */
  extractBillingPeriod(subject, snippet) {
    const text = `${subject || ''} ${snippet || ''}`;

    // Match patterns like "May 2026", "June 2025"
    const monthYearMatch = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
    );
    if (monthYearMatch) return `${monthYearMatch[1]} ${monthYearMatch[2]}`;

    // Match patterns like "May 1 – May 31" or "May 1 - May 31"
    const rangeMatch = text.match(
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2})\s*[-–]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2})\b/i
    );
    if (rangeMatch) return `${rangeMatch[1]} – ${rangeMatch[2]}`;

    return null;
  }

  /**
   * Extract subscription or membership name from text.
   * @param {string} subject
   * @param {string} snippet
   * @returns {{ subscriptionName: string|null, membershipName: string|null }}
   */
  extractSubscriptionInfo(subject, snippet) {
    const text = `${subject || ''} ${snippet || ''}`;
    let subscriptionName = null;
    let membershipName = null;

    // "Your YouTube Premium membership" or "YouTube Premium subscription"
    const subMatch = text.match(/(\w[\w\s]+?)\s+subscription/i);
    if (subMatch) subscriptionName = subMatch[1].trim();

    const memMatch = text.match(/(\w[\w\s]+?)\s+membership/i);
    if (memMatch) membershipName = memMatch[1].trim();

    return { subscriptionName, membershipName };
  }

  /**
   * Extract payment method from text.
   * @param {string} body
   * @returns {string|null}
   */
  extractPaymentMethod(body) {
    if (!body) return null;

    // "Visa ending in 4242" or "Mastercard ****1234"
    const cardMatch = body.match(
      /\b(Visa|Mastercard|MasterCard|Amex|American Express|RuPay|Rupay)\s*(?:ending\s*(?:in|with)?|[*]{2,})\s*(\d{4})\b/i
    );
    if (cardMatch) return `${cardMatch[1]} ending ${cardMatch[2]}`;

    // "UPI" or "Net Banking" or "Google Pay"
    const upiMatch = body.match(/\b(UPI|Net Banking|Google Pay|PhonePe|Paytm|NEFT|IMPS)\b/i);
    if (upiMatch) return upiMatch[1];

    return null;
  }
}

export default new QualificationService();
