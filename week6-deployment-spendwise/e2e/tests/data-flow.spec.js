/**
 * Data-flow tests: does the screen show exactly what the back-end computed?
 *
 *  • the transaction list is a *server-side* page (filters, search, sort, page
 *    number travel in the query string – `meta` comes back from the API)
 *  • the stat cards and charts render the numbers from /stats/*
 * Both are checked against the API's own responses, not against fixtures.
 */
import { test, expect } from '@playwright/test'
import { createAccount, fetchSummary, fetchTransactions, seedTransactions, signInWithToken } from './helpers.js'

const CATALOGUE = [
  { title: 'Coffee beans', amount: 900, type: 'expense', category: 'food', payment: 'upi', date: '2026-08-04' },
  { title: 'Monthly salary', amount: 60_000, type: 'income', category: 'salary', payment: 'bank', date: '2026-08-01' },
  { title: 'Metro card', amount: 500, type: 'expense', category: 'transport', payment: 'cash', date: '2026-08-05' },
  { title: 'Netflix', amount: 649, type: 'expense', category: 'entertainment', payment: 'card', date: '2026-08-06' },
  { title: 'Electricity bill', amount: 1_800, type: 'expense', category: 'bills', payment: 'bank', date: '2026-08-07' },
  { title: 'Doctor visit', amount: 1_200, type: 'expense', category: 'health', payment: 'upi', date: '2026-08-08' },
  { title: 'Course fee', amount: 2_500, type: 'expense', category: 'education', payment: 'card', date: '2026-08-09' },
  { title: 'Gym', amount: 1_000, type: 'expense', category: 'health', payment: 'card', date: '2026-08-10' },
  { title: 'New shoes', amount: 3_200, type: 'expense', category: 'shopping', payment: 'card', date: '2026-08-11' },
  { title: 'Book store', amount: 700, type: 'expense', category: 'education', payment: 'cash', date: '2026-08-12' },
  { title: 'Freelance project', amount: 15_000, type: 'income', category: 'salary', payment: 'bank', date: '2026-08-13' },
  { title: 'Cinema', amount: 400, type: 'expense', category: 'entertainment', payment: 'upi', date: '2026-08-14' },
]

test.describe('server-side list + statistics', () => {
  let token

  test.beforeEach(async ({ page, request }) => {
    const account = await createAccount(request, { email: `flow.${Date.now()}@example.com` })
    token = account.token
    await seedTransactions(request, token, CATALOGUE)
    await signInWithToken(page, token)
  })

  test('renders one server page at a time and paginates through the data', async ({ page }) => {
    await page.goto('/dashboard')

    // 12 rows, 8 per page → the API's meta drives the summary line
    await expect(page.getByText(/showing/i)).toContainText('Showing 1–8 of 12')

    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText(/showing/i)).toContainText('Showing 9–12 of 12')
    expect(page.url()).toContain('page=2')

    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(page.getByText(/showing/i)).toContainText('Showing 1–8 of 12')
  })

  test('filters by type on the server and keeps the query in the URL', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByLabel('Type').selectOption('income')

    await expect(page.getByText(/showing/i)).toContainText('of 2')
    expect(page.url()).toContain('type=income')

    // the same query against the API returns the same two rows
    const api = await fetchTransactions(page.request, token, '?type=income&limit=50')
    expect(api.meta.total).toBe(2)
    await expect(page.getByRole('link', { name: /monthly salary/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /coffee beans/i })).toBeHidden()
  })

  test('searches across title and notes through the API', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByLabel(/search transactions/i).fill('gym')

    await expect(page.getByRole('link', { name: /^gym/i })).toBeVisible()
    await expect(page.getByText(/showing/i)).toContainText('of 1')
    expect(page.url()).toContain('q=gym')

    const api = await fetchTransactions(page.request, token, '?q=gym')
    expect(api.meta.total).toBe(1)
  })

  test('sorts on the server (highest amount first)', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByLabel('Sort by').selectOption('amount-desc')

    const rows = page.locator('main li a')
    await expect(rows.first()).toContainText('Monthly salary') // 60,000
  })

  test('the stat cards show the numbers the API computed', async ({ page, request }) => {
    const api = await fetchSummary(request, token)
    await page.goto('/dashboard')

    const overview = page.locator('section[aria-label="Overview"]')
    await expect(overview).toContainText(api.balance.toLocaleString('en-IN'))
    await expect(overview).toContainText(api.expense.toLocaleString('en-IN'))
    await expect(page.getByText('Calculated by the API').first()).toBeVisible()

    // chart headings advertise the endpoints they came from
    await expect(page.getByText('/stats/monthly')).toBeVisible()
    await expect(page.getByText('/stats/by-category')).toBeVisible()
  })

  test('an empty account explains what to do next', async ({ page, request }) => {
    const empty = await createAccount(request, { email: `empty.${Date.now()}@example.com` })
    await signInWithToken(page, empty.token)
    await page.goto('/dashboard')

    await expect(page.getByText(/no transactions yet/i)).toBeVisible()
    await expect(page.getByText(/stored in mongodb/i)).toBeVisible()
  })
})
