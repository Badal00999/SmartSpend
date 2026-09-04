/**
 * Tests for the reducer and the context provider (add / update / delete flow).
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { TransactionsProvider, useTransactions, transactionsReducer, ACTIONS } from '../context/TransactionsContext'
import { STORAGE_KEY } from '../services/storage'

describe('transactionsReducer', () => {
  const state = [{ id: 'a', title: 'A', amount: 1 }]

  it('adds to the front of the list', () => {
    const next = transactionsReducer(state, { type: ACTIONS.ADD, payload: { id: 'b', title: 'B', amount: 2 } })
    expect(next.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('updates by id without mutating', () => {
    const next = transactionsReducer(state, { type: ACTIONS.UPDATE, payload: { id: 'a', amount: 99 } })
    expect(next[0].amount).toBe(99)
    expect(state[0].amount).toBe(1)
  })

  it('deletes by id', () => {
    expect(transactionsReducer(state, { type: ACTIONS.DELETE, payload: 'a' })).toEqual([])
  })

  it('ignores unknown actions', () => {
    expect(transactionsReducer(state, { type: 'nope' })).toBe(state)
  })
})

describe('<TransactionsProvider />', () => {
  const wrapper = ({ children }) => <TransactionsProvider initialTransactions={[]}>{children}</TransactionsProvider>

  it('adds, updates and deletes a transaction and persists to localStorage', () => {
    const { result } = renderHook(() => useTransactions(), { wrapper })

    let created
    act(() => {
      created = result.current.addTransaction({ title: 'Tea', amount: '20', type: 'expense', category: 'food', payment: 'cash', date: '2026-09-01' })
    })
    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].amount).toBe(20) // coerced to number
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toHaveLength(1)

    act(() => result.current.updateTransaction(created.id, { ...created, title: 'Chai' }))
    expect(result.current.getById(created.id).title).toBe('Chai')

    act(() => result.current.deleteTransaction(created.id))
    expect(result.current.transactions).toHaveLength(0)
  })

  it('throws a helpful error when used outside the provider', () => {
    expect(() => renderHook(() => useTransactions())).toThrow(/inside <TransactionsProvider>/)
  })
})
