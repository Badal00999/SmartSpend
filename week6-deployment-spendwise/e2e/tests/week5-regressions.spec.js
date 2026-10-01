import { test, expect } from '@playwright/test'
import { createAccount, signInWithToken, API } from './helpers.js'
import path from 'node:path'

test('W5 valid leap-day transaction survives UI save, API read and reload', async ({ page, request }) => {
  const account = await createAccount(request)
  await signInWithToken(page, account.token)
  await page.goto('/dashboard')
  await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()
  await page.getByRole('button', { name: /^add transaction$/i }).first().click()
  const dialog = page.locator('dialog[open]')
  await dialog.getByLabel('Title').fill('Leap-day regression evidence')
  await dialog.getByLabel(/amount/i).fill('125')
  await dialog.getByLabel('Date').fill('2024-02-29')
  await dialog.getByRole('button', { name: /add transaction/i }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  const row = page.getByRole('link', { name: 'Leap-day regression evidence', exact: true }).first()
  await expect(row).toBeVisible()
  const response = await request.get(`${API}/transactions`, { headers: { Authorization: `Bearer ${account.token}` } })
  expect((await response.json()).data[0]).toMatchObject({ date: '2024-02-29', amount: 125 })
  await row.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.resolve('../docs/evidence/screenshots/leap-day-ui.png'), fullPage: true })
})

test('W5 malformed date through same-origin browser fetch is rejected without database writes', async ({ page, request }) => {
  const account = await createAccount(request)
  await signInWithToken(page, account.token)
  await page.goto('/dashboard')
  await expect(page.getByText(/synced with spendwise api/i)).toBeVisible()
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('spendwise.auth.v1')}` },
      body: JSON.stringify({ title: 'Impossible day', amount: 125, type: 'expense', category: 'food', date: '2025-02-29' }),
    })
    return { status: response.status, body: await response.json() }
  })
  expect(result.status).toBe(422)
  expect(result.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'date' })]))
  const list = await request.get(`${API}/transactions`, { headers: { Authorization: `Bearer ${account.token}` } })
  expect((await list.json()).meta.total).toBe(0)
})
