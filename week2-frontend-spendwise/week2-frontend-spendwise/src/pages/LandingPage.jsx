/**
 * LandingPage – public marketing / intro page ("/").
 * Sections: hero, live stats teaser, features, how-it-works, CTA.
 */

import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTransactions } from '../context/TransactionsContext'
import { computeTotals } from '../utils/stats'
import { formatCurrency } from '../utils/format'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

const FEATURES = [
  {
    icon: 'wallet',
    title: 'Track every rupee',
    text: 'Log income and expenses in seconds with categories, payment methods and notes.',
  },
  {
    icon: 'chart',
    title: 'See where money goes',
    text: 'Interactive donut and trend charts reveal spending patterns across months.',
  },
  {
    icon: 'globe',
    title: 'Live currency conversion',
    text: 'Convert any amount with real exchange rates fetched from a public API.',
  },
  {
    icon: 'shield',
    title: 'Works offline, syncs when you sign in',
    text: 'Use it as a guest with data kept in your browser, or create a free account to sync securely through the SpendWise REST API.',
  },
]

const STEPS = [
  { n: '01', title: 'Add a transaction', text: 'Hit "Add", fill in the amount, pick a category and save.' },
  {
    n: '02',
    title: 'Explore your dashboard',
    text: 'Filter, search and sort your history; watch the charts update live.',
  },
  {
    n: '03',
    title: 'Drill into details',
    text: 'Open any transaction to view, edit or delete it – plus see its share of your spend.',
  },
]

export default function LandingPage() {
  useDocumentTitle('Home')
  const { transactions } = useTransactions()
  const totals = computeTotals(transactions)

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-brand-100 via-transparent to-transparent dark:from-brand-900/40"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
              Personal finance, simplified
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Know exactly where your <span className="text-brand-600 dark:text-brand-400">money goes.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
              SpendWise is a fast, accessible expense tracker. Log spending, visualise trends and convert currencies —
              all from one clean dashboard that works on any device.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button to="/dashboard" size="lg" iconRight="back" className="[&>svg]:rotate-180">
                Open dashboard
              </Button>
              <Button to="/dashboard?new=1" size="lg" variant="secondary" icon="plus">
                Add a transaction
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Balance</dt>
                <dd className="mt-1 text-lg font-bold sm:text-xl">
                  {formatCurrency(totals.balance, 'INR', { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Income</dt>
                <dd className="mt-1 text-lg font-bold text-emerald-600 sm:text-xl dark:text-emerald-400">
                  {formatCurrency(totals.income, 'INR', { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Expenses</dt>
                <dd className="mt-1 text-lg font-bold text-rose-600 sm:text-xl dark:text-rose-400">
                  {formatCurrency(totals.expense, 'INR', { maximumFractionDigits: 0 })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Illustration – pure CSS/SVG mock of the dashboard */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
            <div className="card rotate-1 p-5 shadow-xl transition-transform duration-500 hover:rotate-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Total balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totals.balance, 'INR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  ↑ 12.4%
                </span>
              </div>
              <div className="mt-5 flex h-28 items-end gap-2">
                {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-brand-200 dark:bg-brand-900"
                    style={{ height: `${h}%` }}
                  >
                    <div className="h-2/3 rounded-t-md bg-brand-500" />
                  </div>
                ))}
              </div>
              <ul className="mt-5 space-y-3">
                {[
                  ['Grocery run', '−₹2,340', '#f97316', 'food'],
                  ['Freelance project', '+₹12,000', '#84cc16', 'laptop'],
                  ['Netflix', '−₹649', '#eab308', 'film'],
                ].map(([t, a, c, ic]) => (
                  <li key={t} className="flex items-center gap-3 text-sm">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${c}22`, color: c }}
                    >
                      <Icon name={ic} size={16} />
                    </span>
                    <span className="flex-1">{t}</span>
                    <span className={`font-semibold ${a.startsWith('+') ? 'text-emerald-600' : ''}`}>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card absolute -bottom-6 -left-4 hidden w-44 -rotate-3 p-4 shadow-lg sm:block">
              <p className="text-xs text-slate-500">1 USD ≈</p>
              <p className="text-lg font-bold">₹94.5</p>
              <p className="text-[10px] text-slate-400">Live via Frankfurter API</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="features-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="features-heading" className="text-3xl font-bold tracking-tight">
            Everything you need, nothing you don't
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Built as a single-page React application with a focus on speed, responsiveness and accessibility.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="card p-6 transition-shadow hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                <Icon name={f.icon} size={22} />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section className="bg-white py-16 dark:bg-slate-900" aria-labelledby="how-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="how-heading" className="text-center text-3xl font-bold tracking-tight">
            How it works
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative pl-14">
                <span
                  className="absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-brand-700 to-brand-900 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">Ready to take control?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Demo data is pre-loaded so you can explore right away. Add, edit or delete anything — it's your sandbox.
          </p>
          <div className="mt-8 flex justify-center">
            <Button to="/dashboard" size="lg" className="bg-white text-brand-800 hover:bg-brand-50">
              Go to dashboard
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
