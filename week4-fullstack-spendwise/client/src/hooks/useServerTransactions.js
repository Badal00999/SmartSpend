/**
 * Server-side transaction listing
 * -------------------------------
 * Week 3 loaded every page of transactions and filtered in the browser. Week 4
 * moves search / filter / sort / pagination to the API (`GET /transactions`),
 * which is what the task means by "asynchronous data fetching and proper state
 * management": the URL carries the query, the server answers with one page plus
 * `meta` (total, totalPages, hasNext…), and the UI renders exactly that.
 *
 * Guest mode (no account yet) computes the same page from the local list, so
 * the app keeps working fully offline – components cannot tell the difference.
 *
 * Implementation note: `loading` is *derived* from a request key
 * (`filters | page | version | manual refresh`) instead of being toggled inside
 * the effect. That avoids the cascading-render pattern the React compiler warns
 * about, and guarantees the UI can never show stale rows as if they were fresh.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as remote from '../services/transactionsApi'
import { filterTransactions } from '../utils/stats'
import { useTransactions } from '../context/TransactionsContext'

/** Map the UI's sort labels to the API's sort fields. */
const SORT_MAP = {
  'date-desc': '-date',
  'date-asc': 'date',
  'amount-desc': '-amount',
  'amount-asc': 'amount',
}

/** Turn the UI filters into the API query object (empty values are dropped). */
export function toApiQuery(filters = {}, { page = 1, limit = 8 } = {}) {
  const query = { page, limit }
  if (filters.type && filters.type !== 'all') query.type = filters.type
  if (filters.category && filters.category !== 'all') query.category = filters.category
  if (filters.payment && filters.payment !== 'all') query.payment = filters.payment
  if (filters.query?.trim()) query.q = filters.query.trim()
  if (filters.from) query.from = filters.from
  if (filters.to) query.to = filters.to
  query.sort = filters.sort ?? '-date'
  return query
}

/**
 * @param {object} options
 * @param {{query?:string,type?:string,category?:string,sort?:string,from?:string,to?:string}} options.filters
 * @param {number} [options.page]
 * @param {number} [options.limit]
 */
export function useServerTransactions({ filters = {}, page = 1, limit = 8 }) {
  const { source, transactions: allLocal, version } = useTransactions()
  const isApi = source === 'api'
  // Primitive values keep the memo dependencies honest and stable
  const { query = '', type = 'all', category = 'all', sort = 'date-desc' } = filters

  const [manualKey, setManualKey] = useState(0)
  const [state, setState] = useState({ key: null, items: [], meta: null, error: null })
  const requestIdRef = useRef(0)

  // Filter values are compared by value so a new object identity never triggers
  // a refetch; the latest object is kept in a ref for the effect to read.
  const filtersKey = JSON.stringify(filters)
  const filtersRef = useRef(filters)
  useEffect(() => {
    filtersRef.current = filters
  })

  const requestKey = `${filtersKey}|${page}|${limit}|${version}|${manualKey}`

  useEffect(() => {
    if (!isApi) return undefined

    const id = ++requestIdRef.current
    const controller = new AbortController()

    const current = filtersRef.current
    const apiFilters = { ...current, sort: SORT_MAP[current?.sort] ?? current?.sort ?? '-date' }

    remote
      .listTransactions(toApiQuery(apiFilters, { page, limit }), controller.signal)
      .then(({ items, meta }) => {
        if (id !== requestIdRef.current) return // a newer request won
        setState({ key: requestKey, items, meta, error: null })
      })
      .catch((err) => {
        if (controller.signal.aborted || id !== requestIdRef.current) return
        setState({ key: requestKey, items: [], meta: null, error: err.message })
      })

    return () => controller.abort()
  }, [isApi, requestKey, page, limit])

  /** Force a fresh request (the "Try again" button after a failure). */
  const refetch = useCallback(() => setManualKey((k) => k + 1), [])

  // ---- Guest mode: the same shape, computed locally -----------------------
  const localView = useMemo(() => {
    const filtered = filterTransactions(allLocal, { query, type, category, sort })
    const start = (page - 1) * limit
    return {
      items: filtered.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        hasNext: start + limit < filtered.length,
        hasPrev: page > 1,
      },
      error: null,
    }
  }, [allLocal, query, type, category, sort, page, limit])

  if (!isApi) return { ...localView, loading: false, refetch, isApi: false }

  return {
    ...state,
    loading: state.key !== requestKey,
    error: state.key === requestKey ? state.error : null,
    refetch,
    isApi: true,
  }
}

export default useServerTransactions
