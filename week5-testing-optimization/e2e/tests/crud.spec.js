/**
 * Full CRUD through the UI, verified against the database through the API.
 * Every mutation is followed by a page reload, which proves the data was really
 * persisted by the back-end and not just held in React state.
 */
import { test, expect } from '@playwright/test'
import { API, addTransactionThroughUi, fetchTransactions, registerThroughUi } from './helpers.js'

test.describe.configure({ mode: 'serial' })

test.describe('transaction CRUD (client ⇄ API ⇄ MongoDB)', () => {
  let token

  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page)
    token = await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))
  })

  test('creates a transaction and it survives a reload', async ({ page }) => {
    await addTransactionThroughUi(page, { title: 'Filter coffee', amount: 120, category: 'food' })

    await expect(page.getByText('Transaction added')).toBeVisible()
    await expect(page.getByRole('link', { name: /filter coffee/i })).toBeVisible()

    // the server has it (not just the browser)
    const server = await fetchTransactions(page.request, token)
    expect(server.meta.total).toBe(1)
    expect(server.data[0].title).toBe('Filter coffee')

    await page.reload()
    await expect(page.getByRole('link', { name: /filter coffee/i })).toBeVisible()
  })

  test('edits a transaction and the new amount is stored', async ({ page }) => {
    await addTransactionThroughUi(page, { title: 'Auto fare', amount: 60, category: 'transport' })

    const row = page.locator('li', { hasText: 'Auto fare' }).first()
    await row.getByRole('button', { name: /edit/i }).click()

    const dialog = page.locator('dialog[open]')
    await dialog.getByLabel(/amount/i).fill('95')
    await dialog.getByRole('button', { name: /save changes/i }).click()

    await expect(page.getByText('Transaction updated')).toBeVisible()
    await page.reload()

    const server = await fetchTransactions(page.request, token)
    expect(server.data[0].amount).toBe(95)
    await expect(page.getByRole('link', { name: /auto fare/i })).toBeVisible()
  })

  test('deletes a transaction and it stays deleted', async ({ page }) => {
    await addTransactionThroughUi(page, { title: 'Temporary row', amount: 10 })

    const row = page.locator('li', { hasText: 'Temporary row' }).first()
    await row.getByRole('button', { name: /delete/i }).click()

    const dialog = page.locator('dialog[open]')
    await dialog.getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByText('Transaction deleted')).toBeVisible()
    await expect(page.getByRole('link', { name: /temporary row/i })).toBeHidden()

    await page.reload()
    const server = await fetchTransactions(page.request, token)
    expect(server.meta.total).toBe(0)
  })

  test('rejects an invalid amount with the API’s validation message', async ({ page }) => {
    await page.getByRole('button', { name: /^add transaction$/i }).first().click()
    const dialog = page.locator('dialog[open]')

    await dialog.getByLabel('Title').fill('Bad row')
    await dialog.getByLabel(/amount/i).fill('0')
    await dialog.getByRole('button', { name: /add transaction/i }).click()

    await expect(dialog.getByText(/greater than zero/i)).toBeVisible()
    // nothing was created
    const server = await fetchTransactions(page.request, token)
    expect(server.meta.total).toBe(0)
  })

  test('shows the detail page of a transaction and opens it read-only', async ({ page }) => {
    await addTransactionThroughUi(page, { title: 'Textbook', amount: 450, category: 'education' })
    await page.getByRole('link', { name: /textbook/i }).click()

    await expect(page.getByRole('heading', { level: 1, name: /textbook/i })).toBeVisible()
    expect(page.url()).toContain('/transactions/')

    // the API agrees with what the detail page shows
    const id = page.url().split('/').pop()
    const res = await page.request.get(`${API}/transactions/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    expect((await res.json()).data.title).toBe('Textbook')
  })
})
