/**
 * DashboardPage – "/dashboard" (Week 4 revision)
 * ----------------------------------------------
 * Everything on this page now comes from the back-end when the user is signed
 * in, and from localStorage when they are not:
 *
 *   stat cards + both charts → useDashboardStats()  → /stats/summary|by-category|monthly
 *   transaction list         → useServerTransactions() → /transactions?page&limit&q&type&category&sort
 *   live updates             → useTransactions().liveStatus (SSE) + SyncBadge
 *
 * The filter state lives in the URL (`?q=&type=&category=&sort=&page=`), so a
 * filtered view can be refreshed, bookmarked or shared – and the same query
 * string is exactly what is sent to the API.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTransactions } from '../context/TransactionsContext'
import { useOptionalAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDebounce } from '../hooks/useDebounce'
import { useFetch } from '../hooks/useFetch'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useServerTransactions } from '../hooks/useServerTransactions'
import { fetchUserProfile } from '../services/userApi'
import { formatCurrency } from '../utils/format'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import Icon from '../components/ui/Icon'
import FilterBar, { DEFAULT_FILTERS } from '../components/transactions/FilterBar'
import Pagination from '../components/transactions/Pagination'
import TransactionItem from '../components/transactions/TransactionItem'
import TransactionForm from '../components/transactions/TransactionForm'
import CategoryDonut from '../components/charts/CategoryDonut'
import TrendBars from '../components/charts/TrendBars'
import SyncBadge from '../components/feedback/SyncBadge'
import ConnectionBanner from '../components/feedback/ConnectionBanner'

const PAGE_SIZE = 8

/** Read the list query from the URL so the server and the browser agree. */
function readFilters(searchParams) {
  return {
    query: searchParams.get('q') ?? DEFAULT_FILTERS.query,
    type: searchParams.get('type') ?? DEFAULT_FILTERS.type,
    category: searchParams.get('category') ?? DEFAULT_FILTERS.category,
    sort: searchParams.get('sort') ?? DEFAULT_FILTERS.sort,
  }
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const {
    addTransaction,
    updateTransaction,
    deleteTransaction,
    resetToDemo,
    importLocal,
    countImportable,
    source,
    error,
    reload,
    liveStatus,
    lastSyncedAt,
    syncNow,
  } = useTransactions()
  const auth = useOptionalAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const importable = source === 'api' ? countImportable() : 0

  const filters = readFilters(searchParams)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const debouncedQuery = useDebounce(filters.query, 300)
  const activeFilters = { ...filters, query: debouncedQuery }

  // ---- Server-side data ------------------------------------------------
  const stats = useDashboardStats()
  const list = useServerTransactions({ filters: activeFilters, page, limit: PAGE_SIZE })
  const items = list.items
  const totals = stats.summary ?? { income: 0, expense: 0, balance: 0, thisMonth: { income: 0, expense: 0 } }
  const byCategory = stats.byCategory ?? []
  const trend = stats.monthly ?? []

  // ---- UI state ---------------------------------------------------------
  const [editing, setEditing] = useState(null) // transaction being edited
  const [deleting, setDeleting] = useState(null) // transaction pending delete
  const isAdding = searchParams.get('new') === '1'

  /** Merge new filter values into the URL and reset to page 1. */
  const setFilters = (next) => {
    const params = new URLSearchParams(searchParams)
    const mapping = { query: 'q', type: 'type', category: 'category', sort: 'sort' }
    for (const [key, param] of Object.entries(mapping)) {
      const value = next[key]
      if (!value || value === DEFAULT_FILTERS[key]) params.delete(param)
      else params.set(param, value)
    }
    params.delete('page')
    params.delete('new')
    setSearchParams(params, { replace: true })
  }

  const setPage = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
  }

  // ---- Profile: real account when signed in, DummyJSON demo profile as guest
  const isSignedIn = Boolean(auth?.isAuthenticated)
  const profile = useFetch((signal) => (isSignedIn ? Promise.resolve(null) : fetchUserProfile(1, signal)), [isSignedIn])

  // ---- Handlers (work for both the local store and the REST API) ----------
  const openAdd = () => setSearchParams({ ...Object.fromEntries(searchParams), new: '1' })
  const closeAdd = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('new')
    setSearchParams(params)
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {isSignedIn && <SyncBadge status={liveStatus} lastSyncedAt={lastSyncedAt} onRefresh={syncNow} />}
          <Button variant="secondary" icon="refresh" onClick={handleResetDemo} loading={busy} disabled={busy}>
            <span className="hidden sm:inline">{source === 'api' ? 'Add demo data' : 'Reset demo'}</span>
            <span className="sm:hidden">Demo</span>
          </Button>
          <Button icon="plus" onClick={openAdd}>
            Add transaction
          </Button>
        </div>
      </div>

      {/* Connection problems (offline / back-end down) */}
      <ConnectionBanner />

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

      {/* Stat cards – computed by MongoDB aggregations when signed in */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              highlight
              label="Total balance"
              value={formatCurrency(totals.balance, totals.currency)}
              icon="wallet"
              hint={stats.isApi ? 'Calculated by the API' : 'All time'}
            />
            <StatCard
              label="Total income"
              value={formatCurrency(totals.income, totals.currency)}
              icon="arrowDown"
              tone="emerald"
              hint={stats.isApi ? 'GET /stats/summary' : 'All time'}
            />
            <StatCard
              label="Total expenses"
              value={formatCurrency(totals.expense, totals.currency)}
              icon="arrowUp"
              tone="rose"
              hint={stats.isApi ? 'GET /stats/summary' : 'All time'}
            />
            <StatCard
              label="This month"
              value={formatCurrency(totals.thisMonth?.expense ?? 0, totals.currency)}
              icon="calendar"
              tone="slate"
              hint={`Spent · ${formatCurrency(totals.thisMonth?.income ?? 0, totals.currency, { maximumFractionDigits: 0 })} earned`}
            />
          </>
        )}
      </section>

      {stats.error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Statistics could not be loaded from the API ({stats.error}). Showing the last known values.
        </p>
      )}

      {/* Charts */}
      <section aria-label="Charts" className="grid gap-6 lg:grid-cols-5">
        <article className="card p-5 lg:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Income vs expenses</h2>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Last 6 months{stats.isApi && ' · /stats/monthly'}
              </p>
            </div>
          </div>
          {stats.loading ? <Skeleton className="h-64" /> : <TrendBars data={trend} />}
        </article>
        <article className="card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">Spending by category</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            All time{stats.isApi && ' · /stats/by-category'}
          </p>
          {stats.loading ? <Skeleton className="h-64" /> : <CategoryDonut data={byCategory} total={totals.expense} />}
        </article>
      </section>

      {/* Transactions */}
      <section aria-labelledby="tx-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="tx-heading" className="text-xl font-bold tracking-tight">
            Transactions
          </h2>
          {list.isApi && (
            <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
              GET /transactions · page {page}
            </span>
          )}
        </div>

        <FilterBar filters={filters} onChange={setFilters} resultCount={list.meta?.total ?? items.length} />

        {list.error ? (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <Icon name="alert" size={26} className="text-rose-500" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{list.error}</p>
            <Button size="sm" variant="secondary" icon="refresh" onClick={list.refetch}>
              Try again
            </Button>
          </div>
        ) : list.loading ? (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={source === 'api' ? 'cloud' : 'search'}
              title={list.meta?.total === 0 ? 'No transactions yet' : 'Nothing matches these filters'}
              message={
                list.meta?.total === 0
                  ? 'Add your first transaction – it will be stored in MongoDB through the API.'
                  : 'Try clearing the search box or picking a different category.'
              }
              action={
                <Button icon="plus" onClick={openAdd}>
                  Add transaction
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
              {items.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} onEdit={setEditing} onDelete={setDeleting} />
              ))}
            </ul>
            <Pagination meta={list.meta} onPageChange={setPage} className="px-1" />
          </>
        )}
      </section>

      {/* Add / edit modal */}
      <Modal open={isAdding} onClose={closeAdd} title="Add transaction" size="lg">
        <TransactionForm onSubmit={handleAdd} onCancel={closeAdd} submitLabel="Add transaction" />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit transaction" size="lg">
        {editing && (
          <TransactionForm
            initialValues={editing}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete transaction">
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
