import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')

/**
 * Parse a PDF buffer and extract invoice data using regex patterns.
 * NEVER throws — always returns partial data on failure.
 *
 * @param {Buffer|Uint8Array} pdfBuffer - Raw PDF file buffer
 * @returns {Promise<{
 *   rawText: string,
 *   amount: number|null,
 *   currency: string|null,
 *   invoiceId: string|null,
 *   date: Date|null,
 *   platformName: string|null
 * }>}
 */
const parsePDF = async (pdfBuffer) => {
  const empty = {
    rawText: '',
    amount: null,
    currency: null,
    invoiceId: null,
    date: null,
    platformName: null,
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    console.warn('[PDFParser] Empty or null buffer received')
    return empty
  }

  let rawText = ''

  try {
    const uint8 = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer)
    const parser = new PDFParse(uint8)
    const result = await parser.getText()
    rawText = result.text || ''
  } catch (err) {
    console.warn('[PDFParser] pdf-parse failed, returning empty result:', err.message)
    return empty
  }

  // --- Extract amount ---
  let amount = null
  const amountPatterns = [
    /total\s*(?:due|amount|charged|payable)?\s*[:=]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /amount\s*(?:due|paid|charged)?\s*[:=]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /balance\s*due\s*[:=]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /grand\s*total\s*[:=]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /₹\s*([\d,]+\.\d{2})/,
    /\$([\d,]+\.\d{2})/,
    /([\d,]+\.\d{2})\s*(?:USD|INR|EUR|GBP)/i,
  ]
  for (const regex of amountPatterns) {
    const match = rawText.match(regex)
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''))
      break
    }
  }

  // --- Extract currency ---
  let currency = null
  const curMatch = rawText.match(/(?:currency|cur)\s*[:=]?\s*(USD|INR|EUR|GBP|CAD|AUD)/i)
  if (curMatch) {
    currency = curMatch[1].toUpperCase()
  } else if (/₹/.test(rawText)) {
    currency = 'INR'
  } else if (/\$/.test(rawText)) {
    currency = 'USD'
  } else if (/€/.test(rawText)) {
    currency = 'EUR'
  } else if (/£/.test(rawText)) {
    currency = 'GBP'
  } else {
    const fallback = rawText.match(/(USD|INR|EUR|GBP|CAD|AUD)/i)
    if (fallback) currency = fallback[1].toUpperCase()
  }

  // --- Extract invoice ID ---
  let invoiceId = null
  const invPatterns = [
    /invoice\s*(?:number|no|id|#)\s*[:=]?\s*([A-Za-z0-9\-_#]+)/i,
    /receipt\s*(?:number|no|id|#)\s*[:=]?\s*([A-Za-z0-9\-_#]+)/i,
    /INV[- ]?(\d{4,})/i,
    /(?:ref|reference)\s*(?:number|no|id|#)\s*[:=]?\s*([A-Za-z0-9\-_#]+)/i,
  ]
  for (const regex of invPatterns) {
    const match = rawText.match(regex)
    if (match && match[1]) {
      invoiceId = match[1].trim()
      break
    }
  }

  // --- Extract date ---
  let date = null
  const datePatterns = [
    /(?:invoice\s*date|date\s*of\s*issue|billing\s*date|date)\s*[:=]?\s*(\w+ \d{1,2},?\s*\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}-\d{1,2}-\d{4})/,
    /(\w{3,9}\s+\d{1,2},?\s+\d{4})/i,
  ]
  for (const regex of datePatterns) {
    const match = rawText.match(regex)
    if (match) {
      const parsed = new Date(match[1])
      if (!isNaN(parsed.getTime())) {
        date = parsed
        break
      }
    }
  }

  // --- Extract platform name (first meaningful line) ---
  let platformName = null
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2)
  if (lines.length > 0) {
    platformName = lines[0].slice(0, 50) // first non-empty line, capped
  }

  return { rawText, amount, currency, invoiceId, date, platformName }
}

export { parsePDF }
