/**
 * Exchange-rate service
 * ---------------------
 * Wraps the free, key-less Frankfurter API (https://frankfurter.dev) which
 * publishes reference rates from the European Central Bank.
 *
 * All network access is isolated in this module so the UI never calls `fetch`
 * directly – this makes components easier to test and lets us swap the
 * provider later without touching any component.
 */

const BASE_URL = 'https://api.frankfurter.dev/v1'

/** Currencies offered in the converter UI. */
export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'CHF']

/**
 * Small fetch helper with timeout + friendly errors.
 * @param {string} path
 * @param {AbortSignal} [signal]
 */
async function request(path, signal) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  // Forward the caller's abort signal to our controller
  signal?.addEventListener('abort', () => controller.abort(), { once: true })

  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`Exchange-rate API responded with ${res.status}`)
    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.')
    throw new Error(err.message || 'Network error while fetching rates.')
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch latest rates for `base` against `symbols`.
 * @returns {Promise<{ base: string, date: string, rates: Record<string, number> }>}
 */
export function fetchLatestRates(base = 'INR', symbols = SUPPORTED_CURRENCIES, signal) {
  const targets = symbols.filter((s) => s !== base).join(',')
  return request(`/latest?base=${base}&symbols=${targets}`, signal)
}

/**
 * Convert an amount using the API's built-in `amount` parameter.
 * @returns {Promise<number>} converted value
 */
export async function convertAmount(amount, from, to, signal) {
  if (from === to) return Number(amount)
  const data = await request(`/latest?amount=${amount}&base=${from}&symbols=${to}`, signal)
  return data.rates[to]
}
