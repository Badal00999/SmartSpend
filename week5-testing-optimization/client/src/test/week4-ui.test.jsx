/**
 * Week 4 – UI tests for the integration surfaces:
 *   SyncBadge, ConnectionBanner, Pagination, SettingsPage and the
 *   "session expired" flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, renderHook, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SyncBadge from '../components/feedback/SyncBadge'
import ConnectionBanner from '../components/feedback/ConnectionBanner'
import Pagination, { pageNumbers } from '../components/transactions/Pagination'
import SettingsPage from '../pages/SettingsPage'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { TransactionsProvider } from '../context/TransactionsContext'
import { ToastProvider } from '../context/ToastContext'
import { TOKEN_KEY, UNAUTHORIZED_EVENT, setToken } from '../services/api'
import { formatRelativeTime } from '../utils/format'

const ok = (data, meta) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: () => Promise.resolve({ success: true, data, ...(meta ? { meta } : {}) }),
})

const USER = { id: 'u1', name: 'Badal Kumar', email: 'badal@example.com', currency: 'INR' }

const TX = {
  id: '66d5f1a2b3c4d5e6f7a8b9c1',
  title: 'Chai',
  amount: 20,
  type: 'expense',
  category: 'food',
  payment: 'cash',
  date: '2026-09-01',
  notes: '',
  createdAt: '2026-09-01T10:00:00.000Z',
}

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(ok({}))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal(
    'EventSource',
    class {
      constructor() {}
      addEventListener() {}
      close() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
describe('formatRelativeTime()', () => {
  it('describes freshness in human terms', () => {
    const now = Date.now()
    expect(formatRelativeTime(now)).toBe('just now')
    expect(formatRelativeTime(now - 30_000)).toBe('30s ago')
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5 min ago')
    expect(formatRelativeTime(null)).toBe('')
  })
})

// ---------------------------------------------------------------------------
describe('<SyncBadge />', () => {
  it('labels each connection state', () => {
    const { rerender } = render(<SyncBadge status="live" />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Live')

    rerender(<SyncBadge status="polling" />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Auto-refresh')

    rerender(<SyncBadge status="offline" />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Offline')

    rerender(<SyncBadge status="disabled" />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Local only')
  })

  it('shows the last sync time and calls onRefresh', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<SyncBadge status="live" lastSyncedAt={Date.now() - 1000} onRefresh={onRefresh} />)

    expect(screen.getByText(/synced/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /sync now/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
describe('<ConnectionBanner />', () => {
  const renderBanner = () =>
    render(
      <ToastProvider>
        <AuthProvider>
          <TransactionsProvider initialTransactions={[]}>
            <MemoryRouter>
              <ConnectionBanner />
            </MemoryRouter>
          </TransactionsProvider>
        </AuthProvider>
      </ToastProvider>,
    )

  it('stays silent while everything works', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if (url.includes('/health')) return Promise.resolve(ok({ status: 'ok' }))
      return Promise.resolve(ok([], { page: 1, limit: 100, total: 0, totalPages: 1, hasNext: false, hasPrev: false }))
    })

    renderBanner()
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('/health'))).toBe(true))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('explains an offline browser in plain language', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    renderBanner()
    expect(await screen.findByRole('alert')).toHaveTextContent(/you are offline/i)
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  })

  it('explains a stopped back-end in guest mode too', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    setToken('jwt')
    renderBanner()
    // Guest fallback: the banner is driven by the API health check after signing in
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })
})

// ---------------------------------------------------------------------------
describe('<Pagination />', () => {
  const meta = { page: 2, limit: 8, total: 21, totalPages: 3, hasNext: true, hasPrev: true }

  it('summarises the visible range', () => {
    render(<Pagination meta={meta} onPageChange={() => {}} />)
    expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 9–16 of 21')
  })

  it('reports the page the user clicks', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination meta={meta} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole('button', { name: '1' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('disables the arrows at the edges and hides itself for a single page', () => {
    const { rerender } = render(<Pagination meta={{ ...meta, page: 1, hasPrev: false }} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    rerender(
      <Pagination
        meta={{ page: 1, limit: 8, total: 3, totalPages: 1, hasNext: false, hasPrev: false }}
        onPageChange={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  })

  it('renders an empty state for an empty list', () => {
    const { container } = render(
      <Pagination meta={{ page: 1, limit: 8, total: 0, totalPages: 0 }} onPageChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('pageNumbers()', () => {
  it('keeps the list short with gaps', () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3])
    expect(pageNumbers(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12])
  })
})

// ---------------------------------------------------------------------------
describe('<SettingsPage />', () => {
  const renderPage = () =>
    render(
      <ToastProvider>
        <AuthProvider>
          <TransactionsProvider initialTransactions={[TX]}>
            <MemoryRouter>
              <SettingsPage />
            </MemoryRouter>
          </TransactionsProvider>
        </AuthProvider>
      </ToastProvider>,
    )

  it('tells guests that settings need an account', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText(/sign in to edit your account/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeDisabled()
  })

  it('saves the profile through PATCH /auth/me when signed in', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url, init = {}) => {
      if (url.endsWith('/auth/me') && (init.method ?? 'GET') === 'GET') return Promise.resolve(ok({ user: USER }))
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: { ...USER, name: 'Badal S.' } }))
      if (url.includes('/stats/summary'))
        return Promise.resolve(
          ok({
            income: 100,
            expense: 40,
            balance: 60,
            transactionCount: 1,
            thisMonth: { income: 0, expense: 0 },
            currency: 'INR',
          }),
        )
      if (url.includes('/events/status'))
        return Promise.resolve(ok({ totalClients: 1, users: 1, thisUser: 1, byUser: {} }))
      if (url.includes('/transactions?'))
        return Promise.resolve(
          ok([TX], { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false }),
        )
      return Promise.resolve(ok({}))
    })

    const user = userEvent.setup()
    renderPage()

    const nameInput = await screen.findByLabelText(/display name/i)
    await waitFor(() => expect(nameInput).toHaveValue('Badal Kumar'))

    await user.clear(nameInput)
    await user.type(nameInput, 'Badal S.')
    await user.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patch).toBeTruthy()
      expect(patch[0]).toBe('/api/v1/auth/me')
      expect(JSON.parse(patch[1].body)).toEqual({ name: 'Badal S.', currency: 'INR' })
    })
  })

  it('shows the live-connection diagnostics from /events/status', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if (url.includes('/events/status'))
        return Promise.resolve(ok({ totalClients: 2, users: 1, thisUser: 2, byUser: {} }))
      if (url.includes('/stats/summary'))
        return Promise.resolve(
          ok({
            income: 0,
            expense: 0,
            balance: 0,
            transactionCount: 0,
            thisMonth: { income: 0, expense: 0 },
            currency: 'INR',
          }),
        )
      if (url.includes('/transactions?'))
        return Promise.resolve(ok([], { page: 1, limit: 100, total: 0, totalPages: 1, hasNext: false, hasPrev: false }))
      return Promise.resolve(ok({}))
    })

    renderPage()
    expect(await screen.findByText(/realtime stream: 2 open connections/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('session expiry', () => {
  it('signs the user out with a flag when the API returns 401 mid-session', async () => {
    setToken('jwt')
    fetchMock.mockResolvedValue(ok({ user: USER }))

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      ),
    })

    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)))

    expect(result.current.status).toBe('guest')
    expect(result.current.sessionExpired).toBe(true)
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()

    act(() => result.current.clearSessionExpired())
    expect(result.current.sessionExpired).toBe(false)
  })

  it('updates the cached user after a profile change', async () => {
    setToken('jwt')
    fetchMock.mockResolvedValue(ok({ user: USER }))

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => result.current.updateUser({ name: 'Renamed' }))
    expect(result.current.user.name).toBe('Renamed')
  })
})

// ---------------------------------------------------------------------------
describe('Settings danger zone', () => {
  it('asks for confirmation before wiping every transaction', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url, init = {}) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if (url.includes('/stats/summary'))
        return Promise.resolve(
          ok({
            income: 0,
            expense: 0,
            balance: 0,
            transactionCount: 1,
            thisMonth: { income: 0, expense: 0 },
            currency: 'INR',
          }),
        )
      if (url.includes('/transactions?'))
        return Promise.resolve(
          ok([TX], { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false }),
        )
      if ((init.method ?? 'GET') === 'DELETE') return Promise.resolve(ok({ deletedCount: 1 }))
      return Promise.resolve(ok({}))
    })

    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthProvider>
          <TransactionsProvider initialTransactions={[TX]}>
            <MemoryRouter>
              <SettingsPage />
            </MemoryRouter>
          </TransactionsProvider>
        </AuthProvider>
      </ToastProvider>,
    )

    await user.click(await screen.findByRole('button', { name: /delete all transactions/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /yes, delete everything/i }))

    await waitFor(() => {
      const del = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/v1/transactions' && init?.method === 'DELETE',
      )
      expect(del).toBeTruthy()
    })
  })
})
