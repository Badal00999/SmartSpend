/**
 * Category & payment-method constants.
 * Kept in one place so the form, filters, charts and badges all stay in sync.
 */

export const CATEGORIES = [
  { id: 'food', label: 'Food & Dining', color: '#f97316', icon: 'food' },
  { id: 'transport', label: 'Transport', color: '#3b82f6', icon: 'transport' },
  { id: 'shopping', label: 'Shopping', color: '#ec4899', icon: 'shopping' },
  { id: 'bills', label: 'Bills & Utilities', color: '#8b5cf6', icon: 'bolt' },
  { id: 'entertainment', label: 'Entertainment', color: '#eab308', icon: 'film' },
  { id: 'health', label: 'Health', color: '#ef4444', icon: 'heart' },
  { id: 'education', label: 'Education', color: '#06b6d4', icon: 'book' },
  { id: 'travel', label: 'Travel', color: '#14b8a6', icon: 'plane' },
  { id: 'salary', label: 'Salary', color: '#22c55e', icon: 'banknotes' },
  { id: 'freelance', label: 'Freelance', color: '#84cc16', icon: 'laptop' },
  { id: 'other', label: 'Other', color: '#64748b', icon: 'cube' },
]

/** Categories that make sense for a given transaction type. */
export const INCOME_CATEGORY_IDS = ['salary', 'freelance', 'other']
export const EXPENSE_CATEGORY_IDS = CATEGORIES.map((c) => c.id).filter(
  (id) => !['salary', 'freelance'].includes(id),
)

export const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Credit / Debit card' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank transfer' },
  { id: 'wallet', label: 'Wallet' },
]

export const TRANSACTION_TYPES = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
const PAYMENT_MAP = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.id, p]))

/** Safe lookup – always returns a category (falls back to "Other"). */
export function getCategory(id) {
  return CATEGORY_MAP[id] ?? CATEGORY_MAP.other
}

export function getPaymentMethod(id) {
  return PAYMENT_MAP[id] ?? { id, label: id ?? 'Unknown' }
}
