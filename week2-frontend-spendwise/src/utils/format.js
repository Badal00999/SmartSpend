/**
 * Formatting helpers – thin wrappers around the Intl API so every part of the
 * UI formats money and dates identically.
 */

const currencyFormatters = new Map()

/**
 * Format a number as currency.
 * @param {number} amount
 * @param {string} [currency='INR'] ISO-4217 code
 * @param {object} [opts]
 * @param {number} [opts.maximumFractionDigits]
 */
export function formatCurrency(amount, currency = 'INR', opts = {}) {
  const key = `${currency}-${opts.maximumFractionDigits ?? 'd'}`
  if (!currencyFormatters.has(key)) {
    currencyFormatters.set(
      key,
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: opts.maximumFractionDigits ?? 2,
      }),
    )
  }
  return currencyFormatters.get(key).format(Number(amount) || 0)
}

/** Compact form for chart axes, e.g. ₹12.5K */
export function formatCompact(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(amount) || 0)
}

/**
 * Format an ISO date string (YYYY-MM-DD) for display.
 * @param {string} iso
 * @param {'short'|'long'} [style='short']
 */
export function formatDate(iso, style = 'short') {
  if (!iso) return ''
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(
    'en-IN',
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  )
}

/** "2026-09" -> "Sep 2026" */
export function formatMonth(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** Today's date as YYYY-MM-DD in local time (safe for <input type="date">). */
export function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Relative "3 days ago" text used in the detail view. */
export function relativeDays(iso) {
  const then = new Date(`${iso}T00:00:00`)
  const now = new Date(`${todayISO()}T00:00:00`)
  const diff = Math.round((now - then) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 0) return `In ${Math.abs(diff)} day${diff === -1 ? '' : 's'}`
  if (diff < 30) return `${diff} days ago`
  const months = Math.round(diff / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}
