/**
 * Pure functions that turn a list of transactions into dashboard statistics.
 * Being pure (no React, no side effects) makes them trivial to unit-test.
 */

/** Sum of all income minus all expenses. */
export function computeTotals(transactions) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') income += amt
    else expense += amt
  }
  return { income, expense, balance: income - expense }
}

/** Group expense totals by category, sorted descending. */
export function expenseByCategory(transactions) {
  const map = new Map()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount))
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Income vs expense totals per month for the last `months` months.
 * Returns oldest -> newest so it can feed a bar chart directly.
 */
export function monthlyTrend(transactions, months = 6) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ month: key, income: 0, expense: 0 })
  }
  const index = Object.fromEntries(buckets.map((b, i) => [b.month, i]))
  for (const t of transactions) {
    const key = t.date?.slice(0, 7)
    if (key in index) {
      buckets[index[key]][t.type === 'income' ? 'income' : 'expense'] += Number(t.amount)
    }
  }
  return buckets
}

/** Filter + sort helper used by the dashboard list. */
export function filterTransactions(transactions, { query = '', type = 'all', category = 'all', sort = 'date-desc' }) {
  const q = query.trim().toLowerCase()
  const list = transactions.filter((t) => {
    if (type !== 'all' && t.type !== type) return false
    if (category !== 'all' && t.category !== category) return false
    if (q && !`${t.title} ${t.notes ?? ''} ${t.category}`.toLowerCase().includes(q)) return false
    return true
  })

  const sorters = {
    'date-desc': (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    'date-asc': (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    'amount-desc': (a, b) => b.amount - a.amount,
    'amount-asc': (a, b) => a.amount - b.amount,
  }
  return list.sort(sorters[sort] ?? sorters['date-desc'])
}

/** Percentage of a category's spend versus the total expense (0-100). */
export function percentOf(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}
