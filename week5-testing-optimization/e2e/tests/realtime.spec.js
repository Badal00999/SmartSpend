/**
 * Realtime interaction (the "dynamic data processing and real-time interaction"
 * requirement of the Week 4 task).
 *
 * Two independent browser contexts represent two devices signed into the same
 * account. A change made in one must appear in the other without a reload –
 * carried by the Server-Sent Events stream, not by polling.
 */
import { test, expect } from '@playwright/test'
import { addTransactionThroughUi, createAccount, seedTransactions, signInWithToken } from './helpers.js'

test.describe('live sync across devices (SSE)', () => {
  test('a transaction added on one device appears on the other instantly', async ({ browser, request }) => {
    const account = await createAccount(request, { email: `live.${Date.now()}@example.com` })

    const deviceA = await browser.newContext()
    const deviceB = await browser.newContext()
    const pageA = await deviceA.newPage()
    const pageB = await deviceB.newPage()

    await signInWithToken(pageA, account.token)
    await signInWithToken(pageB, account.token)

    await pageA.goto('/dashboard')
    await pageB.goto('/dashboard')

    // Both devices hold an open event stream (the badge proves the handshake)
    await expect(pageA.getByTestId('sync-status')).toHaveText(/live/i)
    await expect(pageB.getByTestId('sync-status')).toHaveText(/live/i)

    // Device A adds a row…
    await addTransactionThroughUi(pageA, { title: 'Added on my phone', amount: 250, category: 'shopping' })
    await expect(pageA.getByRole('link', { name: /added on my phone/i })).toBeVisible()

    // …and device B shows it without any reload
    await expect(pageB.getByRole('link', { name: /added on my phone/i })).toBeVisible({ timeout: 15_000 })

    await deviceA.close()
    await deviceB.close()
  })

  test('deleting on one device removes the row on the other', async ({ browser, request }) => {
    const account = await createAccount(request, { email: `live2.${Date.now()}@example.com` })
    await seedTransactions(request, account.token, [
      { title: 'Shared dinner', amount: 800, type: 'expense', category: 'food', payment: 'upi', date: '2026-08-20' },
    ])

    const deviceA = await browser.newContext()
    const deviceB = await browser.newContext()
    const pageA = await deviceA.newPage()
    const pageB = await deviceB.newPage()
    await signInWithToken(pageA, account.token)
    await signInWithToken(pageB, account.token)

    await pageA.goto('/dashboard')
    await pageB.goto('/dashboard')
    await expect(pageB.getByRole('link', { name: /shared dinner/i })).toBeVisible()

    const row = pageA.locator('li', { hasText: 'Shared dinner' }).first()
    await row.getByRole('button', { name: /delete/i }).click()
    await pageA.locator('dialog[open]').getByRole('button', { name: /^delete$/i }).click()

    await expect(pageB.getByRole('link', { name: /shared dinner/i })).toBeHidden({ timeout: 15_000 })

    await deviceA.close()
    await deviceB.close()
  })

  test('the stream endpoint reports the open connections', async ({ page, request }) => {
    const account = await createAccount(request, { email: `stream.${Date.now()}@example.com` })
    await signInWithToken(page, account.token)
    await page.goto('/dashboard')
    await expect(page.getByTestId('sync-status')).toHaveText(/live/i)

    const res = await request.get('http://127.0.0.1:4000/api/v1/events/status', {
      headers: { Authorization: `Bearer ${account.token}` },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).data.thisUser).toBeGreaterThan(0)
  })
})
