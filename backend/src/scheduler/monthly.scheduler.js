import cron from 'node-cron'
import prisma from '../config/db.js'
import { addInvoiceJob } from '../queues/invoice.queue.js'
import worker from '../queues/invoice.worker.js'

/**
 * Trigger an invoice fetch job for all active subscriptions across the system.
 * 
 * @param {'scheduled'|'manual'} triggerType
 * @returns {Promise<number>} Number of jobs added to the queue
 */
const triggerScheduledFetch = async (triggerType = 'scheduled') => {
  console.log(`[Scheduler] Starting automated invoice fetch trigger (${triggerType})...`)
  
  try {
    // Fetch all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { isActive: true },
    })

    console.log(`[Scheduler] Found ${activeSubscriptions.length} active subscription(s) to fetch.`)

    let queuedCount = 0

    for (const sub of activeSubscriptions) {
      // Skip MANUAL subscriptions since they don't have connectors
      if (sub.method === 'MANUAL') {
        continue
      }

      await addInvoiceJob({
        subscriptionId: sub.id,
        userId: sub.userId,
        companyId: sub.companyId,
        platform: sub.platform,
        method: sub.method,
        triggerType,
      })

      queuedCount++
    }

    console.log(`[Scheduler] Successfully queued ${queuedCount} invoice fetch jobs.`)
    return queuedCount
  } catch (error) {
    console.error('[Scheduler] Error triggering scheduled fetch:', error.message)
    throw error
  }
}

/**
 * Trigger manual fetch run for all active subscriptions (manual trigger alias).
 */
const triggerManualRun = async () => {
  return triggerScheduledFetch('manual')
}

/**
 * Start the cron scheduler.
 * Runs on the 1st of every month at midnight by default ('0 0 1 * *').
 * Can be overridden via CRON_SCHEDULE env variable.
 */
const startScheduler = () => {
  const schedule = process.env.CRON_SCHEDULE || '0 0 1 * *'
  
  console.log(`[Scheduler] Initializing monthly invoice scheduler with expression: "${schedule}"`)
  
  cron.schedule(schedule, async () => {
    console.log('[Scheduler] Cron trigger activated. Queuing automated invoice scans.')
    try {
      await triggerScheduledFetch('scheduled')
    } catch (err) {
      console.error('[Scheduler] Scheduled cron execution failed:', err.message)
    }
  })
}

// ──────────────────────────────────────────────────────────
// WORKER completion listener to trigger automated reports
// ──────────────────────────────────────────────────────────
worker.on('completed', async (job) => {
  const { companyId } = job.data
  
  if (!companyId) return

  try {
    const { invoiceQueue } = await import('../queues/invoice.queue.js')
    
    // Query live active, waiting, and delayed jobs in BullMQ
    const jobs = await invoiceQueue.getJobs(['active', 'waiting', 'delayed'])
    
    // Check if there are other jobs for the same company still processing
    const remainingForCompany = jobs.filter(
      (j) => j.data?.companyId === companyId && j.id !== job.id
    )

    if (remainingForCompany.length === 0) {
      console.log(`[Scheduler] All invoice fetch jobs completed for company: ${companyId}. Initiating report trigger...`)

      // Wait 5 minutes (configurable via REPORT_TRIGGER_DELAY_MS for rapid tests)
      const delayMs = process.env.REPORT_TRIGGER_DELAY_MS
        ? parseInt(process.env.REPORT_TRIGGER_DELAY_MS)
        : 5 * 60 * 1000 // 5 minutes default

      setTimeout(async () => {
        try {
          const now = new Date()
          const month = now.getMonth() + 1 // 1-indexed
          const year = now.getFullYear()

          console.log(`[Scheduler] Delay elapsed. Launching report orchestrator for ${month}/${year}...`)
          const { generateAndSendReport } = await import('../modules/reports/report.service.js')
          await generateAndSendReport(companyId, month, year)
          console.log(`[Scheduler] Automated monthly report successfully dispatched to CA for ${companyId}`)
        } catch (err) {
          console.error(`[Scheduler] Automated report orchestrator failed for company ${companyId}:`, err.message)
        }
      }, delayMs)
    }
  } catch (err) {
    console.error(`[Scheduler] Error in worker job completion handler:`, err.message)
  }
})

export { startScheduler, triggerScheduledFetch, triggerManualRun }
