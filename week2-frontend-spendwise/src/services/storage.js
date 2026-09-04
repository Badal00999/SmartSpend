/**
 * Persistence layer
 * -----------------
 * Transactions are persisted in `localStorage` behind a tiny repository-style
 * API (load / save / seed). The rest of the app never touches localStorage
 * directly, so swapping to a real REST back-end later is a one-file change.
 */

import { todayISO } from '../utils/format'

export const STORAGE_KEY = 'spendwise.transactions.v1'
export const SETTINGS_KEY = 'spendwise.settings.v1'

/** Generates realistic seed data spread over the past ~5 months. */
export function generateSeedTransactions() {
  const today = new Date(`${todayISO()}T00:00:00`)
  const daysAgo = (n) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }

  // [title, amount, type, category, payment, daysAgo, notes]
  const rows = [
    ['Monthly salary', 85000, 'income', 'salary', 'bank', 3, 'September salary credited'],
    ['Grocery run – Reliance Fresh', 2340, 'expense', 'food', 'upi', 1, 'Weekly vegetables, milk and snacks'],
    ['Uber to office', 260, 'expense', 'transport', 'wallet', 1, ''],
    ['Netflix subscription', 649, 'expense', 'entertainment', 'card', 2, 'Standard plan'],
    ['Electricity bill', 1870, 'expense', 'bills', 'upi', 4, 'PSPCL – August cycle'],
    ['Zomato dinner', 540, 'expense', 'food', 'upi', 5, 'Friday night order'],
    ['Logo design project', 12000, 'income', 'freelance', 'bank', 6, 'Client: Sharma Textiles'],
    ['New running shoes', 3499, 'expense', 'shopping', 'card', 8, 'Decathlon'],
    ['Petrol', 2000, 'expense', 'transport', 'card', 10, ''],
    ['Doctor consultation', 800, 'expense', 'health', 'cash', 12, 'Annual check-up'],
    ['Udemy course – React', 499, 'expense', 'education', 'card', 14, 'Advanced React patterns'],
    ['Mobile recharge', 299, 'expense', 'bills', 'upi', 16, 'Jio 28-day plan'],
    ['Movie night', 700, 'expense', 'entertainment', 'card', 18, 'PVR – two tickets'],
    ['Weekend trip to Dharamshala', 6800, 'expense', 'travel', 'card', 22, 'Hotel + bus'],
    ['Monthly salary', 85000, 'income', 'salary', 'bank', 34, 'August salary credited'],
    ['Grocery run', 2950, 'expense', 'food', 'upi', 36, ''],
    ['Internet bill', 999, 'expense', 'bills', 'upi', 40, 'Airtel Fiber'],
    ['Gym membership', 1500, 'expense', 'health', 'upi', 45, 'Quarterly plan'],
    ['Birthday gift', 1800, 'expense', 'shopping', 'card', 50, 'For Priya'],
    ['Auto rickshaw', 120, 'expense', 'transport', 'cash', 52, ''],
    ['Monthly salary', 85000, 'income', 'salary', 'bank', 64, 'July salary credited'],
    ['Website maintenance', 8000, 'income', 'freelance', 'bank', 70, 'Retainer'],
    ['Restaurant – family dinner', 3200, 'expense', 'food', 'card', 72, ''],
    ['Electricity bill', 2210, 'expense', 'bills', 'upi', 75, ''],
    ['Books', 1150, 'expense', 'education', 'card', 80, 'Two paperbacks'],
    ['Monthly salary', 85000, 'income', 'salary', 'bank', 95, 'June salary credited'],
    ['Laptop repair', 4500, 'expense', 'other', 'cash', 100, 'Battery replacement'],
    ['Concert tickets', 2500, 'expense', 'entertainment', 'card', 105, ''],
    ['Grocery run', 2600, 'expense', 'food', 'upi', 110, ''],
    ['Monthly salary', 85000, 'income', 'salary', 'bank', 125, 'May salary credited'],
    ['Flight to Delhi', 5200, 'expense', 'travel', 'card', 130, 'Work trip'],
    ['Pharmacy', 640, 'expense', 'health', 'upi', 135, ''],
  ]

  return rows.map(([title, amount, type, category, payment, ago, notes], i) => ({
    id: `seed-${i + 1}`,
    title,
    amount,
    type,
    category,
    payment,
    date: daysAgo(ago),
    notes,
    createdAt: Date.now() - ago * 86_400_000,
  }))
}

function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json)
    return value ?? fallback
  } catch {
    return fallback
  }
}

/** Load transactions; seeds demo data on first launch. */
export function loadTransactions() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    const seed = generateSeedTransactions()
    saveTransactions(seed)
    return seed
  }
  const parsed = safeParse(raw, [])
  return Array.isArray(parsed) ? parsed : []
}

export function saveTransactions(transactions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
  } catch (err) {
    // Quota exceeded or private mode – app still works in-memory.
    console.warn('Could not persist transactions', err)
  }
}

export function loadSettings() {
  if (typeof window === 'undefined') return {}
  return safeParse(window.localStorage.getItem(SETTINGS_KEY), {})
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

/** Generates a reasonably unique id without external dependencies. */
export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
