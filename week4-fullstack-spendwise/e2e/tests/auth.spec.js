/**
 * Authentication integration: the React forms talk to POST /auth/register and
 * POST /auth/login, the JWT is kept in localStorage, and the dashboard switches
 * its data source to the API.
 */
import { test, expect } from '@playwright/test'
import { API, DEMO, PASSWORD, registerThroughUi, uniqueEmail } from './helpers.js'

test.describe('authentication', () => {
  test('registers a new account and shows the API-synced dashboard', async ({ page }) => {
    const email = uniqueEmail('register')

    await page.goto('/register')
    await page.getByLabel('Name').fill('Badal Test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: /create account/i }).click()

    // The header only renders this when AuthContext has a real API user
    await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    // ...and the account really exists on the server
    const token = await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))
    expect(token).toBeTruthy()

    // A brand-new account starts empty: the API says so too
    const list = await page.request.get(`${API}/transactions`, { headers: { Authorization: `Bearer ${token}` } })
    expect((await list.json()).meta.total).toBe(0)
  })

  test('signs in with the seeded demo account', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /try the demo account/i }).click()

    await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()
    // The demo account is seeded with 32 transactions by the server
    await expect(page.getByText(/showing/i)).toContainText('of 32')
  })

  test('shows the API error message for wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Password').fill('nope12345')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i)
  })

  test('validates the password policy before calling the API', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('Badal')
    await page.getByLabel('Email').fill(`short.${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('onlyletters')
    await page.getByRole('button', { name: /create account/i }).click()

    // 422-style inline error produced client-side – no request leaves the page
    await expect(page.getByText(/letter and one number/i)).toBeVisible()
  })

  test('drops an invalid stored token and falls back to guest mode', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('spendwise.auth.v1', 'not-a-real-jwt'))
    await page.goto('/dashboard')

    await expect(page.getByText(/guest mode/i)).toBeVisible()
    await expect(page.getByText(/synced with spendwise api/i)).toBeHidden()
    expect(await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))).toBeNull()
  })

  test('signs out back to guest mode', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /try the demo account/i }).click()
    await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()

    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page.getByText(/guest mode – data is stored/i)).toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem('spendwise.auth.v1'))).toBeNull()
  })

  test('the demo credentials are exactly what the README documents', async ({ page }) => {
    const res = await page.request.post(`${API}/auth/login`, {
      data: { email: DEMO.email, password: DEMO.password },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).data.token).toBeTruthy()
  })
})
