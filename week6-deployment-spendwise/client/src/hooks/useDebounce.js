/**
 * useDebounce – returns a copy of `value` that only updates after `delay` ms
 * of inactivity. Used to keep the search box responsive without filtering on
 * every keystroke.
 */

import { useEffect, useState } from 'react'

export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
