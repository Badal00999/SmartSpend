/**
 * TransactionsContext (Week 4 revision)
 * --------------------------------------
 * Global state for transactions using the Context + useReducer pattern
 * (a lightweight alternative to Redux).
 *
 * Data source (decided by AuthContext):
 *   • guest         → localStorage (Week 2 behaviour, works fully offline)
 *   • authenticated → SpendWise REST API (Week 3 back-end)
 *
 * Week 4 additions
 *  1. Realtime sync  – subscribes to the back-end SSE stream. Changes made in
 *     another tab or device are applied to the in-memory store immediately;
 *     the echo of this tab's own mutation is ignored via `X-Client-Id`.
 *  2. Optimistic UI  – mutations are applied instantly and rolled back if the
 *     server rejects them, so the interface never feels like it is waiting.
 *  3. Background refresh – `refresh()` re-reads the source without flashing the
 *     loading skeleton (used after another device imported data, on manual
 *     refresh and by the polling fallback).
 *  4. `version` – a counter that changes whenever data changes; the paged list
 *     and the statistics hooks depend on it, so one change updates everything.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useOptionalAuth } from './AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import { CLIENT_ID } from '../services/api'
import {
  clearLocalTransactions,
  createId,
  generateSeedTransactions,
  loadTransactions,
  peekLocalTransactions,
  saveTransactions,
} from '../services/storage'
import * as remote from '../services/transactionsApi'

const TransactionsContext = createContext(null)

/** Action types – exported for tests and for readability in the reducer. */
export const ACTIONS = {
  ADD: 'transactions/add',
  ADD_MANY: 'transactions/addMany',
  UPDATE: 'transactions/update',
  REPLACE: 'transactions/replace',
  DELETE: 'transactions/delete',
  RESET: 'transactions/reset',
  CLEAR: 'transactions/clear',
  LOAD_SUCCESS: 'transactions/loadSuccess',
  LOAD_ERROR: 'transactions/loadError',
  INVALIDATE: 'transactions/invalidate',
}

/** Pure list reducer – operates on the array of transactions. */
export function transactionsReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD:
      return [action.payload, ...state]
    case ACTIONS.ADD_MANY:
      return [...action.payload, ...state]
    case ACTIONS.UPDATE:
      return state.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload } : t))
    /** Swap an optimistic row for the row the server returned, keeping its position. */
    case ACTIONS.REPLACE:
      return state.map((t) => (t.id === action.payload.tempId ? action.payload.tx : t))
    case ACTIONS.DELETE:
      return state.filter((t) => t.id !== action.payload)
    case ACTIONS.RESET:
      return generateSeedTransactions()
    case ACTIONS.CLEAR:
      return []
    default:
      return state
  }
}

/**
 * Store reducer – wraps the list with bookkeeping about WHERE it came from.
 * `key` is 'local' or 'api:<userId>'; when it differs from the key the current
 * auth state asks for, the provider (re)loads the data.
 */
function storeReducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOAD_SUCCESS:
      return { key: action.key, items: action.payload, error: null }
    case ACTIONS.LOAD_ERROR:
      // Never show one source's data under another source's key
      return { key: action.key, items: [], error: action.error }
    case ACTIONS.INVALIDATE:
      return { ...state, key: null, error: null }
    default: {
      const items = transactionsReducer(state.items, action)
      return items === state.items ? state : { ...state, items }
    }
  }
}

const LOCAL_KEY = 'local'

