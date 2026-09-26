/**
 * Stats API service
 * -----------------
 * Week 4: the dashboard numbers are no longer calculated in the browser. The
 * back-end computes them with MongoDB aggregation pipelines over the *whole*
 * data set (not just the page that happens to be loaded), which is both faster
 * and correct once the account has more rows than one screen.
 */
import { api } from './api'

/** GET /stats/summary – totals, balance and this month. */
export async function fetchSummary({ signal, from, to } = {}) {
  const res = await api.get(`/stats/summary${range(from, to)}`, { signal })
  return res.data
}

/** GET /stats/by-category – expense split with percentages. */
export async function fetchByCategory({ signal, from, to } = {}) {
  const res = await api.get(`/stats/by-category${range(from, to)}`, { signal })
  return { items: res.data, totalExpense: res.meta?.totalExpense ?? 0 }
}

/** GET /stats/monthly?months=n – income vs expense, oldest → newest. */
export async function fetchMonthly({ months = 6, signal } = {}) {
  const res = await api.get(`/stats/monthly?months=${months}`, { signal })
  return res.data
}

/** GET /meta/categories – enum values straight from the database schema. */
export async function fetchMeta({ signal } = {}) {
  const res = await api.get('/meta/categories', { auth: false, signal })
  return res.data
}

/** GET /health – used by the connection banner to describe the outage. */
export async function fetchHealth({ signal } = {}) {
  const res = await api.get('/health', { auth: false, signal })
  return res.data
}

function range(from, to) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
