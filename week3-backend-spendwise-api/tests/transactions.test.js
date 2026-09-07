import { describe, it, expect } from 'vitest'
import { api, auth, createTx, registerAndLogin, sampleTx } from './helpers.js'

const BASE = '/api/v1/transactions'

describe('POST /transactions', () => {
  it('creates a transaction for the logged-in user', async () => {
    const { token, user } = await registerAndLogin()
    const res = await api().post(BASE).set(auth(token)).send(sampleTx)

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ ...sampleTx, user: user.id })
    expect(res.body.data.id).toMatch(/^[a-f\d]{24}$/)
    expect(res.body.data.date).toBe('2026-09-03') // returned as YYYY-MM-DD
  })

  it('applies defaults for payment and notes', async () => {
    const { token } = await registerAndLogin()
    const { payment, notes, ...minimal } = sampleTx
    const res = await api().post(BASE).set(auth(token)).send(minimal)
    expect(res.status).toBe(201)
    expect(res.body.data.payment).toBe('upi')
    expect(res.body.data.notes).toBe('')
  })

  it('coerces a numeric string amount', async () => {
    const { token } = await registerAndLogin()
    const res = await api().post(BASE).set(auth(token)).send({ ...sampleTx, amount: '99.5' })
    expect(res.status).toBe(201)
    expect(res.body.data.amount).toBe(99.5)
  })

  it('returns 422 with per-field details for invalid input', async () => {
    const { token } = await registerAndLogin()
    const res = await api()
      .post(BASE)
      .set(auth(token))
      .send({ title: '', amount: -1, type: 'gift', category: 'food', date: '2099-01-01' })

    expect(res.status).toBe(422)
    const byField = Object.fromEntries(res.body.error.details.map((d) => [d.field, d.message]))
    expect(byField.title).toMatch(/required/i)
    expect(byField.amount).toMatch(/greater than zero/)
    expect(byField.type).toBeDefined()
    expect(byField.date).toMatch(/future/)
  })

  it('rejects an invalid date format', async () => {
    const { token } = await registerAndLogin()
    const res = await api().post(BASE).set(auth(token)).send({ ...sampleTx, date: '03/09/2026' })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].field).toBe('date')
  })

  it('requires authentication', async () => {
    const res = await api().post(BASE).send(sampleTx)
    expect(res.status).toBe(401)
  })
})

describe('GET /transactions', () => {
  it('lists only the current user\'s transactions, newest first, with pagination meta', async () => {
    const { token } = await registerAndLogin()
    const other = await registerAndLogin({ email: 'other@example.com' })
    await createTx(token, { title: 'Old', date: '2026-08-01' })
    await createTx(token, { title: 'New', date: '2026-09-01' })
    await createTx(other.token, { title: 'Not mine' })

    const res = await api().get(BASE).set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.map((t) => t.title)).toEqual(['New', 'Old'])
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false })
  })

  it('paginates', async () => {
    const { token } = await registerAndLogin()
    for (let i = 1; i <= 5; i += 1) await createTx(token, { title: `T${i}`, date: `2026-09-0${i}` })

    const p1 = await api().get(`${BASE}?limit=2&page=1`).set(auth(token))
    const p3 = await api().get(`${BASE}?limit=2&page=3`).set(auth(token))
    expect(p1.body.data).toHaveLength(2)
    expect(p1.body.meta).toMatchObject({ total: 5, totalPages: 3, hasNext: true, hasPrev: false })
    expect(p3.body.data).toHaveLength(1)
    expect(p3.body.meta.hasNext).toBe(false)
  })

  it('filters by type, category, date range and amount', async () => {
    const { token } = await registerAndLogin()
    await createTx(token, { title: 'Salary', type: 'income', category: 'salary', amount: 85000, date: '2026-09-01' })
    await createTx(token, { title: 'Food', type: 'expense', category: 'food', amount: 500, date: '2026-08-15' })
    await createTx(token, { title: 'Taxi', type: 'expense', category: 'transport', amount: 250, date: '2026-09-02' })

    const income = await api().get(`${BASE}?type=income`).set(auth(token))
    expect(income.body.data.map((t) => t.title)).toEqual(['Salary'])

    const food = await api().get(`${BASE}?category=food`).set(auth(token))
    expect(food.body.data.map((t) => t.title)).toEqual(['Food'])

    const sept = await api().get(`${BASE}?from=2026-09-01&to=2026-09-30`).set(auth(token))
    expect(sept.body.data.map((t) => t.title).sort()).toEqual(['Salary', 'Taxi'])

    const cheap = await api().get(`${BASE}?maxAmount=300`).set(auth(token))
    expect(cheap.body.data.map((t) => t.title)).toEqual(['Taxi'])
  })

  it('searches title and notes case-insensitively and escapes regex characters', async () => {
    const { token } = await registerAndLogin()
    await createTx(token, { title: 'Netflix', notes: 'Standard plan' })
    await createTx(token, { title: 'Gym (quarterly)', notes: '' })

    const byNotes = await api().get(`${BASE}?q=STANDARD`).set(auth(token))
    expect(byNotes.body.data.map((t) => t.title)).toEqual(['Netflix'])

    const withParens = await api().get(`${BASE}?q=${encodeURIComponent('(quarterly)')}`).set(auth(token))
    expect(withParens.status).toBe(200)
    expect(withParens.body.data.map((t) => t.title)).toEqual(['Gym (quarterly)'])
  })

  it('sorts by amount ascending', async () => {
    const { token } = await registerAndLogin()
    await createTx(token, { amount: 300 })
    await createTx(token, { amount: 100 })
    await createTx(token, { amount: 200 })
    const res = await api().get(`${BASE}?sort=amount`).set(auth(token))
    expect(res.body.data.map((t) => t.amount)).toEqual([100, 200, 300])
  })

  it('rejects invalid query params', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get(`${BASE}?limit=500&sort=bogus`).set(auth(token))
    expect(res.status).toBe(422)
  })
})

