/**
 * ConnectionBanner
 * ----------------
 * Graceful degradation for the two ways an integrated app can lose its
 * back-end: the browser itself is offline, or the API process is not running.
 * Instead of a blank screen the user gets one line of plain language plus a
 * retry button – requirement 8 of the Week 4 task.
 */
import { useEffect, useState } from 'react'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { fetchHealth } from '../../services/statsApi'
import { useTransactions } from '../../context/TransactionsContext'
import { useOptionalAuth } from '../../context/AuthContext'

export default function ConnectionBanner({ className = '' }) {
  const online = useOnlineStatus()
  const auth = useOptionalAuth()
  const { source, error, reload, refresh } = useTransactions()
  const [apiReachable, setApiReachable] = useState(true)
  const [checking, setChecking] = useState(false)

  // Poll the health endpoint lightly so the banner disappears on its own
  useEffect(() => {
    let alive = true
    let timer

    const check = async () => {
      try {
        await fetchHealth()
        if (alive) setApiReachable(true)
      } catch {
        if (alive) setApiReachable(false)
      }
      if (alive) timer = setTimeout(check, 15_000)
    }

    if (online && source === 'api') check()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [online, source])

  // The API is considered down when the session could not be restored at
  // start-up, when the health check fails, or when the data request errored.
  const backendDown = Boolean(auth?.backendUnreachable) || (source === 'api' && (!apiReachable || Boolean(error)))
  if (online && !backendDown) return null

  const retry = async () => {
    setChecking(true)
    try {
      await fetchHealth()
      setApiReachable(true)
      // The token was kept, so this signs the user straight back in
      if (auth?.backendUnreachable) auth.recheckSession?.()
      else {
        refresh?.()
        reload?.()
      }
    } catch {
      setApiReachable(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        online
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
          : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
      } ${className}`}
    >
      <span className="flex items-start gap-2 sm:items-center">
        <Icon name={online ? 'plug' : 'wifiOff'} size={16} className="mt-0.5 shrink-0 sm:mt-0" />
        {online ? (
          <span>
            <strong className="font-semibold">Back-end not reachable.</strong>{' '}
            {error || 'The SpendWise API stopped answering.'} Start it with{' '}
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-xs dark:bg-white/10">npm run dev</code> in
            the project root, then retry. Your last data is still on screen.
          </span>
        ) : (
          <span>
            <strong className="font-semibold">You are offline.</strong> Showing the data that was already loaded – new
            changes will be sent when the connection returns.
          </span>
        )}
      </span>
      {online && (
        <Button size="sm" variant="secondary" onClick={retry} loading={checking} disabled={checking} icon="refresh">
          Retry
        </Button>
      )}
    </div>
  )
}
