// Local production-mode smoke, NOT public deployment evidence.
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import https from 'node:https'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const reservation = createServer()
reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening')
const port = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const base = `http://localhost:${port}`
let proxy, certDir
let browserOrigin = 'https://spendwise.example'
if (process.argv.includes('--browser')) {
  certDir = mkdtempSync(path.join(tmpdir(), 'spendwise-tls-'))
  const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', path.join(certDir, 'key.pem'), '-out', path.join(certDir, 'cert.pem'),
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' })
  assert.equal(generated.status, 0, 'Optional TLS browser smoke requires OpenSSL installed')
  proxy = https.createServer({ key: readFileSync(path.join(certDir, 'key.pem')), cert: readFileSync(path.join(certDir, 'cert.pem')) }, (req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port, path: req.url, method: req.method,
      headers: { ...req.headers, 'x-forwarded-proto': 'https' } }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res)
    })
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
    req.on('close', () => { if (!req.complete) upstream.destroy() })
    res.on('close', () => upstream.destroy())
    req.pipe(upstream)
  })
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening')
  browserOrigin = `https://localhost:${proxy.address().port}`
}
const database = await MongoMemoryServer.create()
const secret = randomBytes(48).toString('hex')
let child
let output = ''
async function start(extra = {}) {
  output = ''
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.env.SMOKE_SERVER_DIR || fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), JWT_SECRET: secret,
      MONGODB_URI: database.getUri('production_smoke'), CORS_ORIGIN: browserOrigin,
      SERVE_CLIENT: 'true', ...extra }, stdio: ['ignore','pipe','pipe'],
  })
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Production child exited before readiness (see configuration).')
    try { const res = await fetch(`${base}/api/v1/ready`); if (res.ok) return } catch { /* wait for startup */ }
    await delay(100)
  }
  throw new Error('Local production readiness timeout')
}
async function stop() {
  if (!child || child.exitCode !== null) return
  const ended = once(child, 'exit')
  child.kill('SIGTERM')
  const [code] = await ended
  assert.equal(code, 0, 'Graceful shutdown should exit successfully')
}
async function json(url, options = {}) {
  const res = await fetch(base + url, options)
  return { status: res.status, body: await res.json() }
}
try {
  await start()
  const shell = await fetch(base + '/')
  assert.equal(shell.status, 200)
  assert((await shell.text()).includes('id="root"'))
  assert(shell.headers.get('content-security-policy')?.includes("default-src 'self'"))
  assert.equal((await fetch(base + '/settings')).status, 200)
  assert.equal((await fetch(base + '/api/docs')).status, 404)
  assert.equal((await fetch(base + '/api/v1/openapi.json')).status, 404)
  console.log('PASS: production SPA root/deep link, CSP and disabled Swagger')
  const password = randomBytes(16).toString('hex') + 'A1'
  const account = await json('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Production Smoke', email: 'production-smoke@example.test', password }) })
  assert.equal(account.status, 201)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${account.body.data.token}` }
  const created = await json('/api/v1/transactions', { method: 'POST', headers,
    body: JSON.stringify({ title: 'Restart persistence', amount: 123, type: 'expense', category: 'food', date: '2024-02-29' }) })
  assert.equal(created.status, 201)
  const id = created.body.data.id
  console.log('PASS: authenticated transaction creation with production configuration')
  if (process.argv.includes('--browser')) {
    const require = createRequire(new URL('../../e2e/package.json', import.meta.url))
    const { chromium } = require('@playwright/test')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ ignoreHTTPSErrors: true })
      const violations = []
      page.on('pageerror', err => console.log('BROWSER ERROR:', err.message))
      page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER CONSOLE:', msg.text()) })
      page.on('requestfailed', req => console.log('BROWSER REQUEST FAILED:', req.url().split('?')[0], req.failure()?.errorText))
      page.on('console', msg => { if (/violates.*Content Security Policy|Refused to.*Content Security Policy/i.test(msg.text())) violations.push(msg.text()) })
      await page.goto(browserOrigin + '/login')
      await page.getByRole('heading', { name: 'Welcome back' }).waitFor({ timeout: 5000 }).catch(e => { console.log('SERVER DIAGNOSTIC:', output); throw e })
      assert.equal(await page.getByRole('button', { name: 'Try the demo account' }).count(), 0)
      await page.addInitScript(token => localStorage.setItem('spendwise.auth.v1', token), account.body.data.token)
      await page.goto(browserOrigin + '/dashboard')
      await page.getByRole('link', { name: 'Restart persistence', exact: true }).first().waitFor()
      assert.equal(violations.length, 0, 'Production page must render without CSP errors')
      console.log('PASS: Chromium built-client login/dashboard, production demo button hidden, no observed CSP errors')
    } finally { await browser.close() }
  }
  // Keep a live SSE request open during SIGTERM; it must not force a 10s exit.
  const stream = await fetch(base + '/api/v1/events/stream', { headers })
  assert.equal(stream.status, 200)
  await stop(); await stream.body.cancel(); await start()
  const restored = await json(`/api/v1/transactions/${id}`, { headers })
  assert.equal(restored.status, 200); assert.equal(restored.body.data.amount, 123)
  const edited = await json(`/api/v1/transactions/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ amount: 456 }) })
  assert.equal(edited.body.data.amount, 456)
  assert.equal((await fetch(base + `/api/v1/transactions/${id}`, { method: 'DELETE', headers })).status, 204)
  console.log('PASS: data survives API process restart; edit and delete work')
  await stop()
  console.log('PASS: graceful shutdown with active SSE. Scope: local API/DB; optional local TLS proxy uses an ephemeral self-signed certificate. Not Render/Atlas/public UAT.')
} finally {
  if (child && child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'exit').catch(() => {}) }
  await database.stop()
  proxy?.closeAllConnections()
  if (proxy) await new Promise(resolve => proxy.close(resolve))
  if (certDir) rmSync(certDir, { recursive: true, force: true })
}
