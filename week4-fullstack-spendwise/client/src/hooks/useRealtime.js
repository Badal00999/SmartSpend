/**
 * useRealtime – keeps this tab in sync with the back-end.
 *
 * Returns a small status object the UI can show:
 *   'disabled'   guest mode (no token) – there is nothing to sync with
 *   'offline'    the browser itself has no connection
 *   'connecting' the EventSource is opening / reconnecting
 *   'live'       stream open, events arrive as they happen
 *   'polling'    SSE unavailable → fell back to a 15 s refresh timer
 *
 * `version` increases whenever a remote change arrives, so data hooks can use
 * it as a cheap cache-busting dependency.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToChanges } from '../services/eventsApi'
import { useOnlineStatus } from './useOnlineStatus'
import { useOptionalAuth } from '../context/AuthContext'

const FALLBACK_POLL_MS = 15_000

export function useRealtime({ onMessage } = {}) {
  const auth = useOptionalAuth()
  const isAuthenticated = Boolean(auth?.isAuthenticated)
  const online = useOnlineStatus()

  // 'connecting' until the stream reports itself open; the final value shown to
  // the UI is derived below so nothing has to be set from inside the effect.
  const [streamStatus, setStreamStatus] = useState('connecting')
  const [lastEventAt, setLastEventAt] = useState(null)
  const [version, setVersion] = useState(0)
  const [manualTick, setManualTick] = useState(0)

  // Keep the latest callback in a ref so the effect never needs to re-subscribe
  const handler = useRef(onMessage)
  useEffect(() => {
    handler.current = onMessage
  }, [onMessage])

  const handleEvent = useCallback((event) => {
    if (!event) return
    setLastEventAt(Date.now())
    setVersion((v) => v + 1)
    handler.current?.(event)
  }, [])

  /** Force a refresh (used by the "Refresh" button in the sync badge). */
  const refresh = useCallback(() => {
    setManualTick((t) => t + 1)
    handleEvent({ type: 'manual:refresh', data: {} })
  }, [handleEvent])

  useEffect(() => {
    if (!isAuthenticated || !online) return undefined

    let pollTimer
    const stop = subscribeToChanges({
      onEvent: handleEvent,
      onStatus: (s) => {
        if (s === 'live') setStreamStatus('live')
        else if (s === 'connecting') setStreamStatus('connecting')
        else if (s === 'error') setStreamStatus('polling')
        else if (s === 'closed') setStreamStatus('connecting')
      },
      onFallback: () => {
        // No EventSource (or blocked by a proxy) – refresh periodically instead
        setStreamStatus('polling')
        pollTimer = setInterval(() => handleEvent({ type: 'poll', data: {} }), FALLBACK_POLL_MS)
      },
    })

    return () => {
      stop()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [isAuthenticated, online, handleEvent])

  const effectiveStatus = !isAuthenticated ? 'disabled' : !online ? 'offline' : streamStatus

  // A stable object identity keeps consumer `useMemo`s from re-running
  return useMemo(
    () => ({
      status: effectiveStatus,
      lastEventAt,
      /** bumps on every remote event */
      version,
      /** bumps on refresh() */
      manualTick,
      refresh,
      isLive: effectiveStatus === 'live',
    }),
    [effectiveStatus, lastEventAt, version, manualTick, refresh],
  )
}

export default useRealtime
