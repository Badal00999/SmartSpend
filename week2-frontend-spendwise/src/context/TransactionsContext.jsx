/**
 * TransactionsContext
 * -------------------
 * Global state for transactions using the Context + useReducer pattern
 * (a lightweight alternative to Redux). Any component can read the list or
 * dispatch add / update / delete actions via the `useTransactions()` hook.
 *
 * State changes are persisted to localStorage through the storage service.
 */

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import {
  createId,
  generateSeedTransactions,
  loadTransactions,
  saveTransactions,
} from '../services/storage'

const TransactionsContext = createContext(null)

/** Action types – exported for tests and for readability in the reducer. */
export const ACTIONS = {
  ADD: 'transactions/add',
  UPDATE: 'transactions/update',
  DELETE: 'transactions/delete',
  RESET: 'transactions/reset',
  CLEAR: 'transactions/clear',
}

export function transactionsReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD:
      return [action.payload, ...state]
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

export function TransactionsProvider({ children, initialTransactions }) {
  const [transactions, dispatch] = useReducer(
    transactionsReducer,
    initialTransactions,
    (init) => init ?? loadTransactions(),
  )

  // Persist on every change
  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  // Memoised so consumers don't re-render unless the list actually changes
  const value = useMemo(
    () => ({
      transactions,
      /** @param {Omit<Transaction,'id'|'createdAt'>} data */
      addTransaction: (data) => {
        const tx = { ...data, id: createId(), amount: Number(data.amount), createdAt: Date.now() }
        dispatch({ type: ACTIONS.ADD, payload: tx })
        return tx
      },
      updateTransaction: (id, data) =>
        dispatch({ type: ACTIONS.UPDATE, payload: { ...data, id, amount: Number(data.amount) } }),
      deleteTransaction: (id) => dispatch({ type: ACTIONS.DELETE, payload: id }),
      resetToDemo: () => dispatch({ type: ACTIONS.RESET }),
      clearAll: () => dispatch({ type: ACTIONS.CLEAR }),
      getById: (id) => transactions.find((t) => t.id === id),
    }),
    [transactions],
  )

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>
}

/** Hook for consuming the context – throws if used outside the provider. */
export function useTransactions() {
  const ctx = useContext(TransactionsContext)
  if (!ctx) throw new Error('useTransactions must be used inside <TransactionsProvider>')
  return ctx
}
