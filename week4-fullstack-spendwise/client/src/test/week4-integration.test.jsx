/**
 * Week 4 – integration layer tests (client side).
 *
 *  • useDashboardStats / useServerTransactions talk to the Week 3 REST API and
 *    send the right query strings (server-side filtering, sorting, paging).
 *  • The realtime SSE stream updates the store when *another* client changes
 *    data, and ignores the echo of this client's own mutation.
 *  • Mutations are optimistic and roll back when the API rejects them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider } from '../context/AuthContext'
import { TransactionsProvider, useTransactions } from '../context/TransactionsContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useServerTransactions, toApiQuery } from '../hooks/useServerTransactions'
import { setToken, CLIENT_ID } from '../services/api'

const ok = (data, meta) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: () => Promise.resolve({ success: true, data, ...(meta ? { meta } : {}) }),
})

const USER = { id: 'u1', name: 'Badal Kumar', email: 'badal@example.com', currency: 'INR' }

const TX = (over = {}) => ({
  id: '66d5f1a2b3c4d5e6f7a8b9c1',
  title: 'Chai',
  amount: 20,
  type: 'expense',
  category: 'food',
  payment: 'cash',
  date: '2026-09-01',
  notes: '',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

/** Minimal EventSource stand-in that lets a test push server events. */
class MockEventSource {
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 1
    this.listeners = {}
    this.closed = false
    MockEventSource.instances.push(this)
  }
  addEventListener(type, handler) {
    ;(this.listeners[type] ??= []).push(handler)
  }
  close() {
    this.closed = true
    this.readyState = 2
  }
  /** Simulate the server broadcasting an event. */
  emit(type, data) {
    for (const handler of this.listeners[type] ?? []) handler({ data: JSON.stringify(data) })
  }
}

const wrapper = ({ children }) => (
  <AuthProvider>
    <TransactionsProvider initialTransactions={[]}>{children}</TransactionsProvider>
  </AuthProvider>
)

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('EventSource', MockEventSource)
  MockEventSource.instances = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Route the mocked fetch to a small in-memory API. */
function mockApi({
  list = [TX()],
  meta = { page: 1, limit: 8, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
} = {}) {
  fetchMock.mockImplementation((url, init = {}) => {
    const method = init.method ?? 'GET'
    if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
    if (url.includes('/stats/summary'))
      return Promise.resolve(
        ok({
          income: 5000,
          expense: 1200,
          balance: 3800,
          transactionCount: 3,
          thisMonth: { income: 0, expense: 400 },
          currency: 'INR',
        }),
      )
    if (url.includes('/stats/by-category'))
      return Promise.resolve(ok([{ category: 'food', total: 1200, count: 2, percent: 100 }], { totalExpense: 1200 }))
    if (url.includes('/stats/monthly')) return Promise.resolve(ok([{ month: '2026-09', income: 5000, expense: 1200 }]))
    if (url.includes('/transactions?') && method === 'GET') return Promise.resolve(ok(list, meta))
    if (url.endsWith('/transactions') && method === 'POST')
      return Promise.resolve(ok({ ...TX(), id: 'server-id-1', ...JSON.parse(init.body) }))
    return Promise.resolve({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: () => Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'nope' } }),
    })
  })
}

// ---------------------------------------------------------------------------
describe('toApiQuery()', () => {
  it('keeps only meaningful values and always sends paging + sort', () => {
    const query = toApiQuery(
      { query: ' coffee ', type: 'all', category: 'food', sort: '-amount' },
      { page: 2, limit: 8 },
    )
    expect(query).toEqual({ page: 2, limit: 8, category: 'food', q: 'coffee', sort: '-amount' })
  })

  it('maps the UI date range to the API range parameters', () => {
    const query = toApiQuery({ from: '2026-09-01', to: '2026-09-30', sort: '-date' }, { page: 1, limit: 8 })
    expect(query.from).toBe('2026-09-01')
    expect(query.to).toBe('2026-09-30')
  })
})

