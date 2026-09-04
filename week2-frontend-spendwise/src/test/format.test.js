/**
 * Unit tests for formatting helpers.
 */
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatMonth, todayISO } from '../utils/format'

describe('formatCurrency', () => {
  it('formats INR with Indian digit grouping', () => {
    // Normalise the non-breaking space some ICU builds insert after the symbol
    expect(formatCurrency(1234567.5).replace(/\u00a0/g, '')).toBe('₹12,34,567.50')
  })

  it('formats other currencies', () => {
    expect(formatCurrency(10, 'USD').replace(/\u00a0/g, '')).toBe('$10.00')
  })

  it('treats invalid input as zero', () => {
    expect(formatCurrency('abc').replace(/\u00a0/g, '')).toBe('₹0.00')
  })
})

describe('formatDate', () => {
  it('formats an ISO date in short style', () => {
    expect(formatDate('2026-09-04')).toMatch(/4 Sept? 2026/)
  })

  it('returns an empty string for empty input', () => {
    expect(formatDate('')).toBe('')
  })
})

describe('formatMonth', () => {
  it('turns YYYY-MM into "Mon YYYY"', () => {
    expect(formatMonth('2026-01')).toMatch(/Jan 2026/)
  })
})

describe('todayISO', () => {
  it('returns YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
