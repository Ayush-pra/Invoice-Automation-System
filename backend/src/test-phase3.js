/**
 * Verification script for Phase 3: Email Parsing Layer
 * Run with: node src/test-phase3.js
 */

import 'dotenv/config'
import { getPlatformFromSender, isKnownBillingSender } from './connectors/email/senderMap.js'
import { uploadPDF, getSignedUrl, deleteFile } from './utils/cloudinary.js'
import { parsePDFInvoice } from './modules/email/email.service.js'

async function run() {
  console.log('═══════════════════════════════════════════')
  console.log('  PHASE 3 — EMAIL & STORAGE VERIFICATION')
  console.log('═══════════════════════════════════════════')

  // ─── TEST 1: Sender Map Logic ───
  console.log('\n─── TEST 1: Sender Map Logic ───')
  
  const test1 = getPlatformFromSender('billing@razorpay.com')
  const test2 = getPlatformFromSender('random@unknown.com')
  const test3 = isKnownBillingSender('noreply@github.com')
  const test4 = getPlatformFromSender('Github Billing <noreply@github.com>')

  console.log(`- From "billing@razorpay.com": ${test1} (Expected: razorpay)`)
  console.log(`- From "random@unknown.com": ${test2} (Expected: null)`)
  console.log(`- Is known: "noreply@github.com": ${test3} (Expected: true)`)
  console.log(`- From "Github Billing <noreply@github.com>": ${test4} (Expected: github)`)

  if (test1 === 'razorpay' && test2 === null && test3 === true && test4 === 'github') {
    console.log('✅ Sender Map Logic verified successfully!')
  } else {
    console.log('❌ Sender Map Logic validation failed!')
  }

  // ─── TEST 2: PDF Content Extraction ───
  console.log('\n─── TEST 2: PDF Parsing (pdf-parse) ───')
  // Simulating a parsed invoice text layout
  const mockInvoiceText = `
    INVOICE NUMBER: INV-2026-98745
    Date: May 29, 2026
    
    Item Description          Qty      Rate       Amount
    Enterprise Platform       1        $99.00     $99.00
    
    Total Amount Due: $99.00 USD
    Please remit payment to Notion Labs.
  `
  // We mock pdf-parse's returned text to test our regex parsing
  const parsedData = await parsePDFInvoice(mockInvoiceText)
  console.log('Parsed Amount:', parsedData.amount, '(Expected: 99)')
  console.log('Parsed Invoice ID:', parsedData.invoiceId, '(Expected: INV-2026-98745)')
  console.log('Parsed Currency:', parsedData.currency, '(Expected: USD)')

  if (parsedData.amount === 99 && parsedData.invoiceId === 'INV-2026-98745' && parsedData.currency === 'USD') {
    console.log('✅ PDF Parser regexes verified successfully!')
  } else {
    console.log('❌ PDF Parser regexes failed!')
  }

  // ─── TEST 3: Cloudinary Storage Upload ───
  console.log('\n─── TEST 3: Cloudinary Upload & Operations ───')
  
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.log('⚠️ Skipping Cloudinary test: Cloudinary credentials missing in .env')
  } else {
    try {
      const dummyPdfBuffer = Buffer.from('%PDF-1.4 ... dummy verification PDF content ...')
      const folder = 'invoices/test-company-id/2026/05'
      const filename = 'verification-test-invoice'

      console.log('Uploading sample PDF buffer to Cloudinary...')
      const uploadRes = await uploadPDF(dummyPdfBuffer, folder, filename)
      console.log('Upload Result:', uploadRes)

      const signedUrl = getSignedUrl(uploadRes.publicId)
      console.log('Generated Signed URL:', signedUrl)

      console.log('Deleting sample PDF from Cloudinary...')
      const deleteRes = await deleteFile(uploadRes.publicId)
      console.log('Delete Result:', deleteRes)

      console.log('✅ Cloudinary raw file lifecycle operations completed successfully!')
    } catch (error) {
      console.error('❌ Cloudinary operations failed:', error.message)
    }
  }

  // ─── TEST 4: Google Auth URL Generation ───
  console.log('\n─── TEST 4: Google Auth URL Generation ───')
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('⚠️ Skipping Auth URL test: Google OAuth client credentials missing in .env')
  } else {
    try {
      const { getGoogleAuthUrl } = await import('./modules/email/email.service.js')
      const authUrl = getGoogleAuthUrl()
      console.log('Generated Google Consent Screen URL:')
      console.log(authUrl)
      console.log('✅ Auth URL successfully generated!')
    } catch (err) {
      console.error('❌ Google Auth URL generation failed:', err.message)
    }
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  VERIFICATION COMPLETE')
  console.log('═══════════════════════════════════════════\n')
}

run().catch(console.error)
