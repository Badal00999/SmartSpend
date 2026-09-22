/**
 * SyncBadge
 * ---------
 * Small pill that tells the user how the browser is talking to the back-end.
 * This is the visible half of the realtime integration: it shows whether the
 * SSE stream is open, when the last change arrived, and offers a manual refresh.
 */
import { formatRelativeTime } from '../../utils/format'
import Icon from '../ui/Icon'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

const STATES = {
  live: {
    label: 'Live',
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800',
    icon: 'bolt',
  },
  connecting: {
    label: 'Connecting…',
    tone: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
    icon: 'refresh',
  },
  polling: {
    label: 'Auto-refresh',
    tone: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-800',
    icon: 'refresh',
  },
  offline: {
    label: 'Offline',
    tone: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800',
    icon: 'wifiOff',
  },
  disabled: {
    label: 'Local only',
    tone: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700',
    icon: 'database',
  },
}

export default function SyncBadge({ status = 'disabled', lastSyncedAt, onRefresh, className = '' }) {
  const online = useOnlineStatus()
  const state = STATES[status] ?? STATES.disabled

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        role="status"
        aria-live="polite"
        data-testid="sync-status"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${state.tone}`}
      >
        <Icon name={state.icon} size={13} />
        {state.label}
        {status === 'live' && (
          <span aria-hidden="true" className="relative ml-0.5 flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
          </span>
        )}
      </span>

      {lastSyncedAt && (
        <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
          synced {formatRelativeTime(lastSyncedAt)}
        </span>
      )}

      {onRefresh && status !== 'disabled' && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={!online}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Fetch the latest data from the API"
        >
          <Icon name="refresh" size={13} />
          <span className="hidden sm:inline">Sync now</span>
        </button>
      )}
    </div>
  )
}
