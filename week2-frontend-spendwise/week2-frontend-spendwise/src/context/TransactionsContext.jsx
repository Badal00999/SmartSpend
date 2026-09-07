/**
 * TransactionsContext
 * -------------------
 * Global state for transactions using the Context + useReducer pattern
 * (a lightweight alternative to Redux). Any component can read the list or
 * dispatch add / update / delete actions via the `useTransactions()` hook.
 *
 * Data source (decided by AuthContext):
 *   • guest         → localStorage (Week 2 behaviour, works fully offline)
 *   • authenticated → SpendWise REST API (Week 3 back-end); every mutation is
 *                     sent to the server first and the local list is updated
 *                     from the server's response.
 */

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { useOptionalAuth } from './AuthContext'
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
  UPDATE: 'transactions/update',
  DELETE: 'transactions/delete',
  RESET: 'transactions/reset',
  CLEAR: 'transactions/clear',
  ADD_MANY: 'transactions/addMany',
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
        if (!controller.signal.aborted)
          dispatch({
            type: ACTIONS.LOAD_SUCCESS,
            key: wantedKey,
            payload: items,
          })
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
      addTransaction: async (data) => {
        const tx = await remote.createTransaction(data)
        dispatch({ type: ACTIONS.ADD, payload: tx })
        return tx
      },
      updateTransaction: async (id, data) => {
        const tx = await remote.updateTransaction(id, data)
        dispatch({ type: ACTIONS.UPDATE, payload: tx })
        return tx
      },
      deleteTransaction: async (id) => {
        await remote.deleteTransaction(id)
        dispatch({ type: ACTIONS.DELETE, payload: id })
      },
      /** On the server "demo data" is appended (there is no destructive reset). */
      resetToDemo: async () => {
        const created = await remote.bulkCreate(generateSeedTransactions())
        dispatch({ type: ACTIONS.ADD_MANY, payload: created })
        return created.length
      },
      clearAll: async () => {
        await Promise.all(items.map((t) => remote.deleteTransaction(t.id)))
        dispatch({ type: ACTIONS.CLEAR })
      },
      /** Move transactions the user created while in guest mode into the account. */
      importLocal: async () => {
        const pending = peekLocalTransactions().filter((t) => !String(t.id).startsWith('seed-'))
        if (pending.length === 0) return 0
        const created = await remote.bulkCreate(pending)
        clearLocalTransactions()
        dispatch({ type: ACTIONS.ADD_MANY, payload: created })
        return created.length
      },
    }

    return {
      transactions: visible,
      /** 'local' (guest / offline) or 'api' (signed in) */
      source: isApi ? 'api' : 'local',
      loading,
      error: store.error,
      reload: () => dispatch({ type: ACTIONS.INVALIDATE }),
      getById: (id) => visible.find((t) => t.id === id),
      /** Guest-mode transactions that could be imported into an account. */
      countImportable: () => peekLocalTransactions().filter((t) => !String(t.id).startsWith('seed-')).length,
      ...(isApi ? api : local),
    }
  }, [store, isApi, loading])

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>
}

/** Hook for consuming the context – throws if used outside the provider. */
export function useTransactions() {
  const ctx = useContext(TransactionsContext)
  if (!ctx) throw new Error('useTransactions must be used inside <TransactionsProvider>')
  return ctx
}
