#!/usr/bin/env node
/**
 * Demo recorder (Week 4, deliverable 5: "a short video demonstration")
 * -------------------------------------------------------------------
 * Drives a real browser through the integrated stack and records it:
 *
 *   npm run video        (from the e2e folder, with the API + client running)
 *
 * Produces
 *   docs/video/spendwise-week4-demo.webm   – the screen recording
 *   docs/screenshots/*.png                 – stills used in the report
 *
 * Each step is announced with an on-screen caption overlay, so the recording
 * explains itself without a narrator.
 */
import { chromium } from '@playwright/test'
import { mkdir, rename, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const videoDir = path.join(repo, 'docs', 'video')
const shotDir = path.join(repo, 'docs', 'screenshots')
const API = 'http://127.0.0.1:4000/api/v1'
const WEB = 'http://localhost:5173'

const PASSWORD = 'Demo1234'
const DEMO_EMAIL = 'demo@spendwise.app'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** A small, deterministic data set used for every recording. */
const DEMO_ROWS = [
  { title: 'Monthly salary', amount: 45000, type: 'income', category: 'salary', payment: 'bank', date: '2026-09-01', notes: 'September payroll' },
  { title: 'Grocery run – Reliance Fresh', amount: 2340, type: 'expense', category: 'food', payment: 'upi', date: '2026-09-03', notes: 'Weekly vegetables' },
  { title: 'Uber to office', amount: 268, type: 'expense', category: 'transport', payment: 'upi', date: '2026-09-04' },
  { title: 'Electricity bill', amount: 1875, type: 'expense', category: 'bills', payment: 'bank', date: '2026-09-05' },
  { title: 'Movie night', amount: 640, type: 'expense', category: 'entertainment', payment: 'card', date: '2026-09-06' },
  { title: 'Pharmacy', amount: 430, type: 'expense', category: 'health', payment: 'cash', date: '2026-09-07' },
  { title: 'Udemy course', amount: 799, type: 'expense', category: 'education', payment: 'card', date: '2026-09-08' },
  { title: 'New shoes', amount: 3200, type: 'expense', category: 'shopping', payment: 'card', date: '2026-09-09' },
  { title: 'Weekend trip', amount: 5400, type: 'expense', category: 'travel', payment: 'card', date: '2026-09-10' },
  { title: 'Freelance project', amount: 15000, type: 'income', category: 'freelance', payment: 'bank', date: '2026-09-11' },
  { title: 'Internet bill', amount: 999, type: 'expense', category: 'bills', payment: 'upi', date: '2026-09-12' },
  { title: 'Cafe with friends', amount: 780, type: 'expense', category: 'food', payment: 'upi', date: '2026-09-13' },
]

/** Draw a caption banner so the video is self-explanatory. */
async function caption(page, step, text) {
  await page.evaluate(
    ([stepText, body]) => {
      let box = document.getElementById('demo-caption')
      if (!box) {
        box = document.createElement('div')
        box.id = 'demo-caption'
        box.style.cssText = [
          'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
          'background:linear-gradient(90deg,#0f766e,#115e59)', 'color:#fff',
          'font:600 15px/1.45 system-ui,Segoe UI,sans-serif', 'padding:14px 22px',
          'box-shadow:0 -4px 24px rgba(0,0,0,.35)', 'transition:opacity .2s',
        ].join(';')
        document.body.appendChild(box)
      }
      box.innerHTML =
        `<span style="display:inline-block;min-width:26px;padding:2px 8px;margin-right:10px;border-radius:999px;background:rgba(255,255,255,.22);font-size:12px">${stepText}</span>${body}`
    },
    [step, text],
  )
}

/** Scroll an element into view (window.scrollTo – scrollIntoViewIfNeeded is unreliable here). */
async function scrollTo(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'auto' })
  }, selector)
  await sleep(500)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: false })
}