describe('GET /transactions/:id', () => {
  it('returns one transaction', async () => {
    const { token } = await registerAndLogin()
    const tx = await createTx(token)
    const res = await api().get(`${BASE}/${tx.id}`).set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(tx.id)
  })

  it('returns 404 for another user\'s transaction (no data leak)', async () => {
    const { token } = await registerAndLogin()
    const other = await registerAndLogin({ email: 'other@example.com' })
    const tx = await createTx(other.token)
    const res = await api().get(`${BASE}/${tx.id}`).set(auth(token))
    expect(res.status).toBe(404)
  })

  it('returns 422 for a malformed id', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get(`${BASE}/not-an-id`).set(auth(token))
    expect(res.status).toBe(422)
  })

  it('returns 404 for a well-formed but unknown id', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get(`${BASE}/66d5f1a2b3c4d5e6f7a8b9c0`).set(auth(token))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /transactions/:id', () => {
  it('updates only the provided fields', async () => {
    const { token } = await registerAndLogin()
    const tx = await createTx(token)
    const res = await api().patch(`${BASE}/${tx.id}`).set(auth(token)).send({ amount: 2500 })

    expect(res.status).toBe(200)
    expect(res.body.data.amount).toBe(2500)
    expect(res.body.data.notes).toBe(sampleTx.notes) // untouched
    expect(res.body.data.title).toBe(sampleTx.title)
  })

  it('validates updated fields', async () => {
    const { token } = await registerAndLogin()
    const tx = await createTx(token)
    const res = await api().patch(`${BASE}/${tx.id}`).set(auth(token)).send({ amount: 0 })
    expect(res.status).toBe(422)
  })

  it('rejects unknown fields and empty bodies', async () => {
    const { token } = await registerAndLogin()
    const tx = await createTx(token)
    const unknown = await api().patch(`${BASE}/${tx.id}`).set(auth(token)).send({ hacker: true })
    const empty = await api().patch(`${BASE}/${tx.id}`).set(auth(token)).send({})
    expect(unknown.status).toBe(422)
    expect(empty.status).toBe(422)
  })

  it('cannot update another user\'s transaction', async () => {
    const { token } = await registerAndLogin()
    const other = await registerAndLogin({ email: 'other@example.com' })
    const tx = await createTx(other.token)
    const res = await api().patch(`${BASE}/${tx.id}`).set(auth(token)).send({ amount: 1 })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /transactions/:id', () => {
  it('deletes and returns 204, then 404 on re-fetch', async () => {
    const { token } = await registerAndLogin()
    const tx = await createTx(token)
    const del = await api().delete(`${BASE}/${tx.id}`).set(auth(token))
    expect(del.status).toBe(204)
    const again = await api().get(`${BASE}/${tx.id}`).set(auth(token))
    expect(again.status).toBe(404)
  })

  it('cannot delete another user\'s transaction', async () => {
    const { token } = await registerAndLogin()
    const other = await registerAndLogin({ email: 'other@example.com' })
    const tx = await createTx(other.token)
    const res = await api().delete(`${BASE}/${tx.id}`).set(auth(token))
    expect(res.status).toBe(404)
    const stillThere = await api().get(`${BASE}/${tx.id}`).set(auth(other.token))
    expect(stillThere.status).toBe(200)
  })
})

describe('POST /transactions/bulk', () => {
  it('creates many transactions at once', async () => {
    const { token } = await registerAndLogin()
    const res = await api()
      .post(`${BASE}/bulk`)
      .set(auth(token))
      .send([sampleTx, { ...sampleTx, title: 'Second', amount: 10 }])
    expect(res.status).toBe(201)
    expect(res.body.data.count).toBe(2)
    const list = await api().get(BASE).set(auth(token))
    expect(list.body.meta.total).toBe(2)
  })

  it('rejects an empty array and invalid items', async () => {
    const { token } = await registerAndLogin()
    const empty = await api().post(`${BASE}/bulk`).set(auth(token)).send([])
    const bad = await api().post(`${BASE}/bulk`).set(auth(token)).send([{ ...sampleTx, amount: -1 }])
    expect(empty.status).toBe(422)
    expect(bad.status).toBe(422)
    expect(bad.body.error.details[0].field).toBe('0.amount')
  })
})
