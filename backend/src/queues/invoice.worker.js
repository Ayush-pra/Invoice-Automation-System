import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import prisma from '../config/db.js'
import { fetchInvoicesForSubscription } from '../connectors/connectorManager.js'
import { uploadPDF } from '../utils/cloudinary.js'

const QUEUE_NAME = 'invoice-processing'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

connection.on('connect', () => console.log('[Invoice Worker] Redis connected'))
connection.on('error', (err) => console.error('[Invoice Worker] Redis error:', err.message))

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { subscriptionId, userId, companyId, platform, method, triggerType } = job.data
    console.log(`[Invoice Worker] Processing job ${job.id} for platform: ${platform}, trigger: ${triggerType}`)

    // 1. Fetch the subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!subscription) {
      console.warn(`[Invoice Worker] Subscription ${subscriptionId} not found, skipping job`)
      return { success: false, reason: 'Subscription not found' }
    }

    if (!subscription.isActive) {
      console.log(`[Invoice Worker] Subscription ${subscriptionId} is inactive, skipping job`)
      return { success: false, reason: 'Subscription is inactive' }
    }

    // 2. Fetch invoices for this subscription
    const invoices = await fetchInvoicesForSubscription(subscription)
    if (!invoices || invoices.length === 0) {
      console.log(`[Invoice Worker] No invoices fetched for subscription ${subscriptionId} (${platform})`)
      return { success: true, count: 0 }
    }

    let createdCount = 0
    let duplicateCount = 0

    // 3. Process and save each fetched invoice
    for (const invoice of invoices) {
      try {
        const externalId = invoice.invoiceId || `manual-${Date.now()}`

        // Check if duplicate exists
        const existing = await prisma.invoice.findFirst({
          where: {
            companyId,
            externalId,
          },
        })

        if (existing) {
          duplicateCount++
          continue
        }

        // Upload PDF to Cloudinary if a buffer is available but no URL is set
        let pdfUrl = invoice.pdfUrl
        if (invoice.pdfBuffer && !pdfUrl) {
          try {
            const dateObj = new Date(invoice.date || Date.now())
            const year = dateObj.getFullYear()
            const month = String(dateObj.getMonth() + 1).padStart(2, '0')
            const folderPath = `invoices/${companyId}/${year}/${month}`
            const cleanFilename = `${platform}-${externalId.replace(/[^a-zA-Z0-9-_]/g, '')}`

            const uploadResult = await uploadPDF(invoice.pdfBuffer, folderPath, cleanFilename)
            pdfUrl = uploadResult.url
          } catch (uploadErr) {
            console.error(`[Invoice Worker] Cloudinary upload failed for externalId ${externalId}:`, uploadErr.message)
          }
        }

        // Create the invoice record
        await prisma.invoice.create({
          data: {
            externalId,
            platform: invoice.platform || platform,
            amount: invoice.amount || 0.0,
            currency: invoice.currency || 'USD',
            billingDate: invoice.date ? new Date(invoice.date) : new Date(),
            pdfUrl,
            status: 'PROCESSED',
            subscriptionId: subscription.id,
            companyId,
            rawData: invoice.rawData || {},
          },
        })

        createdCount++
      } catch (err) {
        console.error(`[Invoice Worker] Error processing individual invoice from ${platform}:`, err.message)
      }
    }

    console.log(`[Invoice Worker] Completed job ${job.id}. Created: ${createdCount}, Duplicates: ${duplicateCount}`)
    return { success: true, created: createdCount, duplicates: duplicateCount }
  },
  {
    connection,
    concurrency: 2,
  }
)

worker.on('completed', (job, result) => {
  console.log(`[Invoice Worker] Job ${job.id} completed successfully:`, result)
})

worker.on('failed', (job, err) => {
  console.error(`[Invoice Worker] Job ${job?.id} failed:`, err.message)
})

export default worker
