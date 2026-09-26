/**
 * TransactionItem – one row in the dashboard list.
 * The whole row is a link to the detail page; quick actions are separate
 * buttons so keyboard users can reach them independently.
 */

import { Link } from 'react-router-dom'
import { getCategory } from '../../utils/categories'
import { formatCurrency, formatDate } from '../../utils/format'
import Icon from '../ui/Icon'
import { CategoryBadge } from '../ui/Badge'

export default function TransactionItem({ transaction, onEdit, onDelete }) {
  const { id, title, amount, type, category, date } = transaction
  const cat = getCategory(category)
  const isIncome = type === 'income'

  return (
    <li className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:gap-4 sm:px-5 dark:hover:bg-slate-800/60">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}
        aria-hidden="true"
      >
        <Icon name={cat.icon} size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <Link
          to={`/transactions/${id}`}
          className="block truncate font-medium text-slate-900 after:absolute after:inset-0 after:content-[''] dark:text-slate-100"
        >
          {title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <time dateTime={date}>{formatDate(date)}</time>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline">
            <CategoryBadge categoryId={category} withIcon={false} />
          </span>
        </div>
      </div>

      <p
        className={`shrink-0 text-right font-semibold tabular-nums ${
          isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        <span className="sr-only">{isIncome ? 'Income of' : 'Expense of'} </span>
        {isIncome ? '+' : '−'}
        {formatCurrency(amount)}
      </p>

      {/* Quick actions – positioned above the overlay link (z-10) */}
      <div className="relative z-10 hidden shrink-0 items-center gap-1 sm:flex">
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          aria-label={`Edit ${title}`}
          className="rounded-lg p-2 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <Icon name="edit" size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(transaction)}
          aria-label={`Delete ${title}`}
          className="rounded-lg p-2 text-slate-400 opacity-0 transition-opacity hover:bg-rose-100 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-900/50 dark:hover:text-rose-300"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      <Icon name="back" size={16} className="shrink-0 rotate-180 text-slate-300 sm:hidden dark:text-slate-600" />
    </li>
  )
}
