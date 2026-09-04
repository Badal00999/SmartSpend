/**
 * Unit tests for the pure statistics helpers.
 */
import { describe, it, expect } from 'vitest'
import { computeTotals, expenseByCategory, filterTransactions, percentOf } from '../utils/stats'

const sample = [
  { id: '1', title: 'Salary', amount: 50000, type: 'income', category: 'salary', date: '2026-09-01', createdAt: 3 },
  { id: '2', title: 'Groceries', amount: 2000, type: 'expense', category: 'food', date: '2026-09-02', createdAt: 2 },
  { id: '3', title: 'Uber', amount: 300, type: 'expense', category: 'transport', date: '2026-08-20', createdAt: 1 },
  { id: '4', title: 'Pizza night', amount: 700, type: 'expense', category: 'food', date: '2026-08-15', notes: 'friends', createdAt: 0 },
]

describe('computeTotals', () => {
  it('sums income, expenses and balance', () => {
    expect(computeTotals(sample)).toEqual({ income: 50000, expense: 3000, balance: 47000 })
  })

  it('handles an empty list', () => {
    expect(computeTotals([])).toEqual({ income: 0, expense: 0, balance: 0 })
  })
})

describe('expenseByCategory', () => {
  it('groups expenses and sorts by total descending', () => {
    expect(expenseByCategory(sample)).toEqual([
      { category: 'food', total: 2700 },
      { category: 'transport', total: 300 },
    ])
  })
})

describe('filterTransactions', () => {
  it('filters by type', () => {
    const result = filterTransactions(sample, { type: 'income' })
    expect(result.map((t) => t.id)).toEqual(['1'])
  })

  it('filters by category', () => {
    expect(filterTransactions(sample, { category: 'food' })).toHaveLength(2)
  })

  it('searches title and notes case-insensitively', () => {
    expect(filterTransactions(sample, { query: 'FRIENDS' }).map((t) => t.id)).toEqual(['4'])
  })

  it('sorts by amount ascending', () => {
    expect(filterTransactions(sample, { sort: 'amount-asc' }).map((t) => t.amount)).toEqual([300, 700, 2000, 50000])
  })

  it('defaults to newest first', () => {
    expect(filterTransactions(sample, {}).map((t) => t.id)).toEqual(['2', '1', '3', '4'])
  })
})

describe('percentOf', () => {
  it('returns a rounded percentage', () => {
    expect(percentOf(1, 3)).toBe(33.3)
  })
  it('returns 0 when the total is 0', () => {
    expect(percentOf(5, 0)).toBe(0)
  })
})
