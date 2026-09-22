/**
 * Shared helpers for the Week 4 end-to-end suite.
 *
 * Accounts are created through the public API (`POST /auth/register`) so each
 * test starts with an empty, isolated account, and the UI is only used for the
 * behaviour under test.
 */
import { expect } from '@playwright/test'

export const API = 'http://127.0.0.1:4000/api/v1'
export const WEB = 'http://localhost:5173'
export const PASSWORD = 'Passw0rd123'
export const DEMO = { email: 'demo@spendwise.app', password: 'Demo1234' }

/** Unique email per call so tests never collide in the shared database. */
export function uniqueEmail(prefix = 'badal') {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`
}

/** Create an account straight through the REST API; returns { token, user, email }. */
export async function createAccount(request, { name = 'Badal Test', email = uniqueEmail() } = {}) {
  const res = await request.post(`${API}/auth/register`, {
    data: { name, email, password: PASSWORD },
  })
  expect(res.status(), `register failed: ${await res.text()}`).toBe(201)
  const body = await res.json()
  return { token: body.data.token, user: body.data.user, email, name }
}

/** Add transactions through the API (fast way to build a known data set). */
export async function seedTransactions(request, token, list) {
  const res = await request.post(`${API}/transactions/bulk`, {
    headers: { Authorization: `Bearer ${token}` },
    data: list,
  })
  expect(res.status(), `bulk import failed: ${await res.text()}`).toBe(201)
  return (await res.json()).data.items
}

/** Read the dashboard's own view of the data (proves server + client agree). */
export async function fetchTransactions(request, token, query = '') {
  const res = await request.get(`${API}/transactions${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

export async function fetchSummary(request, token) {
  const res = await request.get(`${API}/stats/summary`, { headers: { Authorization: `Bearer ${token}` } })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data
}

/**
 * Put a valid JWT into localStorage before the app boots, so a test can start
 * already signed in (equivalent to the "remember me" flow).
 */
export async function signInWithToken(page, token) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['spendwise.auth.v1', token],
  )
}

/** Register a brand-new account through the UI and wait for the dashboard. */
export async function registerThroughUi(page, { name = 'Badal Test', email = uniqueEmail() } = {}) {
  await page.goto('/register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()
  return email
}

/** Add a transaction with the dashboard modal. */
export async function addTransactionThroughUi(page, { title, amount, type = 'expense', category = 'food' }) {
  await page.getByRole('button', { name: /^add transaction$/i }).first().click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Title').fill(title)
  await dialog.getByLabel(/amount/i).fill(String(amount))
  await dialog.getByRole('radio', { name: type === 'income' ? 'Income' : 'Expense' }).check({ force: true })
  await dialog.getByLabel('Category').selectOption(category)

  await dialog.getByRole('button', { name: /add transaction|save changes/i }).click()
  await expect(dialog).toBeHidden()
}
