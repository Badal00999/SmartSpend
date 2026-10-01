/**
 * Transactions API service
 * ------------------------
 * Thin, typed functions over the REST endpoints. Components never build URLs.
 *
 * Week 4: `listTransactions()` fetches a single page with the server applying
 * the filters/sort, and `deleteAllTransactions()` powers the Settings danger zone.
 */

import { api } from './api'

/** Only the fields the API accepts – strips client-side extras (id, createdAt…). */
export function toPayload(tx) {
  return {
    title: tx.title,
    amount: Number(tx.amount),
    type: tx.type,
    category: tx.category,
    payment: tx.payment,
    date: tx.date,
    notes: tx.notes ?? '',
  }
}

/** Normalise an API record so the UI can treat local & remote data alike. */
export function fromApi(record) {
  return {
    ...record,
    createdAt: record.createdAt ? new Date(record.createdAt).getTime() : Date.now(),
  }
}

/** Turn a filter object into a query string (empty values are omitted). */
export function buildQuery(query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Fetch ONE page (server-side filtering, sorting and pagination). */
export async function listTransactions(query = {}, signal) {
  const res = await api.get(`/transactions${buildQuery(query)}`, { signal })
  return { items: res.data.map(fromApi), meta: res.meta ?? null }
}

/** Fetch every page – used to keep the whole list in memory (detail view, exports). */
export async function fetchAllTransactions(signal, { maxPages = 20 } = {}) {
  const limit = 100
  let page = 1
  const items = []
  for (;;) {
    const { items: batch, meta } = await listTransactions({ limit, page, sort: '-date' }, signal)
    items.push(...batch)
    if (!meta?.hasNext || page >= maxPages) break
    page += 1
  }
  return items
}

export async function getTransaction(id, signal) {
  const res = await api.get(`/transactions/${id}`, { signal })
  return fromApi(res.data)
}

export async function createTransaction(tx) {
  const res = await api.post('/transactions', toPayload(tx))
  return fromApi(res.data)
}

export async function updateTransaction(id, tx) {
  const res = await api.patch(`/transactions/${id}`, toPayload(tx))
  return fromApi(res.data)
}

export async function deleteTransaction(id) {
  await api.delete(`/transactions/${id}`)
}

/** Week 4 – wipe the account history with a single request. */
export async function deleteAllTransactions() {
  const res = await api.delete('/transactions')
  return res?.data ?? { deletedCount: 0 }
}

/** Import many transactions at once (used to migrate localStorage data). */
export async function bulkCreate(list) {
  const res = await api.post('/transactions/bulk', list.map(toPayload))
  return res.data.items.map(fromApi)
}

export async function fetchSummary(signal) {
  const res = await api.get('/stats/summary', { signal })
  return res.data
}
