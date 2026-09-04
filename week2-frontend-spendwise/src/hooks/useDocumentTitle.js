/**
 * useDocumentTitle – keeps the browser tab title in sync with the current page.
 * Good for accessibility: screen readers announce the title on route change.
 */

import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · SpendWise` : 'SpendWise'
    return () => {
      document.title = previous
    }
  }, [title])
}
