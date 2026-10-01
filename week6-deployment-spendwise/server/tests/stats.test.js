import { describe, it, expect } from 'vitest'
import { api, auth, createTx, registerAndLogin } from './helpers.js'

const BASE = '/api/v1/stats'

/** YYYY-MM-DD for today and for N months back (UTC, first of month). */
const today = new Date().toISOString().slice(0, 10)
const monthsAgo = (n) => {
  const d = new Date()
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1))
  return x.toISOString().slice(0, 10)
}

async function seed(token) {
  await createTx(token, { title: 'Salary', type: 'income', category: 'salary', amount: 85000, date: today })
  await createTx(token, { title: 'Food', type: 'expense', category: 'food', amount: 3000, date: today })
  await createTx(token, { title: 'Taxi', type: 'expense', category: 'transport', amount: 1000, date: today })
  await createTx(token, { title: 'Old rent', type: 'expense', category: 'bills', amount: 6000, date: monthsAgo(2) })
}

describe('GET /stats/summary', () => {
  it('returns totals, balance, count and this-month figures', async () => {
    const { token } = await registerAndLogin()
    await seed(token)
    const res = await api().get(`${BASE}/summary`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      income: 85000,
      expense: 10000,
      balance: 75000,
      transactionCount: 4,
      thisMonth: { income: 85000, expense: 4000 },
      currency: 'INR',
    })
  })

  it('returns zeros for a new user', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get(`${BASE}/summary`).set(auth(token))
    expect(res.body.data).toMatchObject({ income: 0, expense: 0, balance: 0, transactionCount: 0 })
  })

  it('respects a date range', async () => {
    const { token } = await registerAndLogin()
    await seed(token)
    const res = await api().get(`${BASE}/summary?from=${monthsAgo(3)}&to=${monthsAgo(1)}`).set(auth(token))
    expect(res.body.data.expense).toBe(6000)
    expect(res.body.data.income).toBe(0)
  })

  it('is isolated per user', async () => {
    const { token } = await registerAndLogin()
    const other = await registerAndLogin({ email: 'other@example.com' })
    await seed(other.token)
    const res = await api().get(`${BASE}/summary`).set(auth(token))
    expect(res.body.data.transactionCount).toBe(0)
  })
})

describe('GET /stats/by-category', () => {
  it('groups expenses by category with percentages, sorted descending', async () => {
    const { token } = await registerAndLogin()
    await seed(token)
    const res = await api().get(`${BASE}/by-category`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data.map((r) => r.category)).toEqual(['bills', 'food', 'transport'])
    expect(res.body.data[0]).toMatchObject({ category: 'bills', total: 6000, count: 1, percent: 60 })
    expect(res.body.meta.totalExpense).toBe(10000)
  })

  it('ignores income', async () => {
    const { token } = await registerAndLogin()
    await createTx(token, { type: 'income', category: 'salary', amount: 500 })
    const res = await api().get(`${BASE}/by-category`).set(auth(token))
    expect(res.body.data).toEqual([])
  })
})

describe('GET /stats/monthly', () => {
  it('returns one bucket per month including empty months', async () => {
    const { token } = await registerAndLogin()
    await seed(token)
    const res = await api().get(`${BASE}/monthly?months=3`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    const [old, mid, cur] = res.body.data
    expect(old).toMatchObject({ month: monthsAgo(2).slice(0, 7), income: 0, expense: 6000 })
    expect(mid).toMatchObject({ month: monthsAgo(1).slice(0, 7), income: 0, expense: 0 })
    expect(cur).toMatchObject({ month: today.slice(0, 7), income: 85000, expense: 4000 })
  })

  it('caps months at 24', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get(`${BASE}/monthly?months=99`).set(auth(token))
    expect(res.status).toBe(422)
  })

  it('requires auth', async () => {
    const res = await api().get(`${BASE}/monthly`)
    expect(res.status).toBe(401)
  })
})
