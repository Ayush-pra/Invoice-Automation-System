import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'

import authRoutes from './src/modules/auth/auth.routes.js'
import companyRoutes from './src/modules/company/company.routes.js'
import employeeRoutes from './src/modules/employee/employee.routes.js'
import subscriptionRoutes from './src/modules/subscription/subscription.routes.js'
import invoiceRoutes from './src/modules/invoice/invoice.routes.js'
import emailRoutes from './src/modules/email/email.routes.js'
import reportRoutes from './src/modules/reports/report.routes.js'
import dashboardRoutes from './src/modules/dashboard/dashboard.routes.js'
import budgetRoutes from './src/modules/budget/budget.routes.js'
import './src/queues/invoice.worker.js'
import { startScheduler } from './src/scheduler/monthly.scheduler.js'

import protect from './src/middlewares/auth.middleware.js'
import authorize from './src/middlewares/role.middleware.js'
import { getConnector, fetchInvoicesForSubscription } from './src/connectors/connectorManager.js'

const app = express()

// Security & parsing middleware
app.use(helmet())
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Invoice Automation System API' })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/email', emailRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/budget', budgetRoutes)

// ──────────────────────────────────────────────────────────
// TEST ROUTE — REMOVE THIS IN PRODUCTION
// Manual connector test: GET /api/test/connector/:platform
// Uses env-based test credentials to validate connectors
// ──────────────────────────────────────────────────────────
app.get('/api/test/connector/:platform', protect, authorize('COMPANY_ADMIN'), async (req, res, next) => {
  try {
    const { platform } = req.params

    // Test credentials from environment variables
    const testCredentials = {
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
      },
      github: {
        token: process.env.GITHUB_TEST_TOKEN,
      },
      openai: {
        apiKey: process.env.OPENAI_TEST_API_KEY,
      },
      figma: {
        email: 'test@example.com',
        password: 'test-password',
      },
    }

    const credentials = testCredentials[platform.toLowerCase()]
    if (!credentials) {
      return res.status(400).json({
        error: `No test credentials configured for platform '${platform}'`,
        availablePlatforms: Object.keys(testCredentials),
      })
    }

    const connector = await getConnector(platform)
    const invoices = await connector.fetchInvoices(credentials)

    res.json({
      platform,
      invoiceCount: invoices.length,
      invoices: invoices.map(inv => ({
        ...inv,
        pdfBuffer: inv.pdfBuffer ? `<Buffer ${inv.pdfBuffer.length} bytes>` : null,
      })),
    })
  } catch (error) {
    next(error)
  }
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  startScheduler()
})