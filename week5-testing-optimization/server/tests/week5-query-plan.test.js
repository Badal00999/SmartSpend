import { describe, it, expect } from 'vitest'
import { Transaction } from '../src/models/Transaction.js'
import { api, auth, registerAndLogin, sampleTx } from './helpers.js'

// Structural guard, not a flaky wall-clock speed threshold.
describe('W5 optimized default-list contract', () => {
  it('declares an index covering owner + date + deterministic ID tie-breaker', () => {
    expect(Transaction.schema.indexes().map(([key]) => key)).toContainEqual({ user: 1, date: -1, _id: -1 })
  })
  it('uses no blocking SORT and preserves disjoint equal-date pages + API serialization', async () => {
    await Transaction.init()
    const { user, token } = await registerAndLogin()
    await Transaction.insertMany(Array.from({ length: 60 }, (_, i) => ({
      ...sampleTx, title: `Same date ${i}`, user: user.id, date: new Date('2024-02-29T00:00:00Z'),
    })))
    const explain = await Transaction.find({ user: user.id }).sort({ date: -1, _id: -1 }).limit(20).explain('executionStats')
    expect(JSON.stringify(explain.queryPlanner.winningPlan)).not.toContain('"stage":"SORT"')
    expect(explain.executionStats.totalDocsExamined).toBe(20)
    const first = await api().get('/api/v1/transactions?limit=20&page=1').set(auth(token))
    const second = await api().get('/api/v1/transactions?limit=20&page=2').set(auth(token))
    expect(first.status).toBe(200)
    expect(first.body.data[0]).toMatchObject({ date: '2024-02-29', user: user.id })
    expect(first.body.data[0]._id).toBeUndefined()
    const ids = [...first.body.data, ...second.body.data].map(t => t.id)
    expect(new Set(ids).size).toBe(40)
    expect(ids).toEqual([...ids].sort().reverse())
  })
})