export function TransactionsProvider({ children, initialTransactions }) {
  const auth = useOptionalAuth()
  const isApi = Boolean(auth?.isAuthenticated)
  // null while a saved token is still being verified – we don't know the source yet
  const wantedKey = auth?.status === 'loading' ? null : isApi ? `api:${auth.user.id}` : LOCAL_KEY

  const [store, dispatch] = useReducer(storeReducer, initialTransactions, (init) => ({
    key: LOCAL_KEY,
    items: init ?? loadTransactions(),
    error: null,
  }))

  const loading = wantedKey === null || (store.key !== wantedKey && !store.error)

  // Bumped on every mutation / remote change so derived data can revalidate.
  const [localVersion, setLocalVersion] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const bump = useCallback(() => setLocalVersion((v) => v + 1), [])

  /** Re-read the data source without showing the skeleton (silent refresh). */
  const refresh = useCallback(
    async ({ silent = true } = {}) => {
      const key = store.key
      if (!key) return null
      try {
        const items = key === LOCAL_KEY ? loadTransactions() : await remote.fetchAllTransactions()
        dispatch({ type: ACTIONS.LOAD_SUCCESS, key, payload: items })
        setLastSyncedAt(Date.now())
        bump()
        return items
      } catch (err) {
        if (!silent) dispatch({ type: ACTIONS.LOAD_ERROR, key, error: err.message })
        return null
      }
    },
    [bump, store.key],
  )

  // ---- Realtime: apply changes made elsewhere -----------------------------
  const handleRemoteEvent = useCallback(
    ({ type, data }) => {
      if (type === 'poll' || type === 'manual:refresh') {
        refresh()
        return
      }
      if (!type.startsWith('transaction:')) return
      // Ignore the echo of the mutation this tab just sent (already applied)
      if (data?.origin?.clientId && data.origin.clientId === CLIENT_ID) return

      switch (type) {
        case 'transaction:created':
          if (data.transaction && !data.transaction.id?.startsWith?.('temp-')) {
            dispatch({ type: ACTIONS.ADD, payload: remote.fromApi(data.transaction) })
          }
          break
        case 'transaction:updated':
          if (data.transaction) dispatch({ type: ACTIONS.UPDATE, payload: remote.fromApi(data.transaction) })
          break
        case 'transaction:deleted':
          if (data.id) dispatch({ type: ACTIONS.DELETE, payload: data.id })
          break
        case 'transaction:cleared':
          dispatch({ type: ACTIONS.CLEAR })
          break
        // A bulk import in another tab: re-read quietly rather than guess the ids
        case 'transaction:imported':
          refresh()
          break
        default:
          break
      }
      setLastSyncedAt(Date.now())
      bump()
    },
    [refresh, bump],
  )

  const realtime = useRealtime({ onMessage: handleRemoteEvent })

  // (Re)load whenever the data source changes: guest ⇄ signed-in user.
  useEffect(() => {
    if (wantedKey === null || store.key === wantedKey) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const items =
          wantedKey === LOCAL_KEY
            ? await Promise.resolve(loadTransactions())
            : await remote.fetchAllTransactions(controller.signal)
        if (!controller.signal.aborted) {
          dispatch({ type: ACTIONS.LOAD_SUCCESS, key: wantedKey, payload: items })
          setLastSyncedAt(Date.now())
        }
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return
        dispatch({
          type: ACTIONS.LOAD_ERROR,
          key: wantedKey,
          error: err.message || 'Could not load transactions',
        })
      }
    }
    load()
    return () => controller.abort()
  }, [wantedKey, store.key])

  // Persist guest data on every change (never mirror server data into localStorage)
  useEffect(() => {
    if (store.key === LOCAL_KEY) saveTransactions(store.items)
  }, [store.key, store.items])

  // Memoised so consumers don't re-render unless something actually changes
  const value = useMemo(() => {
    const { items } = store
    // While switching source (guest ⇄ account) expose an empty list so one
    // user's data is never rendered under another's session.
    const visible = loading ? [] : items

    const local = {
      /** @param {Omit<Transaction,'id'|'createdAt'>} data */
      addTransaction: (data) => {
        const tx = {
          ...data,
          id: createId(),
          amount: Number(data.amount),
          createdAt: Date.now(),
        }
        dispatch({ type: ACTIONS.ADD, payload: tx })
        return tx
      },
      updateTransaction: (id, data) =>
        dispatch({
          type: ACTIONS.UPDATE,
          payload: { ...data, id, amount: Number(data.amount) },
        }),
      deleteTransaction: (id) => dispatch({ type: ACTIONS.DELETE, payload: id }),
      resetToDemo: () => dispatch({ type: ACTIONS.RESET }),
      clearAll: () => dispatch({ type: ACTIONS.CLEAR }),
      importLocal: async () => 0,
    }

    const api = {
      /**
       * Create on the server, showing the row immediately. If the request
       * fails, the optimistic row disappears again and the caller gets the error.
       */
      addTransaction: async (data) => {
        const tempId = `temp-${createId()}`
        const optimistic = {
          ...data,
          id: tempId,
          amount: Number(data.amount),
          createdAt: Date.now(),
          optimistic: true,
        }
        dispatch({ type: ACTIONS.ADD, payload: optimistic })
        try {
          const tx = await remote.createTransaction(data)
          dispatch({ type: ACTIONS.REPLACE, payload: { tempId, tx } })
          setLastSyncedAt(Date.now())
          return tx
        } catch (err) {
          dispatch({ type: ACTIONS.DELETE, payload: tempId }) // rollback
          throw err
        }
      },

      updateTransaction: async (id, data) => {
        const previous = items.find((t) => t.id === id)
        dispatch({ type: ACTIONS.UPDATE, payload: { ...data, id, amount: Number(data.amount), optimistic: true } })
        try {
          const tx = await remote.updateTransaction(id, data)
          dispatch({ type: ACTIONS.UPDATE, payload: tx })
          setLastSyncedAt(Date.now())
          return tx
        } catch (err) {
          if (previous) dispatch({ type: ACTIONS.UPDATE, payload: previous }) // rollback
          throw err
        }
      },

      deleteTransaction: async (id) => {
        const previous = items.find((t) => t.id === id)
        dispatch({ type: ACTIONS.DELETE, payload: id })
        try {
          await remote.deleteTransaction(id)
          setLastSyncedAt(Date.now())
        } catch (err) {
          if (previous) dispatch({ type: ACTIONS.ADD, payload: previous }) // rollback
          throw err
        }
      },

      /** On the server "demo data" is appended (there is no destructive reset). */
      resetToDemo: async () => {
        const created = await remote.bulkCreate(generateSeedTransactions())
        dispatch({ type: ACTIONS.ADD_MANY, payload: created })
        setLastSyncedAt(Date.now())
        return created.length
      },

      /** Settings → danger zone: one request instead of N deletes. */
      clearAll: async () => {
        const { deletedCount } = await remote.deleteAllTransactions()
        dispatch({ type: ACTIONS.CLEAR })
        setLastSyncedAt(Date.now())
        return deletedCount
      },

      /** Move transactions the user created while in guest mode into the account. */
      importLocal: async () => {
        const pending = peekLocalTransactions().filter((t) => !String(t.id).startsWith('seed-'))
        if (pending.length === 0) return 0
        const created = await remote.bulkCreate(pending)
        clearLocalTransactions()
        dispatch({ type: ACTIONS.ADD_MANY, payload: created })
        setLastSyncedAt(Date.now())
        return created.length
      },
    }

    return {
      transactions: visible,
      /** 'local' (guest / offline) or 'api' (signed in) */
      source: isApi ? 'api' : 'local',
      loading,
      error: store.error,
      /** Hard reload – shows the loading state again. */
      reload: () => dispatch({ type: ACTIONS.INVALIDATE }),
      /** Soft reload – keeps the current rows on screen while fetching. */
      refresh,
      getById: (id) => visible.find((t) => t.id === id),
      /** Guest-mode transactions that could be imported into an account. */
      countImportable: () => peekLocalTransactions().filter((t) => !String(t.id).startsWith('seed-')).length,
      /** Realtime connection state: 'live' | 'connecting' | 'polling' | 'offline' | 'disabled' */
      liveStatus: realtime.status,
      lastSyncedAt,
      /** Changes whenever the underlying data changed – used as a cache key. */
      version: localVersion + realtime.version,
      /** Manual "sync now" used by the sync badge. */
      syncNow: realtime.refresh,
      ...(isApi ? api : local),
    }
  }, [store, isApi, loading, refresh, realtime, localVersion, lastSyncedAt])

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>
}

/** Hook for consuming the context – throws if used outside the provider. */
export function useTransactions() {
  const ctx = useContext(TransactionsContext)
  if (!ctx) throw new Error('useTransactions must be used inside <TransactionsProvider>')
  return ctx
}
