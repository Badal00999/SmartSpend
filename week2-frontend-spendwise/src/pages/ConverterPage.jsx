/**
 * ConverterPage – "/convert"
 * Live currency converter powered by the Frankfurter public API.
 * Demonstrates async data fetching with loading, error and retry states.
 */

import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDebounce } from '../hooks/useDebounce'
import { useFetch } from '../hooks/useFetch'
import { useTransactions } from '../context/TransactionsContext'
import { SUPPORTED_CURRENCIES, fetchLatestRates } from '../services/exchangeRateApi'
import { computeTotals } from '../utils/stats'
import { formatCurrency, formatDate } from '../utils/format'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import Icon from '../components/ui/Icon'

const CURRENCY_NAMES = {
  INR: 'Indian Rupee',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  SGD: 'Singapore Dollar',
  CHF: 'Swiss Franc',
}

export default function ConverterPage() {
  useDocumentTitle('Currency converter')
  const { transactions } = useTransactions()
  const balance = computeTotals(transactions).balance

  const [amount, setAmount] = useState('1000')
  const [from, setFrom] = useState('INR')
  const [to, setTo] = useState('USD')
  const debouncedAmount = useDebounce(amount, 300)

  // One request per base currency; conversions are derived client-side
  const { data, loading, error, refetch } = useFetch((signal) => fetchLatestRates(from, SUPPORTED_CURRENCIES, signal), [from])

  const rate = from === to ? 1 : data?.rates?.[to]
  const numericAmount = Number(debouncedAmount)
  const converted = rate && !Number.isNaN(numericAmount) ? numericAmount * rate : null

  const table = useMemo(() => {
    if (!data?.rates) return []
    return Object.entries(data.rates)
      .map(([code, r]) => ({ code, rate: r, name: CURRENCY_NAMES[code] ?? code }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [data])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Currency converter</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Live reference rates from the European Central Bank via the{' '}
          <a href="https://frankfurter.dev" target="_blank" rel="noreferrer noopener" className="text-brand-700 underline dark:text-brand-300">
            Frankfurter API
          </a>
          .
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Converter card */}
        <section className="card p-6 lg:col-span-3" aria-labelledby="convert-heading">
          <h2 id="convert-heading" className="sr-only">
            Convert an amount
          </h2>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            <div>
              <label htmlFor="cv-amount" className="label">
                Amount
              </label>
              <input
                id="cv-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input text-lg"
              />
              <button
                type="button"
                onClick={() => setAmount(String(Math.max(0, Math.round(balance))))}
                className="mt-1.5 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Use my balance ({formatCurrency(balance, 'INR', { maximumFractionDigits: 0 })})
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div>
                <label htmlFor="cv-from" className="label">
                  From
                </label>
                <select id="cv-from" value={from} onChange={(e) => setFrom(e.target.value)} className="input">
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c} — {CURRENCY_NAMES[c]}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" size="icon" onClick={swap} aria-label="Swap currencies" className="mb-0.5">
                <Icon name="swap" size={18} />
              </Button>
              <div>
                <label htmlFor="cv-to" className="label">
                  To
                </label>
                <select id="cv-to" value={to} onChange={(e) => setTo(e.target.value)} className="input">
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c} — {CURRENCY_NAMES[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </form>

          {/* Result */}
          <div
            className="mt-6 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white"
            aria-live="polite"
            aria-atomic="true"
          >
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40 bg-white/30" />
                <Skeleton className="h-10 w-64 bg-white/30" />
                <Skeleton className="h-3 w-52 bg-white/30" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-start gap-3">
                <p className="flex items-center gap-2 text-sm">
                  <Icon name="alert" size={18} />
                  {error}
                </p>
                <Button variant="secondary" size="sm" icon="refresh" onClick={refetch}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-brand-100">
                  {formatCurrency(numericAmount || 0, from)} equals
                </p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {converted === null ? '—' : formatCurrency(converted, to)}
                </p>
                <p className="mt-2 text-xs text-brand-100/90">
                  1 {from} = {rate?.toFixed(4)} {to} · Updated {data?.date ? formatDate(data.date) : '—'}
                </p>
              </>
            )}
          </div>
        </section>

        {/* Rate table */}
        <section className="card p-6 lg:col-span-2" aria-labelledby="rates-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="rates-heading" className="font-semibold">
              1 {from} in other currencies
            </h2>
            <button
              type="button"
              onClick={refetch}
              aria-label="Refresh rates"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Icon name="refresh" size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <ul className="space-y-3">
              {SUPPORTED_CURRENCIES.slice(1).map((c) => (
                <li key={c} className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <p className="text-sm text-slate-500">Rates unavailable.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.map((row) => (
                  <tr key={row.code}>
                    <th scope="row" className="py-2.5 text-left font-normal">
                      <button
                        type="button"
                        onClick={() => setTo(row.code)}
                        className={`rounded px-1 text-left hover:text-brand-700 dark:hover:text-brand-300 ${
                          row.code === to ? 'font-semibold text-brand-700 dark:text-brand-300' : ''
                        }`}
                        aria-pressed={row.code === to}
                      >
                        <span className="font-mono">{row.code}</span>
                        <span className="ml-2 text-slate-500 dark:text-slate-400">{row.name}</span>
                      </button>
                    </th>
                    <td className="py-2.5 text-right font-medium tabular-nums">{row.rate.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
