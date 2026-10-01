/**
 * Realtime service (Server-Sent Events)
 * -------------------------------------
 * Opens one `EventSource` to `GET /api/v1/events/stream` and forwards every
 * change the back-end broadcasts for the signed-in user (made in this tab,
 * another tab, or another device) to the UI.
 *
 * Why SSE and not WebSockets here? The traffic is one-directional
 * (server → client notifications), SSE reconnects automatically with
 * `Last-Event-ID`, needs no extra dependency and works through the same HTTP
 * port/proxy as the REST API.
 *
 * The browser's EventSource API cannot set an Authorization header, so the JWT
 * travels as a query parameter – the back-end accepts either (see requireAuthSse).
 */

import { API_URL, TOKEN_KEY, getToken } from './api'

/** Event names published by the back-end (keep in sync with the event bus). */
export const REALTIME_EVENTS = [
  'transaction:created',
  'transaction:updated',
  'transaction:deleted',
  'transaction:imported',
  'transaction:cleared',
]

/**
 * Subscribe to the current user's change stream.
 *
 * @param {object} options
 * @param {(event:{type:string,data:any}) => void} options.onEvent
 * @param {(status:'connecting'|'live'|'error'|'closed') => void} [options.onStatus]
 * @param {() => void} [options.onFallback]  called when SSE is unavailable (old browser, blocked)
 * @returns {() => void} unsubscribe
 */
export function subscribeToChanges({ onEvent, onStatus, onFallback } = {}) {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    onFallback?.()
    onStatus?.('error')
    return () => {}
  }

  const token = getToken()
  if (!token) {
    onStatus?.('closed')
    return () => {}
  }

  const url = `${API_URL}/events/stream?token=${encodeURIComponent(token)}`
  onStatus?.('connecting')

  let source
  let cancelled = false
  try {
    source = new EventSource(url)
  } catch {
    onFallback?.()
    onStatus?.('error')
    return () => {}
  }

  const handle = (type) => (message) => {
    let data = {}
    try {
      data = message.data ? JSON.parse(message.data) : {}
    } catch {
      data = {}
    }
    onEvent?.({ type, data })
  }

  source.addEventListener('stream:ready', () => onStatus?.('live'))
  source.onopen = () => onStatus?.('live')
  for (const type of REALTIME_EVENTS) source.addEventListener(type, handle(type))

  source.onerror = () => {
    if (cancelled) return
    // EventSource reconnects on its own; surface it so the UI can show a hint
    onStatus?.(source.readyState === 2 ? 'error' : 'connecting')
  }

  return () => {
    cancelled = true
    source.close()
    onStatus?.('closed')
  }
}

/** Exported for tests – lets a mocked storage decide whether a token exists. */
export const tokenKey = TOKEN_KEY