// ---------------------------------------------------------------------------
describe('useDashboardStats()', () => {
  it('uses the aggregation endpoints once the user is signed in', async () => {
    setToken('jwt')
    mockApi()
    const { result } = renderHook(() => useDashboardStats(), { wrapper })

    await waitFor(() => expect(result.current.isApi).toBe(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isApi).toBe(true)
    expect(result.current.summary.balance).toBe(3800)
    expect(result.current.byCategory[0]).toMatchObject({ category: 'food', percent: 100 })
    expect(result.current.monthly).toHaveLength(1)

    const urls = fetchMock.mock.calls.map(([url]) => url)
    expect(urls.some((u) => u.includes('/stats/summary'))).toBe(true)
    expect(urls.some((u) => u.includes('/stats/by-category'))).toBe(true)
    expect(urls.some((u) => u.includes('/stats/monthly?months=6'))).toBe(true)
  })

  it('computes the same numbers locally for a guest', async () => {
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: ({ children }) => (
        <TransactionsProvider initialTransactions={[TX({ amount: 100 }), TX({ id: 'b', type: 'income', amount: 300 })]}>
          {children}
        </TransactionsProvider>
      ),
    })

    expect(result.current.isApi).toBe(false)
    expect(result.current.summary.balance).toBe(200)
    expect(result.current.summary.transactionCount).toBe(2)
    expect(result.current.byCategory).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('useServerTransactions()', () => {
  it('asks the API for one page with the filters in the query string', async () => {
    setToken('jwt')
    mockApi({ list: [TX()], meta: { page: 2, limit: 8, total: 21, totalPages: 3, hasNext: true, hasPrev: true } })

    const { result } = renderHook(
      () =>
        useServerTransactions({
          filters: { query: 'chai', type: 'expense', category: 'food', sort: 'amount-asc' },
          page: 2,
          limit: 8,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isApi).toBe(true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.meta).toMatchObject({ total: 21, totalPages: 3, hasNext: true })

    const listCall = fetchMock.mock.calls.find(([url]) => url.includes('/transactions?'))
    const parsed = new URL(`http://x${listCall[0]}`)
    expect(parsed.searchParams.get('page')).toBe('2')
    expect(parsed.searchParams.get('limit')).toBe('8')
    expect(parsed.searchParams.get('q')).toBe('chai')
    expect(parsed.searchParams.get('type')).toBe('expense')
    expect(parsed.searchParams.get('category')).toBe('food')
    expect(parsed.searchParams.get('sort')).toBe('amount') // UI label → API field
  })

  it('pages the local list for guests without any network call', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      TX({ id: `t${i}`, date: `2026-09-${String(12 - i).padStart(2, '0')}` }),
    )
    const { result } = renderHook(() => useServerTransactions({ filters: { sort: 'date-desc' }, page: 2, limit: 8 }), {
      wrapper: ({ children }) => <TransactionsProvider initialTransactions={many}>{children}</TransactionsProvider>,
    })

    expect(result.current.isApi).toBe(false)
    expect(result.current.items).toHaveLength(4)
    expect(result.current.meta).toMatchObject({ total: 12, page: 2, hasNext: false, hasPrev: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('realtime sync (SSE)', () => {
  it('applies a transaction created in another tab', async () => {
    setToken('jwt')
    mockApi({ list: [] })
    const { result } = renderHook(() => useTransactions(), { wrapper })

    await waitFor(() => expect(result.current.source).toBe('api'))
    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    expect(MockEventSource.instances[0].url).toContain('/events/stream?token=jwt')

    act(() => MockEventSource.instances[0].emit('stream:ready', {}))

    act(() => {
      MockEventSource.instances[0].emit('transaction:created', {
        transaction: TX({ id: 'remote-1', title: 'From my phone' }),
        origin: { clientId: 'another-tab' },
      })
    })

    expect(result.current.transactions.map((t) => t.title)).toContain('From my phone')
    expect(result.current.liveStatus).toBe('live')
    expect(result.current.version).toBeGreaterThan(0)
  })

  it('ignores the echo of this tab’s own mutation', async () => {
    setToken('jwt')
    mockApi({ list: [] })
    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))

    act(() => {
      MockEventSource.instances[0].emit('transaction:created', {
        transaction: TX({ id: 'echo-1', title: 'My own row' }),
        origin: { clientId: CLIENT_ID },
      })
    })

    expect(result.current.transactions).toHaveLength(0)
  })

  it('handles updates, deletes and a full wipe from another device', async () => {
    setToken('jwt')
    mockApi({ list: [TX({ id: 'a' }), TX({ id: 'b', title: 'Second' })] })
    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(result.current.transactions).toHaveLength(2))

    act(() => {
      MockEventSource.instances[0].emit('transaction:updated', {
        transaction: TX({ id: 'a', amount: 999 }),
        origin: { clientId: 'other' },
      })
    })
    expect(result.current.getById('a').amount).toBe(999)

    act(() => {
      MockEventSource.instances[0].emit('transaction:deleted', { id: 'b', origin: { clientId: 'other' } })
    })
    expect(result.current.transactions.map((t) => t.id)).toEqual(['a'])

    act(() => {
      MockEventSource.instances[0].emit('transaction:cleared', { deletedCount: 1, origin: { clientId: 'other' } })
    })
    expect(result.current.transactions).toHaveLength(0)
  })

  it('falls back to polling when EventSource is unavailable', async () => {
    setToken('jwt')
    mockApi({ list: [] })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('EventSource', undefined)

    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('api'))
    expect(result.current.liveStatus).toBe('polling')

    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
describe('optimistic mutations', () => {
  it('shows the new row immediately and swaps in the server id afterwards', async () => {
    setToken('jwt')
    mockApi({ list: [] })
    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('api'))

    let serverTx
    await act(async () => {
      serverTx = await result.current.addTransaction({
        title: 'Samosa',
        amount: 15,
        type: 'expense',
        category: 'food',
        payment: 'cash',
        date: '2026-09-02',
        notes: '',
      })
    })

    expect(serverTx.id).toBe('server-id-1')
    expect(result.current.transactions.map((t) => t.id)).toEqual(['server-id-1'])
  })

  it('rolls back when the API rejects the create', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url, init = {}) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if ((init.method ?? 'GET') === 'GET')
        return Promise.resolve(ok([], { page: 1, limit: 8, total: 0, totalPages: 1, hasNext: false, hasPrev: false }))
      return Promise.resolve({
        ok: false,
        status: 422,
        headers: { get: () => null },
        json: () =>
          Promise.resolve({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ field: 'title', message: 'required' }],
            },
          }),
      })
    })

    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(result.current.source).toBe('api'))

    await expect(
      result.current.addTransaction({
        title: '',
        amount: 1,
        type: 'expense',
        category: 'food',
        payment: 'cash',
        date: '2026-09-02',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })

    expect(result.current.transactions).toHaveLength(0) // rolled back
  })

  it('removes the row immediately on delete and restores it if the API fails', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url, init = {}) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if ((init.method ?? 'GET') === 'GET')
        return Promise.resolve(
          ok([TX()], { page: 1, limit: 8, total: 1, totalPages: 1, hasNext: false, hasPrev: false }),
        )
      return Promise.resolve({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: () => Promise.resolve({ success: false, error: { code: 'SERVER_ERROR', message: 'boom' } }),
      })
    })

    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(result.current.transactions).toHaveLength(1))

    await expect(result.current.deleteTransaction('66d5f1a2b3c4d5e6f7a8b9c1')).rejects.toThrow()
    expect(result.current.transactions).toHaveLength(1) // restored
  })
})
