/**
 * DashboardPage – "/dashboard"
 * Overview cards, charts, user profile and the filterable transaction list
 * with add / edit / delete flows.
 *
 * Data comes from the TransactionsContext, which uses the SpendWise REST API
 * when the user is signed in and localStorage in guest mode. All mutation
 * handlers are async so API failures surface as toasts / inline messages.
 *
 * URL state: `?new=1` opens the "add transaction" modal so that the navbar
 * and landing page can deep-link into the flow.
 */

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransactions } from '../context/TransactionsContext'
import { useOptionalAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDebounce } from '../hooks/useDebounce'
import { useFetch } from '../hooks/useFetch'
import { fetchUserProfile } from '../services/userApi'
import { Link } from 'react-router-dom'
import { computeTotals, expenseByCategory, filterTransactions, monthlyTrend } from '../utils/stats'
import { formatCurrency } from '../utils/format'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import Icon from '../components/ui/Icon'
import FilterBar, { DEFAULT_FILTERS } from '../components/transactions/FilterBar'
import TransactionItem from '../components/transactions/TransactionItem'
import TransactionForm from '../components/transactions/TransactionForm'
import CategoryDonut from '../components/charts/CategoryDonut'
import TrendBars from '../components/charts/TrendBars'

const PAGE_SIZE = 8

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    resetToDemo,
    importLocal,
    countImportable,
    source,
    loading,
    error,
    reload,
  } = useTransactions()
  const auth = useOptionalAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const importable = source === 'api' ? countImportable() : 0

  // ---- UI state -----------------------------------------------------------
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [editing, setEditing] = useState(null) // transaction being edited
  const [deleting, setDeleting] = useState(null) // transaction pending delete
  const isAdding = searchParams.get('new') === '1'

  const debouncedQuery = useDebounce(filters.query, 250)

  // Pagination: store "how many extra pages" per filter-key so that changing
  // any filter naturally resets the list to the first page (no effect needed).
  const filterKey = `${debouncedQuery}|${filters.type}|${filters.category}|${filters.sort}`
  const [pages, setPages] = useState({ key: filterKey, count: 1 })
  const pageCount = pages.key === filterKey ? pages.count : 1
  const visible = pageCount * PAGE_SIZE
  const showMore = () => setPages({ key: filterKey, count: pageCount + 1 })

  // ---- Derived data (memoised) -------------------------------------------
  const totals = useMemo(() => computeTotals(transactions), [transactions])
  const byCategory = useMemo(() => expenseByCategory(transactions), [transactions])
  const trend = useMemo(() => monthlyTrend(transactions, 6), [transactions])
  const filtered = useMemo(
    () => filterTransactions(transactions, { ...filters, query: debouncedQuery }),
    [transactions, filters, debouncedQuery],
  )
  const thisMonth = useMemo(() => {
    const key = new Date().toISOString().slice(0, 7)
    return computeTotals(transactions.filter((t) => t.date.startsWith(key)))
  }, [transactions])

  // ---- Profile: real account when signed in, DummyJSON demo profile as guest
  const isSignedIn = Boolean(auth?.isAuthenticated)
  const profile = useFetch((signal) => (isSignedIn ? Promise.resolve(null) : fetchUserProfile(1, signal)), [isSignedIn])

  // ---- Handlers (work for both the local store and the REST API) ----------
  const openAdd = () => setSearchParams({ new: '1' })
  const closeAdd = () => setSearchParams({})

  /** Runs an action and turns API errors into a toast instead of a crash. */
  const run = async (action, successMessage) => {
    try {
      await action()
      if (successMessage) toast.success(successMessage)
      return true
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      return false
    }
  }

  const handleAdd = async (values) => {
    if (await run(() => addTransaction(values), 'Transaction added')) closeAdd()
  }

  const handleEdit = async (values) => {
    if (await run(() => updateTransaction(editing.id, values), 'Transaction updated')) setEditing(null)
  }

  const confirmDelete = async () => {
    const target = deleting
    setDeleting(null)
    await run(() => deleteTransaction(target.id), 'Transaction deleted')
  }

  const handleResetDemo = async () => {
    setBusy(true)
    await run(resetToDemo, source === 'api' ? 'Demo transactions added to your account' : 'Demo data restored')
    setBusy(false)
  }

  const handleImport = async () => {
    setBusy(true)
    await run(async () => {
      const n = await importLocal()
      toast.success(`Imported ${n} transaction${n === 1 ? '' : 's'} into your account`)
    })
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isSignedIn ? <AccountHeader user={auth.user} /> : <ProfileHeader profile={profile} />}
        <div className="flex gap-2">
          <Button variant="secondary" icon="refresh" onClick={handleResetDemo} loading={busy} disabled={busy}>
            <span className="hidden sm:inline">{source === 'api' ? 'Add demo data' : 'Reset demo'}</span>
            <span className="sm:hidden">Demo</span>
          </Button>
          <Button icon="plus" onClick={openAdd}>
            Add transaction
          </Button>
        </div>
      </div>

      {/* Data-source banner */}
      {source === 'local' && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Icon name="database" size={16} className="text-slate-400" />
          Guest mode – data is stored in this browser only.
          <Link to="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Sign in
          </Link>
          to sync with the SpendWise API.
        </p>
      )}
      {importable > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="flex items-center gap-2">
            <Icon name="upload" size={16} />
            {importable} transaction{importable === 1 ? '' : 's'} from guest mode {importable === 1 ? 'is' : 'are'}{' '}
            still in this browser.
          </span>
          <Button size="sm" variant="secondary" onClick={handleImport} loading={busy} disabled={busy}>
            Import into my account
          </Button>
        </div>
      )}
      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          <span className="flex items-center gap-2">
            <Icon name="alert" size={16} />
            {error}
          </span>
          <Button size="sm" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          highlight
          label="Total balance"
          value={formatCurrency(totals.balance)}
          icon="wallet"
          hint="All time"
        />
        <StatCard
          label="Total income"
          value={formatCurrency(totals.income)}
          icon="arrowDown"
          tone="emerald"
          hint="All time"
        />
        <StatCard
          label="Total expenses"
          value={formatCurrency(totals.expense)}
          icon="arrowUp"
          tone="rose"
          hint="All time"
        />
        <StatCard
          label="This month"
          value={formatCurrency(thisMonth.expense)}
          icon="calendar"
          tone="slate"
          hint={`Spent · ${formatCurrency(thisMonth.income, 'INR', { maximumFractionDigits: 0 })} earned`}
        />
      </section>

      {/* Charts */}
      <section aria-label="Charts" className="grid gap-6 lg:grid-cols-5">
        <article className="card p-5 lg:col-span-3">
          <h2 className="text-base font-semibold">Income vs expenses</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Last 6 months</p>
          <TrendBars data={trend} />
        </article>
        <article className="card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">Spending by category</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">All time</p>
          <CategoryDonut data={byCategory} total={totals.expense} />
        </article>
      </section>

      {/* Transactions */}
      <section aria-labelledby="tx-heading" className="space-y-4">
        <h2 id="tx-heading" className="text-xl font-bold tracking-tight">
          Transactions
        </h2>
        <FilterBar filters={filters} onChange={setFilters} resultCount={filtered.length} />

        <div className="card overflow-hidden">
          {loading ? (
            <div className="space-y-3 p-4" role="status" aria-label="Loading transactions">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            transactions.length === 0 ? (
              <EmptyState
                icon="wallet"
                title="No transactions yet"
                message="Add your first transaction to start tracking, or load the demo data."
                action={
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleResetDemo} loading={busy} disabled={busy}>
                      Load demo data
                    </Button>
                    <Button icon="plus" onClick={openAdd}>
                      Add transaction
                    </Button>
                  </div>
                }
              />
            ) : (
              <EmptyState
                title="Nothing matches your filters"
                message="Try a different search term or clear the filters."
                action={
                  <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Clear filters
                  </Button>
                }
              />
            )
          ) : (
            <>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.slice(0, visible).map((t) => (
                  <TransactionItem key={t.id} transaction={t} onEdit={setEditing} onDelete={setDeleting} />
                ))}
              </ul>
              {visible < filtered.length && (
                <div className="border-t border-slate-100 p-3 text-center dark:border-slate-800">
                  <Button variant="ghost" onClick={showMore}>
                    Show more ({filtered.length - visible} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Add modal */}
      <Modal open={isAdding} onClose={closeAdd} title="Add transaction" description="Record a new income or expense.">
        <TransactionForm onSubmit={handleAdd} onCancel={closeAdd} submitLabel="Add transaction" />
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && (
          <TransactionForm
            key={editing.id}
            initialValues={{ ...editing, amount: String(editing.amount) }}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete transaction?" size="sm">
        {deleting && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>{deleting.title}</strong> ({formatCurrency(deleting.amount)}) will be permanently removed. This
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" icon="trash" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

/** Greeting for a signed-in SpendWise account (data from the Week 3 API). */
function AccountHeader({ user }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
      >
        {initials}
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {user.name.split(' ')[0]}!
        </h1>
        <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Icon name="cloud" size={14} className="text-brand-500" />
          Synced with SpendWise API · {user.email}
        </p>
      </div>
    </div>
  )
}

/** Greeting + avatar fetched from the public DummyJSON API (guest mode). */
function ProfileHeader({ profile }) {
  const { data, loading, error, refetch } = profile
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800">
          <Icon name="alert" size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}!</h1>
          <p className="text-sm text-slate-500">
            Couldn't load profile.{' '}
            <button
              type="button"
              onClick={refetch}
              className="font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Retry
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {data.image ? (
        <img
          src={data.image}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-full bg-slate-100 object-cover ring-2 ring-white dark:bg-slate-800 dark:ring-slate-900"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
        >
          {data.firstName?.[0]}
          {data.lastName?.[0]}
        </span>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {data.firstName}!
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data.company?.title} · {data.email}
        </p>
      </div>
    </div>
  )
}
