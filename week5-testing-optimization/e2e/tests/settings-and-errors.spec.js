/**
 * Settings (two-way integration of profile + password + bulk delete) and the
 * graceful-error behaviour required by point 8 of the Week 4 task.
 */
import { test, expect } from '@playwright/test'
import { API, PASSWORD, createAccount, seedTransactions, signInWithToken, uniqueEmail } from './helpers.js'

const ROWS = [
  { title: 'Row one', amount: 100, type: 'expense', category: 'food', payment: 'upi', date: '2026-08-01' },
  { title: 'Row two', amount: 200, type: 'expense', category: 'food', payment: 'upi', date: '2026-08-02' },
]

test.describe('settings page', () => {
  test('renames the account through PATCH /auth/me', async ({ page, request }) => {
    const account = await createAccount(request, { email: uniqueEmail('settings') })
    await signInWithToken(page, account.token)
    await page.goto('/settings')

    const name = page.getByLabel(/display name/i)
    await expect(name).toHaveValue('Badal Test')
    await name.fill('Badal S.')
    await page.getByRole('button', { name: /save profile/i }).click()

    await expect(page.getByText(/profile saved/i)).toBeVisible()

    // the server is the source of truth
    const me = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${account.token}` } })
    expect((await me.json()).data.user.name).toBe('Badal S.')

    // and the change survives a reload (AuthContext re-verifies the token)
    await page.reload()
    await expect(page.getByLabel(/display name/i)).toHaveValue('Badal S.')
  })

  test('changes the password and can sign in with the new one', async ({ page, request }) => {
    const email = uniqueEmail('password')
    const account = await createAccount(request, { email })
    await signInWithToken(page, account.token)
    await page.goto('/settings')

    await page.getByLabel(/current password/i).fill(PASSWORD)
    await page.getByLabel(/new password/i).fill('Str0ngPassw0rd')
    await page.getByRole('button', { name: /change password/i }).click()
    await expect(page.getByText(/password updated/i)).toBeVisible()

    const login = await request.post(`${API}/auth/login`, { data: { email, password: 'Str0ngPassw0rd' } })
    expect(login.status()).toBe(200)

    const old = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } })
    expect(old.status()).toBe(401)
  })

  test('deletes every transaction with one request (danger zone)', async ({ page, request }) => {
    const account = await createAccount(request, { email: uniqueEmail('wipe') })
    await seedTransactions(request, account.token, ROWS)
    await signInWithToken(page, account.token)
    await page.goto('/settings')

    await expect(page.getByText(/2 transactions loaded from the API/i)).toBeVisible()

    await page.getByRole('button', { name: /delete all transactions/i }).click()
    await page.locator('dialog[open]').getByRole('button', { name: /yes, delete everything/i }).click()

    await expect(page.getByText(/deleted 2 transactions/i)).toBeVisible()

    const list = await request.get(`${API}/transactions`, { headers: { Authorization: `Bearer ${account.token}` } })
    expect((await list.json()).meta.total).toBe(0)
  })

  test('exports the account data as JSON', async ({ page, request }) => {
    const account = await createAccount(request, { email: uniqueEmail('export') })
    await seedTransactions(request, account.token, ROWS)
    await signInWithToken(page, account.token)
    await page.goto('/settings')

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /export as json/i }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/spendwise-export-\d{4}-\d{2}-\d{2}\.json/)
  })
})

test.describe('graceful error handling', () => {
  test('explains a stopped back-end instead of breaking the page', async ({ page, request }) => {
    const account = await createAccount(request, { email: uniqueEmail('offline') })
    await signInWithToken(page, account.token)

    // Simulate the API being down (server stopped / proxy error)
    await page.route('**/api/v1/**', (route) => route.abort('failed'))
    await page.goto('/dashboard')

    await expect(page.getByRole('alert').filter({ hasText: /back-end not reachable/i })).toBeVisible()
    // The shell still renders – no white screen, no crash
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // …and the session is kept, not thrown away
    expect(await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))).toBe(account.token)
  })

  test('the retry button recovers once the API answers again', async ({ page, request }) => {
    const account = await createAccount(request, { email: uniqueEmail('recover') })
    await signInWithToken(page, account.token)

    let blockApi = true
    await page.route('**/api/v1/**', (route) => (blockApi ? route.abort('failed') : route.continue()))
    await page.goto('/dashboard')
    await expect(page.getByRole('alert').filter({ hasText: /back-end not reachable/i })).toBeVisible()

    blockApi = false
    await page.getByRole('button', { name: /^retry$/i }).first().click()
    await expect(page.getByRole('alert').filter({ hasText: /back-end not reachable/i })).toBeHidden()
    // The stored token is re-verified, so the user is signed in again
    await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()
    await expect(page.getByTestId('sync-status')).toHaveText(/live/i)
  })

  test('an expired session sends the user back to the login page with an explanation', async ({ page, request }) => {
    const account = await createAccount(request, { email: uniqueEmail('expired') })
    await signInWithToken(page, account.token)
    await page.goto('/dashboard')

    // Any authenticated call that returns 401 must trigger the graceful sign-out
    await page.route('**/api/v1/transactions**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token has expired, please log in again' } }),
      }),
    )

    // The next authenticated call (the list request on reload) gets a 401 …
    await page.reload()
    // … the app signs the user out gracefully instead of showing failures
    await expect(page.getByText(/guest mode – data is stored/i)).toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))).toBeNull()

    await page.goto('/login')
    // the login page explains what happened (distinct from the toast text)
    await expect(page.getByText(/signed out to keep your data safe/i)).toBeVisible()
  })
})
