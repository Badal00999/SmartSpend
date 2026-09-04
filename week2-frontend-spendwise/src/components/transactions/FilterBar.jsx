/**
 * FilterBar – search, type, category and sort controls for the dashboard list.
 * Fully controlled: the parent owns the filter state and passes `onChange`.
 */

import { CATEGORIES } from '../../utils/categories'
import Icon from '../ui/Icon'

export const DEFAULT_FILTERS = { query: '', type: 'all', category: 'all', sort: 'date-desc' }

export default function FilterBar({ filters, onChange, resultCount }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value })
  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  return (
    <section aria-label="Filter transactions" className="card p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <label htmlFor="filter-query" className="sr-only">
            Search transactions
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            id="filter-query"
            type="search"
            placeholder="Search by title, notes or category…"
            value={filters.query}
            onChange={set('query')}
            className="input pl-10"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="filter-type" className="sr-only">
            Type
          </label>
          <select id="filter-type" value={filters.type} onChange={set('type')} className="input md:w-36">
            <option value="all">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-category" className="sr-only">
            Category
          </label>
          <select id="filter-category" value={filters.category} onChange={set('category')} className="input md:w-44">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-sort" className="sr-only">
            Sort by
          </label>
          <select id="filter-sort" value={filters.sort} onChange={set('sort')} className="input md:w-44">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        {/* aria-live so screen readers hear the count update as filters change */}
        <p aria-live="polite" aria-atomic="true">
          {resultCount} {resultCount === 1 ? 'transaction' : 'transactions'} found
        </p>
        {isDirty && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}
