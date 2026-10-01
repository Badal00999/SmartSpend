import { describe, it, expect } from 'vitest'
import { createTransactionSchema, listTransactionsQuerySchema, summaryQuerySchema } from '../src/validators/schemas.js'
import { buildFilter } from '../src/controllers/transactionController.js'
import { api, auth, registerAndLogin, sampleTx } from './helpers.js'

// Risk: JS normalises impossible dates; silent changes corrupt financial history.
describe('W5 calendar boundaries', () => {
  it.each(['2025-02-29', '2024-02-30', '2026-04-31'])('rejects impossible create date %s', (date) => {
    expect(createTransactionSchema.safeParse({ ...sampleTx, date }).success).toBe(false)
  })
  it('accepts a real leap day', () => {
    expect(createTransactionSchema.safeParse({ ...sampleTx, date: '2024-02-29' }).success).toBe(true)
  })
  it.each(['2025-02-29', '2026-13-01', '2026-04-31'])('rejects invalid query calendar %s', (from) => {
    expect(listTransactionsQuerySchema.safeParse({ from }).success).toBe(false)
    expect(summaryQuerySchema.safeParse({ from }).success).toBe(false)
  })
  it('rejects reversed date ranges in both query schemas', () => {
    const query = { from: '2026-03-02', to: '2026-03-01' }
    expect(listTransactionsQuerySchema.safeParse(query).success).toBe(false)
    expect(summaryQuerySchema.safeParse(query).success).toBe(false)
  })
  it('accepts equal endpoints and future query bounds (not future writes)', () => {
    expect(listTransactionsQuerySchema.safeParse({ from: '2099-01-01', to: '2099-01-01' }).success).toBe(true)
  })
  it('rejects reversed amount ranges', () => {
    expect(listTransactionsQuerySchema.safeParse({ minAmount: 100, maxAmount: 10 }).success).toBe(false)
  })
  it('keeps zero as an explicit amount filter', () => {
    expect(buildFilter('owner', { minAmount: 0, maxAmount: 0 })).toEqual({ user: 'owner', amount: { $gte: 0, $lte: 0 } })
  })
  it('escapes search metacharacters rather than executing user regex', () => {
    const filter = buildFilter('owner', { q: '.*' })
    expect(filter.$or[0].title.test('ordinary purchase')).toBe(false)
    expect(filter.$or[0].title.test('literal .* title')).toBe(true)
  })
})

describe('W5 HTTP validation and persistence', () => {
  it('POST rejects impossible date and does not create a normalised March record', async () => {
    const { token } = await registerAndLogin()
    const result = await api().post('/api/v1/transactions').set(auth(token)).send({ ...sampleTx, date: '2025-02-29' })
    expect(result.status).toBe(422)
    expect(result.body.error.details.some(d => d.field === 'date')).toBe(true)
    const list = await api().get('/api/v1/transactions').set(auth(token))
    expect(list.body.meta.total).toBe(0)
  })
  it('PATCH rejects impossible date without modifying original record', async () => {
    const { token } = await registerAndLogin()
    const created = await api().post('/api/v1/transactions').set(auth(token)).send(sampleTx)
    const url = `/api/v1/transactions/${created.body.data.id}`
    expect((await api().patch(url).set(auth(token)).send({ date: '2026-04-31' })).status).toBe(422)
    expect((await api().get(url).set(auth(token))).body.data.date).toBe(sampleTx.date)
  })
  it('bulk validation rejects entire invalid payload without a partial insert', async () => {
    const { token } = await registerAndLogin()
    const result = await api().post('/api/v1/transactions/bulk').set(auth(token)).send([sampleTx, { ...sampleTx, date: '2025-02-29' }])
    expect(result.status).toBe(422)
    expect((await api().get('/api/v1/transactions').set(auth(token))).body.meta.total).toBe(0)
  })
  it.each(['/transactions', '/stats/summary', '/stats/by-category'])('%s returns 422, not 500 or silent coercion, for invalid filter', async (endpoint) => {
    const { token } = await registerAndLogin()
    const result = await api().get(`/api/v1${endpoint}?from=2026-13-01`).set(auth(token))
    expect(result.status).toBe(422)
  })
})
