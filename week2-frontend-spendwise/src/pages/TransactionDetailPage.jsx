/**
 * TransactionDetailPage – "/transactions/:id"
 * Shows everything about one transaction, its share of category spend,
 * related transactions, and edit / delete actions.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTransactions } from '../context/TransactionsContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getCategory, getPaymentMethod } from '../utils/categories'
import { formatCurrency, formatDate, relativeDays } from '../utils/format'
import { computeTotals, percentOf } from '../utils/stats'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'
import EmptyState from '../components/ui/EmptyState'
import { CategoryBadge, TypeBadge } from '../components/ui/Badge'
import TransactionForm from '../components/transactions/TransactionForm'

export default function TransactionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { transactions, getById, updateTransaction, deleteTransaction } = useTransactions()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const tx = getById(id)
  useDocumentTitle(tx ? tx.title : 'Not found')

  // Stats for the "insights" panel – computed even when tx is undefined so
  // hook order stays stable across renders.
  const insights = useMemo(() => {
    if (!tx) return null
    const totals = computeTotals(transactions)
    const sameCategory = transactions.filter((t) => t.category === tx.category && t.type === tx.type)
    const categoryTotal = sameCategory.reduce((s, t) => s + Number(t.amount), 0)
    const related = sameCategory.filter((t) => t.id !== tx.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
    const denominator = tx.type === 'income' ? totals.income : totals.expense
    return {
      shareOfTotal: percentOf(tx.amount, denominator),
      shareOfCategory: percentOf(tx.amount, categoryTotal),
      categoryTotal,
      categoryCount: sameCategory.length,
      related,
    }
  }, [tx, transactions])

  if (!tx) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="alert"
          title="Transaction not found"
          message="It may have been deleted, or the link is incorrect."
          action={
            <Button to="/dashboard" icon="back">
              Back to dashboard
            </Button>
          }
        />
      </div>
    )
  }

  const cat = getCategory(tx.category)
  const isIncome = tx.type === 'income'

  const handleEdit = (values) => {
    updateTransaction(tx.id, values)
    setEditing(false)
    toast.success('Transaction updated')
  }

  const handleDelete = () => {
    deleteTransaction(tx.id)
    toast.info('Transaction deleted')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <li>
            <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/dashboard" className="hover:text-brand-600 dark:hover:text-brand-400">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate font-medium text-slate-800 dark:text-slate-200">
            {tx.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main card */}
        <article className="card overflow-hidden lg:col-span-2">
          <div className="h-2" style={{ backgroundColor: cat.color }} aria-hidden="true" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}
                  aria-hidden="true"
                >
                  <Icon name={cat.icon} size={28} />
                </span>
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <TypeBadge type={tx.type} />
                    <CategoryBadge categoryId={tx.category} />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tx.title}</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <time dateTime={tx.date}>{formatDate(tx.date, 'long')}</time> · {relativeDays(tx.date)}
                  </p>
                </div>
              </div>
              <p
                className={`shrink-0 text-3xl font-extrabold tracking-tight whitespace-nowrap tabular-nums sm:text-4xl ${
                  isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {isIncome ? '+' : '−'}
                {formatCurrency(tx.amount)}
              </p>
            </div>

            <dl className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 dark:border-slate-800">
              <DetailRow icon="card" label="Payment method" value={getPaymentMethod(tx.payment).label} />
              <DetailRow icon="calendar" label="Date" value={formatDate(tx.date)} />
              <DetailRow icon="tag" label="Category" value={cat.label} />
              <DetailRow icon="info" label="Transaction ID" value={<code className="text-xs">{tx.id}</code>} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Notes</dt>
                <dd className="mt-1 text-sm whitespace-pre-line">
                  {tx.notes ? tx.notes : <span className="text-slate-400 italic">No notes added</span>}
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col-reverse gap-2 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between dark:border-slate-800">
              <Button variant="ghost" icon="back" onClick={() => navigate(-1)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button variant="danger" icon="trash" onClick={() => setConfirmingDelete(true)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </article>

        {/* Sidebar insights */}
        <aside className="space-y-6" aria-label="Insights">
          <section className="card p-5">
            <h2 className="font-semibold">Insights</h2>
            <div className="mt-4 space-y-4">
              <Meter
                label={`Share of all ${isIncome ? 'income' : 'expenses'}`}
                percent={insights.shareOfTotal}
                color={cat.color}
              />
              <Meter label={`Share of ${cat.label}`} percent={insights.shareOfCategory} color={cat.color} />
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {insights.categoryCount} {cat.label} {isIncome ? 'entries' : 'expenses'} totalling{' '}
              <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(insights.categoryTotal)}</strong>
            </p>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">More in {cat.label}</h2>
            {insights.related.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No other transactions in this category.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {insights.related.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/transactions/${r.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.title}</span>
                        <span className="text-xs text-slate-500">{formatDate(r.date)}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/dashboard"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              View all transactions
              <Icon name="back" size={14} className="rotate-180" />
            </Link>
          </section>
        </aside>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit transaction">
        {editing && (
          <TransactionForm
            initialValues={{ ...tx, amount: String(tx.amount) }}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <Modal open={confirmingDelete} onClose={() => setConfirmingDelete(false)} title="Delete transaction?" size="sm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{tx.title}</strong> ({formatCurrency(tx.amount)}) will be permanently removed.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" icon="trash" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

/** Accessible progress meter using the native <meter>-like ARIA pattern. */
function Meter({ label, percent, color }) {
  const safe = Math.min(100, Math.max(0, percent))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{safe}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${safe}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
