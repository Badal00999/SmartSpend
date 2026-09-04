/**
 * DashboardPage – "/dashboard"
 * Overview cards, charts, user profile (remote API) and the filterable
 * transaction list with add / edit / delete flows.
 *
 * URL state: `?new=1` opens the "add transaction" modal so that the navbar
 * and landing page can deep-link into the flow.
 */

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransactions } from '../context/TransactionsContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDebounce } from '../hooks/useDebounce'
import { useFetch } from '../hooks/useFetch'
import { fetchUserProfile } from '../services/userApi'
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
  const { transactions, addTransaction, updateTransaction, deleteTransaction, resetToDemo } = useTransactions()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // ---- Remote user profile (public API) -----------------------------------
  const profile = useFetch((signal) => fetchUserProfile(1, signal), [])

  // ---- Handlers -----------------------------------------------------------
  const openAdd = () => setSearchParams({ new: '1' })
  const closeAdd = () => setSearchParams({})

  const handleAdd = (values) => {
    addTransaction(values)
    closeAdd()
    toast.success('Transaction added')
  }

  const handleEdit = (values) => {
    updateTransaction(editing.id, values)
    setEditing(null)
    toast.success('Transaction updated')
  }

  const confirmDelete = () => {
    deleteTransaction(deleting.id)
    setDeleting(null)
    toast.info('Transaction deleted')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ProfileHeader profile={profile} />
        <div className="flex gap-2">
          <Button variant="secondary" icon="refresh" onClick={() => { resetToDemo(); toast.info('Demo data restored') }}>
            <span className="hidden sm:inline">Reset demo</span>
            <span className="sm:hidden">Reset</span>
          </Button>
          <Button icon="plus" onClick={openAdd}>
            Add transaction
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard highlight label="Total balance" value={formatCurrency(totals.balance)} icon="wallet" hint="All time" />
        <StatCard label="Total income" value={formatCurrency(totals.income)} icon="arrowDown" tone="emerald" hint="All time" />
        <StatCard label="Total expenses" value={formatCurrency(totals.expense)} icon="arrowUp" tone="rose" hint="All time" />
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
          {filtered.length === 0 ? (
            transactions.length === 0 ? (
              <EmptyState
                icon="wallet"
                title="No transactions yet"
                message="Add your first transaction to start tracking, or restore the demo data."
                action={
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={resetToDemo}>
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

/** Greeting + avatar fetched from the public DummyJSON API. */
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
            <button type="button" onClick={refetch} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
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
