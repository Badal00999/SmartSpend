import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request, setToken, clearToken, UNAUTHORIZED_EVENT } from '../services/api'

const response = (status, data = { success: true, data: [] }) => ({
  status, ok: status >= 200 && status < 300, headers: { get: () => null }, json: async () => data,
})
beforeEach(() => { vi.useFakeTimers(); clearToken() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); clearToken() })

describe('W5 API transport boundaries', () => {
  it('keeps timeout active while response body is stalled after headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => ({
      ...response(200),
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }),
    })))
    let outcome = 'pending'
    const pending = request('/health', { timeoutMs: 50, retries: 0 }).then(() => { outcome = 'resolved' }, error => { outcome = error.code })
    await vi.advanceTimersByTimeAsync(60)
    expect(outcome).toBe('TIMEOUT')
    await pending
  })
  it('does not fetch again if caller cancels during retry backoff', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network failure'))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const pending = request('/health', { signal: controller.signal }).catch(error => error)
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((await pending).name).toBe('AbortError')
  })
  it('never retries a default POST after network failure', async () => {
    const mock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', mock)
    await expect(request('/transactions', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('bounds GET retries at three total attempts', async () => {
    const mock = vi.fn().mockResolvedValue(response(503, { success: false }))
    vi.stubGlobal('fetch', mock)
    const result = request('/health').catch(error => error)
    await vi.advanceTimersByTimeAsync(1100)
    expect((await result).status).toBe(503)
    expect(mock).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('returns null for 204 without attempting JSON parsing', async () => {
    const res = response(204); res.json = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
    expect(await request('/transactions/id', { method: 'DELETE' })).toBeNull()
    expect(res.json).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects malformed successful response and cleans up timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ...response(200), json: async () => { throw new SyntaxError('bad JSON') } }))
    await expect(request('/health')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('dispatches session expiry only for authenticated 401', async () => {
    const listener = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, listener)
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { success: false })))
      await request('/auth/login', { auth: false }).catch(() => {})
      expect(listener).not.toHaveBeenCalled()
      setToken('test-token')
      await request('/auth/me').catch(() => {})
      expect(listener).toHaveBeenCalledTimes(1)
    } finally { window.removeEventListener(UNAUTHORIZED_EVENT, listener) }
  })
})
