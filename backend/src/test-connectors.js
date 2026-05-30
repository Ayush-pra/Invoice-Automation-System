/**
 * Test script for testing Phase 2 platform connectors.
 * Run with: node src/test-connectors.js
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
  console.log('  TEST CONNECTORS VIA MANUAL TEST ROUTE')
  console.log('═══════════════════════════════════════════')

  // Login
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'rohan@test.com',
    password: 'password123'
  })
  const token = loginRes.data?.token
  if (!token) {
    console.log('❌ Login failed');
    return
  }

  // 1. Test Razorpay Connector
  console.log('\n─── Testing Razorpay Connector ───')
  const rzpRes = await request('GET', '/api/test/connector/razorpay', null, token)
  log('Razorpay Test', rzpRes)

  // 2. Test GitHub Connector
  console.log('\n─── Testing GitHub Connector ───')
  const ghRes = await request('GET', '/api/test/connector/github', null, token)
  log('GitHub Test', ghRes)

  // 3. Test OpenAI Connector
  console.log('\n─── Testing OpenAI Connector ───')
  const aiRes = await request('GET', '/api/test/connector/openai', null, token)
  log('OpenAI Test', aiRes)
}

run().catch(console.error)
