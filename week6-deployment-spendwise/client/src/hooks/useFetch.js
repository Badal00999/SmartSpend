/**
 * useFetch – generic async-data hook.
 *
 * Handles the loading / error / data triad, cancels stale requests with an
 * AbortController when dependencies change or the component unmounts, and
 * exposes `refetch` for a "Try again" button.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetcher  async function receiving an AbortSignal
 * @param {unknown[]} deps  dependency list – refetches when any value changes
 * @returns {{ data: T|null, error: string|null, loading: boolean, refetch: () => void }}
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setState({ data: null, error: err.message ?? 'Something went wrong', loading: false })
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { ...state, refetch }
}
