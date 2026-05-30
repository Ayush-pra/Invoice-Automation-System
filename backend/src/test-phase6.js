/**
 * End-to-end test suite for Phase 6: Finance Dashboard APIs + Budget
 * Run with: node src/test-phase6.js
 */

const BASE = 'http://localhost:5000'

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)

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
  console.log('  PHASE 6 — FINANCE DASHBOARD E2E TESTS')
  console.log('═══════════════════════════════════════════')

  // ─── Login ───
  console.log('\n─── Login ───')
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'rohan@test.com',
    password: 'password123'
  })
  log('Login', loginRes)
  const token = loginRes.data?.token
  if (!token) {
    console.log('❌ Cannot continue without token')
    process.exit(1)
  }

  // ─── TEST 1: Overview ───
  console.log('\n─── TEST 1: Dashboard Overview ───')
  const overviewRes = await request('GET', '/api/dashboard/overview?month=5&year=2026', null, token)
  log('Overview', overviewRes)

  // ─── TEST 2: Department Breakdown ───
  console.log('\n─── TEST 2: Department Breakdown ───')
  const deptRes = await request('GET', '/api/dashboard/departments?month=5&year=2026', null, token)
  log('Departments', deptRes)

  // ─── TEST 3: Employee Breakdown ───
  console.log('\n─── TEST 3: Employee Breakdown ───')
  const empRes = await request('GET', '/api/dashboard/employees?month=5&year=2026', null, token)
  log('Employees', empRes)

  // ─── TEST 4: Platform Breakdown ───
  console.log('\n─── TEST 4: Platform Breakdown ───')
  const platRes = await request('GET', '/api/dashboard/platforms?month=5&year=2026', null, token)
  log('Platforms', platRes)

  // ─── TEST 5: Spend Trend ───
  console.log('\n─── TEST 5: Spend Trend (6 months) ───')
  const trendRes = await request('GET', '/api/dashboard/trend?months=6', null, token)
  log('Trend', trendRes)
  if (Array.isArray(trendRes.data) && trendRes.data.length === 6) {
    console.log('✅ Trend returned exactly 6 months as expected')
  } else {
    console.log('❌ Trend did not return exactly 6 months')
  }

  // ─── TEST 6: Duplicate Subscriptions ───
  console.log('\n─── TEST 6: Duplicate Subscriptions ───')
  const dupRes = await request('GET', '/api/dashboard/duplicates', null, token)
  log('Duplicates', dupRes)

  // ─── TEST 7: Unused Subscriptions ───
  console.log('\n─── TEST 7: Unused Subscriptions ───')
  const unusedRes = await request('GET', '/api/dashboard/unused', null, token)
  log('Unused', unusedRes)

  // ─── TEST 8: Renewal Alerts ───
  console.log('\n─── TEST 8: Renewal Alerts ───')
  const renewalRes = await request('GET', '/api/dashboard/renewals', null, token)
  log('Renewals', renewalRes)

  // ─── TEST 9: Set Budget ───
  console.log('\n─── TEST 9: Set Budget ───')
  // First get departments
  const deptListRes = await request('GET', '/api/dashboard/departments?month=5&year=2026', null, token)
  let deptId = deptListRes.data?.[0]?.departmentId

  // If no departments from invoices, query company departments
  if (!deptId || deptId === 'unassigned') {
    console.log('  - No invoice-linked departments found, fetching company departments...')
    const compRes = await request('GET', '/api/companies', null, token)
    // Try to find a department from the company endpoint
    // Fallback: create a temporary test with the known company
  }

  if (deptId && deptId !== 'unassigned') {
    const budgetRes = await request('POST', '/api/budget', {
      departmentId: deptId,
      month: 5,
      year: 2026,
      amount: 10000,
    }, token)
    log('Set Budget', budgetRes)
    const budgetId = budgetRes.data?.id

    // ─── TEST 10: Budget vs Actual ───
    console.log('\n─── TEST 10: Budget vs Actual ───')
    const budgetListRes = await request('GET', '/api/budget?month=5&year=2026', null, token)
    log('Budget vs Actual', budgetListRes)

    // Cleanup: delete the budget
    if (budgetId) {
      console.log('\n─── Cleanup: Delete Budget ───')
      const deleteRes = await request('DELETE', `/api/budget/${budgetId}`, null, token)
      log('Delete Budget', deleteRes)
    }
  } else {
    console.log('⚠️ No department found to test budget. Skipping budget tests.')
    console.log('   Create a department first, then re-run.')
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  ALL PHASE 6 TESTS COMPLETED!')
  console.log('═══════════════════════════════════════════\n')
}

run().catch((err) => {
  console.error('Unhandled test failure:', err)
  process.exit(1)
})
