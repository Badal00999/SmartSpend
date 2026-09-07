/**
 * API client
 * ----------
 * A small wrapper around `fetch` for the SpendWise REST API (Week 3 back-end).
 *
 *  - Base URL comes from `VITE_API_URL` (default `/api/v1`, which the Vite dev
 *    server proxies to http://localhost:4000 – see vite.config.js).
 *  - Attaches the JWT as `Authorization: Bearer …` when the user is signed in.
 *  - Unwraps the API's `{ success, data, meta }` envelope and converts the
 *    `{ success:false, error }` envelope into a typed `ApiError`.
 */

export const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '')
export const TOKEN_KEY = 'spendwise.auth.v1'
/** Dispatched on `window` when an authenticated request is rejected with 401 (expired token). */
export const UNAUTHORIZED_EVENT = 'spendwise:unauthorized'

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, details?: {field:string,message:string}[] }} [info]
   */
  constructor(message, { status = 0, code = 'HTTP_ERROR', details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** `{ field: message }` map – handy for showing errors next to form inputs. */
  get fieldErrors() {
    return Object.fromEntries((this.details ?? []).map((d) => [d.field, d.message]))
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

/**
 * @param {string} path            e.g. '/transactions?limit=5'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body]  JSON-serialised automatically
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.auth=true]  attach the bearer token when available
 * @returns {Promise<{ success:true, data:any, meta?:any } | null>}  null for 204
 */
export async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('Cannot reach the SpendWise API. Is the back-end running?', {
      status: 0,
      code: 'NETWORK_ERROR',
    })
  }

  if (res.status === 204) return null

  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.success === false) {
    const error = json?.error ?? {}
    if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(error.message || `Request failed with status ${res.status}`, {
      status: res.status,
      code: error.code || 'HTTP_ERROR',
      details: error.details,
    })
  }
  return json
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
