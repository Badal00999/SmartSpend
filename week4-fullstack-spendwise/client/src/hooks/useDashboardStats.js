/**
 * useDashboardStats
 * -----------------
 * One hook that feeds the four stat cards and both charts.
 *
 *   signed in → GET /stats/summary, /stats/by-category, /stats/monthly
 *               (MongoDB aggregation over every transaction of the account)
 *   guest     → the same numbers computed locally from localStorage
 *
 * Both paths return the identical shape, so the dashboard markup never has to
 * know which one is active – that is the "seamless data flow across layers"
 * the Week 4 brief asks for.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTransactions } from '../context/TransactionsContext'
import { fetchByCategory, fetchMonthly, fetchSummary } from '../services/statsApi'
import { computeTotals, expenseByCategory, monthlyTrend } from '../utils/stats'

const MONTHS = 6

export function useDashboardStats({ months = MONTHS } = {}) {
  const { source, transactions, version } = useTransactions()
  const isApi = source === 'api'
  // A "request key" identifies which question we are asking the server. While
  // the answer for the current key is missing we are loading – derived during
  // render, so no state has to be set synchronously inside the effect.
  const requestKey = `${version}|${months}`
  const [state, setState] = useState({ key: null, error: null, summary: null, byCategory: [], monthly: [] })

  useEffect(() => {
    if (!isApi) return undefined
    let alive = true
    const controller = new AbortController()

    Promise.all([
      fetchSummary({ signal: controller.signal }),
      fetchByCategory({ signal: controller.signal }),
      fetchMonthly({ months, signal: controller.signal }),
    ])
      .then(([summary, category, monthly]) => {
        if (!alive) return
        setState({ key: requestKey, error: null, summary, byCategory: category.items, monthly })
      })
      .catch((err) => {
        if (!alive || controller.signal.aborted) return
        setState({ key: requestKey, error: err.message, summary: null, byCategory: [], monthly: [] })
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [isApi, months, version, requestKey])

  const local = useMemo(() => {
    if (isApi) return null
    const totals = computeTotals(transactions)
    const monthKey = new Date().toISOString().slice(0, 7)
    const thisMonth = computeTotals(transactions.filter((t) => t.date?.startsWith(monthKey)))
    const byCategory = expenseByCategory(transactions).map((row) => ({
      ...row,
      count: transactions.filter((t) => t.type === 'expense' && t.category === row.category).length,
      percent: totals.expense ? Math.round((row.total / totals.expense) * 1000) / 10 : 0,
    }))
    return {
      loading: false,
      error: null,
      summary: {
        income: totals.income,
        expense: totals.expense,
        balance: totals.balance,
        transactionCount: transactions.length,
        thisMonth: { income: thisMonth.income, expense: thisMonth.expense },
        currency: 'INR',
      },
      byCategory,
      monthly: monthlyTrend(transactions, months),
    }
  }, [isApi, transactions, months])

  if (!isApi) return { ...local, isApi: false }

  return {
    ...state,
    loading: state.key !== requestKey,
    error: state.key === requestKey ? state.error : null,
    isApi: true,
  }
}

export default useDashboardStats
