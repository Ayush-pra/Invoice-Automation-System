import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const QUEUE_NAME = 'invoice-processing'

// Create Redis connection for queue
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

connection.on('connect', () => console.log('[Invoice Queue] Redis connected'))
connection.on('error', (err) => console.error('[Invoice Queue] Redis error:', err.message))

const invoiceQueue = new Queue(QUEUE_NAME, { connection })

/**
 * Add a job to the invoice processing queue.
 *
 * @param {Object} jobData
 * @param {string} jobData.subscriptionId
 * @param {string} jobData.userId
 * @param {string} jobData.companyId
 * @param {string} jobData.platform
 * @param {string} jobData.method
 * @param {'scheduled'|'manual'} jobData.triggerType
 */
const addInvoiceJob = async (jobData) => {
  const job = await invoiceQueue.add(
    `fetch-${jobData.platform}-${jobData.subscriptionId.slice(0, 8)}`,
    jobData,
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  )
  console.log(`[Invoice Queue] Job ${job.id} added for ${jobData.platform} (${jobData.triggerType})`)
  return job
}

export { invoiceQueue, addInvoiceJob, connection }
