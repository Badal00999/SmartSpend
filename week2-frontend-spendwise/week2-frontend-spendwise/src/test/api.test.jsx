/**
 * Tests for the Week 3 integration: the API client, AuthContext and the
 * TransactionsProvider running in "api" mode. `fetch` is mocked so the tests
 * describe the contract with the SpendWise REST API without a live server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, renderHook, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError, TOKEN_KEY, request, setToken } from '../services/api'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { TransactionsProvider, useTransactions } from '../context/TransactionsContext'
import { ToastProvider } from '../context/ToastContext'
import AuthPage, { validateAuth } from '../pages/AuthPage'

const ok = (data, meta) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true, data, ...(meta ? { meta } : {}) }),
})
const fail = (status, code, message, details) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ success: false, error: { code, message, details } }),
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
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
describe('api.request()', () => {
  it('unwraps the success envelope and sends the bearer token', async () => {
    setToken('jwt-123')
    fetchMock.mockResolvedValue(ok({ hello: 'world' }))

    const res = await request('/health')
    expect(res.data).toEqual({ hello: 'world' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/health')
    expect(init.headers.Authorization).toBe('Bearer jwt-123')
  })

  it('turns the error envelope into an ApiError with field details', async () => {
    fetchMock.mockResolvedValue(
      fail(422, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'amount', message: 'Amount must be greater than zero' },
      ]),
    )
    const err = await request('/transactions', { method: 'POST', body: {} }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(422)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.fieldErrors).toEqual({ amount: 'Amount must be greater than zero' })
  })

  it('returns null for 204 responses', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) })
    expect(await request('/transactions/1', { method: 'DELETE' })).toBeNull()
  })

  it('reports network failures in plain language', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})

// ---------------------------------------------------------------------------
describe('validateAuth()', () => {
  it('enforces the API password policy on registration', () => {
    expect(validateAuth({ name: 'B', email: 'bad', password: 'short' }, 'register')).toEqual({
      name: expect.stringMatching(/2 characters/),
      email: expect.stringMatching(/valid email/),
      password: expect.stringMatching(/8 characters/),
    })
    expect(validateAuth({ name: 'Badal', email: 'a@b.co', password: 'onlyletters' }, 'register').password).toMatch(
      /letter and one number/,
    )
    expect(validateAuth({ name: 'Badal', email: 'a@b.co', password: 'Passw0rd' }, 'register')).toEqual({})
  })
})

// ---------------------------------------------------------------------------
describe('<AuthProvider />', () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

  it('starts as guest without a token', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.status).toBe('guest')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs in, stores the token and logs out again', async () => {
    fetchMock.mockResolvedValue(ok({ user: USER, token: 'jwt-abc' }))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(() => result.current.login('badal@example.com', 'Passw0rd123'))
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user.name).toBe('Badal Kumar')
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('jwt-abc')

    act(() => result.current.logout())
    expect(result.current.status).toBe('guest')
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('restores the session from a saved token via GET /auth/me', async () => {
    setToken('saved-jwt')
    fetchMock.mockResolvedValue(ok({ user: USER }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/me')
  })

  it('drops an expired token and falls back to guest mode', async () => {
    setToken('expired-jwt')
    fetchMock.mockResolvedValue(fail(401, 'UNAUTHORIZED', 'Token expired'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('guest'))
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('<TransactionsProvider /> in API mode', () => {
  const wrapper = ({ children }) => (
    <AuthProvider>
      <TransactionsProvider initialTransactions={[]}>{children}</TransactionsProvider>
    </AuthProvider>
  )

  it('loads from the API after login and sends mutations to the server', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url, init = {}) => {
      const method = init.method ?? 'GET'
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if (url.includes('/transactions?') && method === 'GET')
        return Promise.resolve(
          ok([TX], { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false }),
        )
      if (url.endsWith('/transactions') && method === 'POST')
        return Promise.resolve(ok({ ...TX, id: 'new-id', ...JSON.parse(init.body) }))
      if (url.endsWith(`/transactions/${TX.id}`) && method === 'PATCH')
        return Promise.resolve(ok({ ...TX, ...JSON.parse(init.body) }))
      if (url.endsWith(`/transactions/${TX.id}`) && method === 'DELETE')
        return Promise.resolve({ ok: true, status: 204, json: () => Promise.reject(new Error()) })
      return Promise.resolve(fail(404, 'NOT_FOUND', `Unhandled ${method} ${url}`))
    })

    const { result } = renderHook(() => useTransactions(), { wrapper })

    await waitFor(() => expect(result.current.source).toBe('api'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0]).toMatchObject({ id: TX.id, title: 'Chai' })
    // API data is never mirrored into the guest localStorage store
    expect(window.localStorage.getItem('spendwise.transactions.v1') ?? '').not.toContain('Chai')

    await act(() =>
      result.current.addTransaction({
        title: 'Samosa',
        amount: '15',
        type: 'expense',
        category: 'food',
        payment: 'cash',
        date: '2026-09-02',
        notes: '',
      }),
    )
    expect(result.current.transactions.map((t) => t.title)).toEqual(['Samosa', 'Chai'])
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(postCall[1].body)).toEqual({
      title: 'Samosa',
      amount: 15,
      type: 'expense',
      category: 'food',
      payment: 'cash',
      date: '2026-09-02',
      notes: '',
    })
    expect(postCall[1].headers.Authorization).toBe('Bearer jwt')

    await act(() => result.current.updateTransaction(TX.id, { ...TX, amount: 25 }))
    expect(result.current.getById(TX.id).amount).toBe(25)

    await act(() => result.current.deleteTransaction(TX.id))
    expect(result.current.transactions.map((t) => t.title)).toEqual(['Samosa'])
  })

  it('surfaces API errors to the caller instead of mutating local state', async () => {
    setToken('jwt')
    fetchMock.mockImplementation((url, init = {}) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(ok({ user: USER }))
      if ((init.method ?? 'GET') === 'GET')
        return Promise.resolve(ok([], { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false }))
      return Promise.resolve(
        fail(422, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'title', message: 'Title is required' }]),
      )
    })
    const { result } = renderHook(() => useTransactions(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

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
    expect(result.current.transactions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
describe('<AuthPage />', () => {
  const renderLogin = () =>
    render(
      <ToastProvider>
        <AuthProvider>
          <TransactionsProvider initialTransactions={[]}>
            <MemoryRouter initialEntries={['/login']}>
              <Routes>
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="/dashboard" element={<h1>Dashboard!</h1>} />
              </Routes>
            </MemoryRouter>
          </TransactionsProvider>
        </AuthProvider>
      </ToastProvider>,
    )

  it('shows the API error message when credentials are wrong', async () => {
    fetchMock.mockResolvedValue(fail(401, 'UNAUTHORIZED', 'Invalid email or password'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'badal@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpass1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('signs in with the demo account and redirects to the dashboard', async () => {
    fetchMock.mockImplementation((url) =>
      url.endsWith('/auth/login')
        ? Promise.resolve(ok({ user: { ...USER, name: 'Demo User' }, token: 'demo-jwt' }))
        : Promise.resolve(ok([], { hasNext: false })),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /try the demo account/i }))

    expect(await screen.findByText('Dashboard!')).toBeInTheDocument()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({ email: 'demo@spendwise.app', password: 'Demo1234' })
  })
})