async function main() {
  await mkdir(videoDir, { recursive: true })
  await mkdir(shotDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
    baseURL: WEB,
  })
  const page = await context.newPage()

  // ---- 1. Landing / login ------------------------------------------------
  await page.goto('/login')
  await caption(page, '1/9', 'Signing in to the <b>SpendWise REST API</b> — the front-end gets a real JWT back')
  await sleep(2200)
  await shot(page, '01-login')

  await page.getByRole('button', { name: /try the demo account/i }).click()
  await page.getByText(/synced with spendwise api/i).waitFor()

  // Start from a clean slate so repeated recordings look identical
  const demoToken = await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))
  await page.request.delete(`${API}/transactions`, { headers: { Authorization: `Bearer ${demoToken}` } })
  await page.request.post(`${API}/transactions/bulk`, {
    headers: { Authorization: `Bearer ${demoToken}` },
    data: DEMO_ROWS,
  })
  await page.reload()
  await page.getByText(/synced with spendwise api/i).waitFor()
  await caption(page, '2/9', 'Dashboard hydrates from <b>GET /transactions</b> + <b>/stats/*</b> — the "Live" pill is the open SSE stream')
  await sleep(3200)
  await shot(page, '02-dashboard-live')

  // ---- 2. Server-side paging / filtering ---------------------------------
  await scrollTo(page, '#tx-heading')
  await caption(page, '3/9', 'Pagination is <b>server-side</b>: the page number travels in the query string, <b>meta</b> comes back from MongoDB')
  await page.getByRole('button', { name: 'Next page' }).click()
  await sleep(1800)
  await shot(page, '03-server-pagination')

  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.getByLabel(/search transactions/i).fill('grocery')
  await scrollTo(page, '#tx-heading')
  await page.waitForTimeout(1200)
  await caption(page, '4/9', 'Search box → <b>GET /transactions?q=grocery</b> (indexed, escaped regex on the server)')
  await sleep(2600)
  await shot(page, '04-search')
  await page.getByLabel(/search transactions/i).fill('')
  await page.waitForTimeout(800)

  // ---- 3. Create with optimistic UI --------------------------------------
  await caption(page, '5/9', 'Adding a transaction: the row appears instantly (<b>optimistic update</b>) and is confirmed by <b>POST /transactions</b>')
  await page.getByRole('button', { name: /^add transaction$/i }).first().click()
  const dialog = page.locator('dialog[open]')
  await dialog.getByLabel('Title').fill('Recorded demo purchase')
  await dialog.getByLabel(/amount/i).fill('499')
  await dialog.getByLabel('Category').selectOption('shopping')
  await sleep(1600)
  await dialog.getByRole('button', { name: /add transaction/i }).click()
  await page.getByText('Transaction added').waitFor()
  // scroll so the freshly added row is in frame for the screenshot
  const freshRow = page.getByRole('link', { name: /recorded demo purchase/i }).first()
  await freshRow.waitFor({ timeout: 20_000 }).catch(() => console.warn('  ! new row not visible in time'))
  await scrollTo(page, '#tx-heading')
  await sleep(1600)
  await shot(page, '05-optimistic-create')

  // ---- 4. Realtime sync (SSE) -------------------------------------------
  await caption(page, '6/9', 'A change made <b>by another device</b> (sent straight to the API) shows up here by itself — Server-Sent Events')
  const token = await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))
  const res = await page.request.post(`${API}/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'Added on another device',
      amount: 1250,
      type: 'expense',
      category: 'bills',
      payment: 'upi',
      date: new Date().toISOString().slice(0, 10),
      notes: 'Pushed through the REST API while the page stayed open',
    },
  })
  if (!res.ok()) console.warn('  ! API call failed:', await res.text())
  const remoteRow = page.getByRole('link', { name: /added on another device/i }).first()
  await remoteRow.waitFor({ timeout: 20_000 }).catch(() => console.warn('  ! realtime row not visible in time'))
  await scrollTo(page, '#tx-heading')
  await sleep(1600)
  await shot(page, '06-realtime-sync')

  // ---- 5. Settings -------------------------------------------------------
  await page.goto('/settings')
  await caption(page, '7/9', 'Settings talks to endpoints the old UI never used: <b>PATCH /auth/me</b>, <b>/auth/password</b>, <b>DELETE /transactions</b>')
  await sleep(2600)
  await shot(page, '07-settings')
  await page.getByLabel(/display name/i).fill('Demo User')
  await page.getByRole('button', { name: /save profile/i }).click()
  await page.getByText(/profile saved/i).waitFor()
  await sleep(1400)

  // ---- 6. API documentation ---------------------------------------------
  await page.goto('http://127.0.0.1:4000/api/docs')
  await caption(page, '8/9', 'Swagger UI documents every endpoint — the same spec the client was written against')
  await page.waitForTimeout(2500)
  await shot(page, '08-swagger')

  // ---- 7. Errors are handled --------------------------------------------
  await page.goto('/dashboard')
  await page.route('**/api/v1/**', (route) => route.abort('failed'))
  await page.getByRole('button', { name: /sync now/i }).click().catch(() => {})
  await page.reload()
  await caption(page, '9/9', 'If the API is down the app degrades gracefully (banner + retry), and the session is kept')
  await page.getByText(/back-end not reachable/i).waitFor({ timeout: 15_000 })
  await sleep(2600)
  await shot(page, '09-graceful-error')

  const video = page.video()
  await context.close()
  await browser.close()

  // Playwright writes a random file name – give it a friendly one
  if (video) {
    const target = path.join(videoDir, 'spendwise-week4-demo.webm')
    await rm(target, { force: true })
    await rename(await video.path(), target)
    console.log(`\n✓ video  → ${path.relative(repo, target)}`)
  }
  const files = await readdir(shotDir)
  console.log(`✓ shots  → ${files.filter((f) => f.endsWith('.png')).length} png files in docs/screenshots`)
}

main().catch((err) => {
  console.error('Recording failed:', err)
  process.exit(1)
})
