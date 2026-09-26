/**
 * Pagination
 * ----------
 * Renders the `meta` block the API returns for a paged list
 * (page, limit, total, totalPages, hasNext, hasPrev) so the user can walk
 * through the data that lives on the server.
 */
import Icon from '../ui/Icon'

/** Compact page list: 1 … 4 5 6 … 12 */
export function pageNumbers(current, total, window = 1) {
  const pages = new Set([1, total, current])
  for (let i = 1; i <= window; i += 1) {
    if (current - i >= 1) pages.add(current - i)
    if (current + i <= total) pages.add(current + i)
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push('…')
    out.push(page)
    previous = page
  }
  return out
}

export default function Pagination({ meta, onPageChange, className = '' }) {
  if (!meta || meta.total === 0) return null
  const { page, totalPages, total, limit } = meta
  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)

  return (
    <nav
      aria-label="Transaction pages"
      className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}
    >
      <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        Showing <span className="font-medium text-slate-700 dark:text-slate-200">{first}</span>–
        <span className="font-medium text-slate-700 dark:text-slate-200">{last}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span>
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!meta.hasPrev}
            aria-label="Previous page"
            className="btn-icon disabled:opacity-40"
          >
            <Icon name="chevronLeft" size={16} />
          </button>

          {pageNumbers(page, totalPages).map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                  item === page
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!meta.hasNext}
            aria-label="Next page"
            className="btn-icon disabled:opacity-40"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </nav>
  )
}
