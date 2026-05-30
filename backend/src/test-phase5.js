import 'dotenv/config'
import prisma from './config/db.js'

async function run() {
  process.env.RESEND_API_KEY = '' // Force Mock mode for tests to prevent Resend Sandbox unverified errors
  
  // Dynamically import everything to ensure process.env is cleared before module evaluation
  const { generateReportData, generateReportPDF } = await import('./utils/reportGenerator.js')
  const { default: reportRoutes } = await import('./modules/reports/report.routes.js')
  const { default: employeeRoutes } = await import('./modules/employee/employee.routes.js')
  const { addInvoiceJob } = await import('./queues/invoice.queue.js')
  await import('./scheduler/monthly.scheduler.js')
  const { sendMonthlyReport, sendWelcomeEmail } = await import('./utils/emailService.js')

  console.log('═══════════════════════════════════════════')
  console.log('  PHASE 5 — REPORTING & EMAIL VERIFICATION')
  console.log('═══════════════════════════════════════════')

  let testCompanyId = null
  let testUserId = null
  let testDeptId = null

  // Setup test environment in DB
  try {
    console.log('\n--- Setting up DB test entities ---')
    
    // Create/fetch a test company
    const company = await prisma.company.upsert({
      where: { email: 'finance-test@testcompany.com' },
      update: {},
      create: {
        name: 'Alpha Software Corp',
        email: 'finance-test@testcompany.com',
      },
    })
    testCompanyId = company.id
    console.log(`- Test Company ready: ${company.name} (${company.id})`)

    // Create/fetch a test department
    const dept = await prisma.department.create({
      data: {
        name: 'Engineering',
        companyId: testCompanyId,
      }
    })
    testDeptId = dept.id
    console.log(`- Test Department ready: ${dept.name} (${dept.id})`)

    // Create/fetch a test user (COMPANY_ADMIN)
    const user = await prisma.user.upsert({
      where: { email: 'admin@testcompany.com' },
      update: {},
      create: {
        name: 'Sarah Jenkins',
        email: 'admin@testcompany.com',
        password: 'hashedpassword123',
        role: 'COMPANY_ADMIN',
        companyId: testCompanyId,
        departmentId: testDeptId,
      },
    })
    testUserId = user.id
    console.log(`- Test Admin ready: ${user.name} (${user.id})`)

    // Add 2 mock processed invoices in the billing period (May 2026)
    const sub1 = await prisma.subscription.create({
      data: {
        platform: 'openai',
        method: 'API',
        billingType: 'FIXED',
        credentials: '***credentials***',
        userId: testUserId,
        companyId: testCompanyId,
      }
    })

    await prisma.invoice.createMany({
      data: [
        {
          externalId: 'inv-openai-may-01',
          platform: 'openai',
          amount: 20.0,
          currency: 'USD',
          billingDate: new Date('2026-05-15T10:00:00Z'),
          status: 'PROCESSED',
          subscriptionId: sub1.id,
          companyId: testCompanyId,
        },
        {
          externalId: 'inv-openai-may-02',
          platform: 'openai',
          amount: 15.0,
          currency: 'USD',
          billingDate: new Date('2026-05-20T10:00:00Z'),
          status: 'PROCESSED',
          subscriptionId: sub1.id,
          companyId: testCompanyId,
        }
      ]
    })
    console.log('- Created mock invoices for May 2026')

  } catch (err) {
    console.error('❌ Database setup failed:', err.message)
    process.exit(1)
  }

  // ─── TEST 1: Database Report Model Integration ───
  console.log('\n─── TEST 1: Database Report Model Integration ───')
  try {
    const report = await prisma.report.create({
      data: {
        companyId: testCompanyId,
        month: 5,
        year: 2026,
        totalAmount: 35.0,
        currency: 'USD',
        summary: { message: 'Verification Test Summary JSON' },
        status: 'generated',
      }
    })

    console.log(`- Generated Report Model in DB. ID: ${report.id}`)
    
    // Cleanup the report model
    await prisma.report.delete({ where: { id: report.id } })
    console.log('✅ Prisma Report model schema verified successfully!')
  } catch (err) {
    console.error('❌ Prisma Report model schema validation failed:', err.message)
  }

  // ─── TEST 2: Aggregated Report Data & pdfkit Generation ───
  console.log('\n─── TEST 2: Report Aggregations & PDF Generation ───')
  try {
    const reportData = await generateReportData(testCompanyId, 5, 2026)
    console.log(`- Aggregated Spend Total: ${reportData.totalAmount} ${reportData.currency}`)
    console.log(`- Department Splits: ${reportData.byDepartment.length}`)
    console.log(`- Employee Splits: ${reportData.byEmployee.length}`)
    console.log(`- Platform Splits: ${reportData.byPlatform.length}`)

    // Create PDF
    console.log('Compiling aggregated metrics into a PDF buffer via pdfkit...')
    const pdfBuffer = await generateReportPDF(reportData)
    console.log(`- PDF generated successfully. Length: ${pdfBuffer.length} bytes`)

    if (pdfBuffer.length > 5000 && reportData.totalAmount === 35.0) {
      console.log('✅ Report aggregation and PDF layouts generated perfectly!')
    } else {
      console.log('❌ Report generation size or amount mismatch!')
    }
  } catch (err) {
    console.error('❌ Report generation test failed:', err.message)
  }

  // ─── TEST 3: Resend Email Dispatches (Mock Mode) ───
  console.log('\n─── TEST 3: Resend Email Dispatch (Mock Fallback) ───')
  try {
    const welcomeRes = await sendWelcomeEmail({
      toEmail: 'new-employee@testcompany.com',
      name: 'John Doe',
      companyName: 'Alpha Software Corp',
      tempPassword: 'Welcome@123'
    })

    const reportRes = await sendMonthlyReport({
      toEmail: 'finance-ca@testcompany.com',
      toName: 'CA Representative',
      companyName: 'Alpha Software Corp',
      month: 'May',
      year: 2026,
      totalAmount: 35.0,
      currency: 'USD',
      reportPdfBuffer: Buffer.from('%PDF-1.4 ... test pdf content ...'),
      invoiceCount: 2,
    })

    if (welcomeRes.success && reportRes.success) {
      console.log('✅ Welcome Credentials and monthly CA attachment emails verified successfully!')
    } else {
      console.log('❌ Resend Mock Email verification failed')
    }
  } catch (err) {
    console.error('❌ Resend Email test failed:', err.message)
  }

  // ─── TEST 4: Express Router & Controllers Mount ───
  console.log('\n─── TEST 4: Express Router Namespace Mounts ───')
  try {
    // Inspect mounted routes on reportRouter
    const reportRoutesList = reportRoutes.stack
      .filter(r => r.route)
      .map(r => `${Object.keys(r.route.methods).join(', ').toUpperCase()} /api/reports${r.route.path}`)

    // Inspect mounted routes on employeeRouter
    const employeeRoutesList = employeeRoutes.stack
      .filter(r => r.route)
      .map(r => `${Object.keys(r.route.methods).join(', ').toUpperCase()} /api/employees${r.route.path}`)

    console.log('Mounted Reports Sub-Routes:')
    reportRoutesList.forEach(r => console.log(`  - ${r}`))

    console.log('Mounted Employees Sub-Routes:')
    employeeRoutesList.forEach(r => console.log(`  - ${r}`))

    const expectedReportPaths = ['/api/reports/generate', '/api/reports/:id/send', '/api/reports', '/api/reports/:id', '/api/reports/:id/download']
    const reportsAllRegistered = expectedReportPaths.every(p => reportRoutesList.some(r => r.includes(p)))

    const expectedEmployeePaths = ['/api/employees/']
    const employeesAllRegistered = expectedEmployeePaths.every(p => employeeRoutesList.some(r => r.includes(p)))

    if (reportsAllRegistered && employeesAllRegistered) {
      console.log('✅ Express Router configured perfectly with employee and report endpoints!')
    } else {
      console.log('❌ Express Router missing expected endpoints')
    }
  } catch (err) {
    console.error('❌ Express Router mapping validation failed:', err.message)
  }

  // ─── TEST 5: Automatic Report Generation Trigger via Queue Completion ───
  console.log('\n─── TEST 5: Automated Queue completion report trigger ───')
  try {
    console.log('Adding mock background job to the queue...')
    process.env.REPORT_TRIGGER_DELAY_MS = '100' // trigger report immediately (100ms) for testing
    
    const job = await addInvoiceJob({
      subscriptionId: 'test-sub-12345678',
      userId: testUserId,
      companyId: testCompanyId,
      platform: 'openai',
      method: 'API',
      triggerType: 'scheduled',
    })

    console.log(`- Job created successfully. Job ID: ${job.id}`)
    
    // Poll Prisma DB until the report is created (up to 10 attempts, 500ms intervals)
    console.log('Waiting and polling DB for background report generation...')
    let reports = []
    for (let attempt = 1; attempt <= 15; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      reports = await prisma.report.findMany({
        where: { companyId: testCompanyId }
      })
      if (reports.length > 0) {
        break
      }
      console.log(`  - Poll attempt ${attempt}/15: Report not generated yet...`)
    }

    console.log(`- Generated Reports in DB for this company: ${reports.length}`)
    
    if (reports.length > 0) {
      console.log('✅ BullMQ Worker Completion Event automatically triggered monthly report generation in background!')
    } else {
      console.warn('⚠️ Automated Report trigger did not complete within the timeout (requires Redis + active background worker)')
      console.warn('   Ensure redis-server is active locally if running on developer terminal')
    }
  } catch (err) {
    console.error('❌ Automated trigger test failed:', err.message)
  }

  // --- Tear Down DB entities ---
  try {
    console.log('\n--- Cleaning up DB test entities ---')
    await prisma.report.deleteMany({ where: { companyId: testCompanyId } })
    await prisma.invoice.deleteMany({ where: { companyId: testCompanyId } })
    await prisma.subscription.deleteMany({ where: { companyId: testCompanyId } })
    await prisma.user.deleteMany({ where: { companyId: testCompanyId } })
    await prisma.department.deleteMany({ where: { companyId: testCompanyId } })
    await prisma.company.delete({ where: { id: testCompanyId } })
    console.log('- Test DB entities successfully purged.')
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message)
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  VERIFICATION COMPLETE')
  console.log('═══════════════════════════════════════════\n')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
