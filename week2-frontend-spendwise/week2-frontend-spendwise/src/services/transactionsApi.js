/**
 * Transactions API service
 * ------------------------
 * Thin, typed functions over the REST endpoints. Components never build URLs.
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

/** Fetch every page of the user's transactions (dashboard filters run client-side). */
export async function fetchAllTransactions(signal) {
  const limit = 100
  let page = 1
  const items = []
  for (;;) {
    const res = await api.get(`/transactions?limit=${limit}&page=${page}&sort=-date`, { signal })
    items.push(...res.data.map(fromApi))
    if (!res.meta?.hasNext) break
    page += 1
  }
  return items
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

/** Import many transactions at once (used to migrate localStorage data). */
export async function bulkCreate(list) {
  const res = await api.post('/transactions/bulk', list.map(toPayload))
  return res.data.items.map(fromApi)
}

export async function fetchSummary(signal) {
  const res = await api.get('/stats/summary', { signal })
  return res.data
}
