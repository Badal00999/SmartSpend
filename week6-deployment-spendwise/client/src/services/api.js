/**
 * API client (Week 4 revision)
 * ----------------------------
 * A small wrapper around `fetch` for the SpendWise REST API.
 *
 * Week 3 already had: base URL from `VITE_API_URL`, JWT attach, envelope
 * unwrapping and a typed `ApiError`. Week 4 adds the things an integrated
 * full-stack UI needs:
 *   • a request timeout, so a hung back-end cannot freeze the interface
 *   • automatic retry with backoff for idempotent (GET) failures
 *   • an `X-Client-Id` header so the realtime layer can ignore the echo of the
 *     mutation this very tab just performed
 *   • richer error classification (`isNetwork`, `isTimeout`, `isServer`)
 */

/* global AbortSignal */

export const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '')
export const TOKEN_KEY = 'spendwise.auth.v1'
/** Dispatched on `window` when an authenticated request is rejected with 401 (expired token). */
export const UNAUTHORIZED_EVENT = 'spendwise:unauthorized'
/** Milliseconds before a request is aborted (network, not server, failure). */
export const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS) || 12_000

/** Stable id for this browser tab – used to filter out self-triggered realtime events. */
export const CLIENT_ID = (() => {
  const random = () => `c_${Math.random().toString(36).slice(2, 10)}`
  try {
    const stored = window.sessionStorage.getItem('spendwise.clientId')
    if (stored) return stored
    const fresh = random()
    window.sessionStorage.setItem('spendwise.clientId', fresh)
    return fresh
  } catch {
    return random() // private mode / no sessionStorage
  }
})()

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, details?: {field:string,message:string}[], requestId?:string }} [info]
   */
  constructor(message, { status = 0, code = 'HTTP_ERROR', details, requestId } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  /** `{ field: message }` map – handy for showing errors next to form inputs. */
  get fieldErrors() {
    return Object.fromEntries((this.details ?? []).map((d) => [d.field, d.message]))
  }

  /** The server never answered (offline, DNS, connection refused, CORS). */
  get isNetwork() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT'
  }

  get isTimeout() {
    return this.code === 'TIMEOUT'
  }

  get isServer() {
    return this.status >= 500
  }

  /** Worth showing as a full-page "backend unavailable" state. */
  get isOfflineBackend() {
    return this.isNetwork
  }
}

// ---- token persistence ------------------------------------------------------

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* private mode – session-only */
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

// ---- core request -----------------------------------------------------------

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return }
  const cleanup = () => signal?.removeEventListener('abort', onAbort)
  const onAbort = () => { clearTimeout(timer); cleanup(); reject(signal.reason) }
  const timer = setTimeout(() => { cleanup(); resolve() }, ms)
  signal?.addEventListener('abort', onAbort, { once: true })
})

/** Combine the caller's signal with a timeout signal (no AbortSignal.any needed). */
function withTimeout(signal, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), ms)
  const onAbort = () => controller.abort(signal.reason)
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    done() {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    },
  }
}

/**
 * @param {string} path            e.g. '/transactions?limit=5'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body]  JSON-serialised automatically
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.auth=true]   attach the bearer token when available
 * @param {number} [options.retries]      extra attempts for GET/network hiccups
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ success:true, data:any, meta?:any } | null>}  null for 204
 */
export async function request(
  path,
  {
    method = 'GET',
    body,
    signal,
    auth = true,
    retries = method === 'GET' ? 2 : 0,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = {},
) {
  const headers = { Accept: 'application/json', 'X-Client-Id': CLIENT_ID }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  let attempt = 0
  for (;;) {
    if (signal?.aborted) throw signal.reason
    const guard = withTimeout(signal, timeoutMs)
    let res
    let json
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: guard.signal,
      })
      // Headers are not the end of a request: keep the guard until body is read.
      if (res.status !== 204) {
        try { json = await res.json() }
        catch (error) {
          if (guard.signal.aborted) throw guard.signal.reason
          if (error?.name !== 'SyntaxError') throw error
          json = null
        }
      }
    } catch (err) {
      guard.done()
      if (signal?.aborted || err?.name === 'AbortError') throw err

      const timedOut = err?.name === 'TimeoutError'
      if (method === 'GET' && attempt < retries) {
        attempt += 1
        await sleep(250 * 3 ** (attempt - 1), signal) // 250 ms → 750 ms
        continue
      }
      throw new ApiError(
        timedOut
          ? `The SpendWise API did not respond within ${Math.round(timeoutMs / 1000)}s. It may be starting up.`
          : 'Cannot reach the SpendWise API. Is the back-end running?',
        { status: 0, code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR' },
      )
    }
    guard.done()

    if (res.status === 204) return null


    // Retry transient server errors for idempotent requests
    if (res.status >= 500 && method === 'GET' && attempt < retries) {
      attempt += 1
      await sleep(250 * 3 ** (attempt - 1), signal)
      continue
    }

    if (!res.ok || !json || json.success === false) {
      const error = json?.error ?? {}
      if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
      throw new ApiError(error.message || `Request failed with status ${res.status}`, {
        status: res.status,
        code: error.code || 'HTTP_ERROR',
        details: error.details,
        requestId: res.headers?.get?.('x-request-id') ?? json?.meta?.requestId,
      })
    }
    return json
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
