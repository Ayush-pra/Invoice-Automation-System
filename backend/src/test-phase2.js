/**
 * End-to-end test script for Phase 2: Subscription Module + Connector Architecture
 * Run with: node src/test-phase2.js
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
  console.log('  PHASE 2 — END-TO-END TEST SUITE')
  console.log('═══════════════════════════════════════════')

  // ─── TEST 1: Login ───
  console.log('\n─── TEST 1: Login ───')
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'rohan@test.com',
    password: 'password123'
  })
  log('Login', loginRes)
  const token = loginRes.data?.token
  if (!token) { console.log('❌ Cannot continue without token'); return }

  // ─── TEST 2: Get supported platforms ───
  console.log('\n─── TEST 2: Get Supported Platforms ───')
  const platformsRes = await request('GET', '/api/subscriptions/platforms', null, token)
  log('Platforms', platformsRes)

  // ─── TEST 3: Create subscription (OpenAI) ───
  console.log('\n─── TEST 3: Create Subscription (OpenAI) ───')
  const createRes = await request('POST', '/api/subscriptions', {
    platform: 'openai',
    credentials: { apiKey: 'sk-test-key-12345' }
  }, token)
  log('Create Subscription', createRes)
  const subId = createRes.data?.id

  // ─── TEST 4: Verify credentials are encrypted (not plain text) ───
  console.log('\n─── TEST 4: Verify Encryption ───')
  if (createRes.data?.credentials === '***encrypted***') {
    console.log('✅ Credentials are masked in API response')
  } else {
    console.log('❌ Credentials should be masked!')
  }

  // ─── TEST 5: Create subscription (GitHub) ───
  console.log('\n─── TEST 5: Create Subscription (GitHub) ───')
  const githubRes = await request('POST', '/api/subscriptions', {
    platform: 'github',
    credentials: { token: 'ghp_test-token-12345', orgName: 'my-org' }
  }, token)
  log('Create GitHub Subscription', githubRes)

  // ─── TEST 6: Create subscription with unsupported platform ───
  console.log('\n─── TEST 6: Unsupported Platform (should fail) ───')
  const badRes = await request('POST', '/api/subscriptions', {
    platform: 'slack',
    credentials: { apiKey: 'test' }
  }, token)
  log('Unsupported Platform', badRes)

  // ─── TEST 7: Create subscription with missing credentials ───
  console.log('\n─── TEST 7: Missing Credentials (should fail) ───')
  const missingRes = await request('POST', '/api/subscriptions', {
    platform: 'openai',
    credentials: {}
  }, token)
  log('Missing Credentials', missingRes)

  // ─── TEST 8: Get my subscriptions ───
  console.log('\n─── TEST 8: Get My Subscriptions ───')
  const mySubsRes = await request('GET', '/api/subscriptions/my', null, token)
  log('My Subscriptions', mySubsRes)
  console.log(`Found ${mySubsRes.data?.length || 0} subscription(s)`)

  // ─── TEST 9: Get all company subscriptions (admin) ───
  console.log('\n─── TEST 9: Get All Company Subscriptions ───')
  const allSubsRes = await request('GET', '/api/subscriptions', null, token)
  log('Company Subscriptions', allSubsRes)

  // ─── TEST 10: Trigger manual invoice fetch (connector test) ───
  if (subId) {
    console.log('\n─── TEST 10: Manual Invoice Fetch (OpenAI connector) ───')
    const fetchRes = await request('POST', `/api/subscriptions/${subId}/fetch`, null, token)
    log('Invoice Fetch', fetchRes)
  }

  // ─── TEST 11: Delete subscription ───
  if (subId) {
    console.log('\n─── TEST 11: Delete Subscription ───')
    const deleteRes = await request('DELETE', `/api/subscriptions/${subId}`, null, token)
    log('Delete', deleteRes)
  }

  // ─── TEST 12: Verify deletion ───
  console.log('\n─── TEST 12: Verify Deletion ───')
  const afterDeleteRes = await request('GET', '/api/subscriptions/my', null, token)
  log('After Delete', afterDeleteRes)
  console.log(`Remaining: ${afterDeleteRes.data?.length || 0} subscription(s)`)

  console.log('\n═══════════════════════════════════════════')
  console.log('  TEST SUITE COMPLETE')
  console.log('═══════════════════════════════════════════\n')
}

run().catch(console.error)
