/**
 * Badge – small pill for categories / types.
 * CategoryBadge derives its colour from the category definition.
 */

import { getCategory } from '../../utils/categories'
import Icon from './Icon'

export function Badge({ children, className = '', style }) {
  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  )
}

export function CategoryBadge({ categoryId, withIcon = true }) {
  const cat = getCategory(categoryId)
  return (
    <Badge style={{ backgroundColor: `${cat.color}1f`, color: cat.color }} className="ring-1 ring-inset">
      {withIcon && <Icon name={cat.icon} size={12} strokeWidth={2.2} />}
      {cat.label}
    </Badge>
  )
}

export function TypeBadge({ type }) {
  const isIncome = type === 'income'
  return (
    <Badge
      className={
        isIncome
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
      }
    >
      <Icon name={isIncome ? 'arrowDown' : 'arrowUp'} size={12} strokeWidth={2.4} />
      {isIncome ? 'Income' : 'Expense'}
    </Badge>
  )
}
