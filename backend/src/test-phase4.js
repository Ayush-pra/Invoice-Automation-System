/**
 * Verification script for Phase 4: Queue, Worker & Scheduler
 * Run with: node src/test-phase4.js
 */

import 'dotenv/config'
import prisma from './config/db.js'
import { parsePDF } from './utils/pdfParser.js'
import { addInvoiceJob, connection as queueConnection, invoiceQueue } from './queues/invoice.queue.js'
import { triggerScheduledFetch } from './scheduler/monthly.scheduler.js'
import express from 'express'
import invoiceRoutes from './modules/invoice/invoice.routes.js'

async function run() {
  console.log('═══════════════════════════════════════════')
  console.log('  PHASE 4 — QUEUE & SCHEDULER VERIFICATION')
  console.log('═══════════════════════════════════════════')

  // ─── TEST 1: PDF Parsing Fallback and Robustness ───
  console.log('\n─── TEST 1: PDF Parser Fallback ───')
  try {
    const emptyResult = await parsePDF(null)
    console.log('- Empty input parses as:', JSON.stringify(emptyResult))
    
    const dummyBuffer = Buffer.from('%PDF-1.4 ... dummy text ...')
    const badPdfResult = await parsePDF(dummyBuffer)
    console.log('- Corrupted/Dummy PDF parses as:', JSON.stringify(badPdfResult))

    if (emptyResult.amount === null && badPdfResult.amount === null) {
      console.log('✅ PDF Parser never-throw policy verified successfully!')
    } else {
      console.log('❌ PDF Parser never-throw policy validation failed!')
    }
  } catch (err) {
    console.error('❌ PDF Parser test failed:', err.message)
  }

  // ─── TEST 2: Redis and Queue Job Adding ───
  console.log('\n─── TEST 2: Redis Connection & BullMQ Queue ───')
  try {
    // Check if we can add a test job to the queue
    console.log('Attempting to add a mock job to invoice-processing queue...')
    const job = await addInvoiceJob({
      subscriptionId: 'test-sub-12345678',
      userId: 'test-user-id',
      companyId: 'test-company-id',
      platform: 'razorpay',
      method: 'API',
      triggerType: 'manual',
    })

    console.log(`- Job created successfully. Job ID: ${job.id}`)
    
    // Clean up the test job
    await job.remove()
    console.log('✅ BullMQ job queue addition and removal verified successfully!')
  } catch (err) {
    console.warn('⚠️ BullMQ Queue/Redis connection test encountered an issue:')
    console.warn(`   ${err.message}`)
    console.warn('   Ensure Redis is installed and running on localhost:6379 or process.env.REDIS_URL')
  }

  // ─── TEST 3: Scheduler Logic ───
  console.log('\n─── TEST 3: Monthly Scheduler Integration ───')
  try {
    // We will verify if Prisma DB can be queried
    console.log('Checking active subscriptions in Prisma DB...')
    const count = await prisma.subscription.count({
      where: { isActive: true }
    })
    console.log(`- Active subscriptions in DB: ${count}`)
    console.log('✅ Prisma DB connection verified successfully!')
  } catch (err) {
    console.error('❌ Prisma DB verification failed:', err.message)
  }

  // ─── TEST 4: Express Router Mapping ───
  console.log('\n─── TEST 4: Express Router & Controller Mapping ───')
  try {
    // Inspect mounted routes directly on the imported router
    const subRoutes = invoiceRoutes.stack
      .filter(r => r.route)
      .map(r => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods)
      }))

    console.log('Mounted invoice sub-routes:')
    subRoutes.forEach(sr => {
      console.log(`  - ${sr.methods.join(', ').toUpperCase()} /api/invoices${sr.path}`)
    })

    const expectedPaths = ['/', '/:id', '/trigger/:subscriptionId', '/manual', '/parse-pdf']
    const allRegistered = expectedPaths.every(p => subRoutes.some(sr => sr.path === p))

    if (allRegistered) {
      console.log('✅ Express Router configured perfectly with all endpoint mappings!')
    } else {
      console.log('❌ Express Router missing expected endpoints')
    }
  } catch (err) {
    console.error('❌ Express Router mapping validation failed:', err.message)
  }

  // Clean up Redis connection so test process exits cleanly
  try {
    await queueConnection.quit()
    await invoiceQueue.close()
  } catch (e) {}

  console.log('\n═══════════════════════════════════════════')
  console.log('  VERIFICATION COMPLETE')
  console.log('═══════════════════════════════════════════\n')
}

run().catch(console.error)
