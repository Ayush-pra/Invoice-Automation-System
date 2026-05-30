/**
 * End-to-end test suite for Phase 5
 * Run with: node src/run-e2e-tests.js
 */

const BASE = 'http://localhost:5000'

async function request(method, path, body = null, token = null, isMultipart = false) {
  const headers = {}
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options = { method, headers }
  if (body) {
    if (isMultipart) {
      options.body = body
    } else {
      options.body = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

function log(label, result) {
  const icon = result.status < 400 ? '✅' : '❌'
  console.log(`\n${icon} ${label} — Status: ${result.status}`)
  console.log(JSON.stringify(result.data, null, 2))
}

async function run() {
  console.log('═══════════════════════════════════════════')
  console.log('  PHASE 5 — E2E INTEGRATION TESTS')
  console.log('═══════════════════════════════════════════')

  // ─── STEP 1: Login ───
  console.log('\n─── STEP 1: Login ───')
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'rohan@test.com',
    password: 'password123'
  })
  log('Login as Admin', loginRes)
  const token = loginRes.data?.token
  if (!token) {
    console.log('❌ Cannot continue without auth token');
    process.exit(1);
  }

  // Get user subscriptions to associate the invoice with
  console.log('\n─── GET USER SUBSCRIPTIONS ───')
  const mySubs = await request('GET', '/api/subscriptions/my', null, token)
  log('Fetch User Subscriptions', mySubs)
  const sub = mySubs.data?.[0]
  if (!sub) {
    console.log('❌ No active subscriptions found. Cannot test invoice creation.');
    process.exit(1);
  }
  console.log(`Using Subscription ID: ${sub.id} (Platform: ${sub.platform})`)

  // ─── STEP 2: Check Invoices & Create manual if none exist ───
  console.log('\n─── STEP 2: Check Invoices & Create manual ───')
  const getInvoices = await request('GET', '/api/invoices', null, token)
  log('Fetch Invoices', getInvoices)

  const hasMay2026Invoices = getInvoices.data?.some(inv => {
    const d = new Date(inv.billingDate)
    return d.getFullYear() === 2026 && (d.getMonth() + 1) === 5
  })

  if (!hasMay2026Invoices) {
    console.log('\n- No invoices found for May 2026. Creating a manual invoice...')
    // Build multi-part form data
    const formData = new FormData()
    formData.append('subscriptionId', sub.id)
    formData.append('amount', '500')
    formData.append('currency', 'INR')
    formData.append('billingDate', '2026-05-01')
    formData.append('invoiceId', `manual-may-2026-${Date.now()}`)
    
    // Optional: add a dummy PDF blob
    const dummyBlob = new Blob(['%PDF-1.4 ... dummy content ...'], { type: 'application/pdf' })
    formData.append('pdf', dummyBlob, 'invoice.pdf')

    const createInvoiceRes = await request('POST', '/api/invoices/manual', formData, token, true)
    log('Create Invoice', createInvoiceRes)
    if (createInvoiceRes.status >= 400) {
      console.log('❌ Failed to create invoice. Cannot proceed.');
      process.exit(1);
    }
  } else {
    console.log('✅ Invoices for May 2026 already exist in the database.')
  }

  // ─── TEST 1: Generate Report ───
  console.log('\n─── TEST 1: Generate Report (May 2026) ───')
  const genReportRes = await request('POST', '/api/reports/generate', {
    month: 5,
    year: 2026
  }, token)
  log('Generate Report', genReportRes)
  const reportId = genReportRes.data?.id
  if (!reportId) {
    console.log('❌ Report generation failed. Cannot proceed.');
    process.exit(1);
  }

  // ─── TEST 2: Send Monthly CA Report ───
  console.log('\n─── TEST 2: Send Monthly CA Report ───')
  const sendReportRes = await request('POST', `/api/reports/${reportId}/send`, {}, token)
  log('Send Report to CA', sendReportRes)

  // ─── TEST 3: Fetch Monthly Reports (List) ───
  console.log('\n─── TEST 3: Fetch Monthly Reports List ───')
  const listReportsRes = await request('GET', '/api/reports', null, token)
  log('List Reports', listReportsRes)

  // ─── TEST 4: Get Single Report Details ───
  console.log('\n─── TEST 4: Get Single Report Details ───')
  const reportDetailsRes = await request('GET', `/api/reports/${reportId}`, null, token)
  log('Report Details', reportDetailsRes)

  // ─── TEST 5: Get Report Download Link ───
  console.log('\n─── TEST 5: Get Report Download Link ───')
  const downloadLinkRes = await request('GET', `/api/reports/${reportId}/download`, null, token)
  log('Download Link', downloadLinkRes)

  // ─── TEST 6: Invite Employee ───
  console.log('\n─── TEST 6: Invite Employee ───')
  const uniqueEmail = `employee-${Date.now()}@acme.com`
  const inviteRes = await request('POST', '/api/employees', {
    email: uniqueEmail,
    name: 'John Doe',
    role: 'EMPLOYEE'
  }, token)
  log('Invite Employee', inviteRes)

  console.log('\n═══════════════════════════════════════════')
  console.log('  ALL E2E INTEGRATION TESTS COMPLETED!')
  console.log('═══════════════════════════════════════════\n')
}

run().catch((err) => {
  console.error('Unhandled test failure:', err)
  process.exit(1)
})
