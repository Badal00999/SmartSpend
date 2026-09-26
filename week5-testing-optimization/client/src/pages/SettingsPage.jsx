/**
 * SettingsPage – "/settings"
 * --------------------------
 * New in Week 4. This page exists to prove the *two-way* integration: every
 * control here talks to an endpoint that the Week 3 UI never used.
 *
 *   Profile card   → PATCH /auth/me            (name, currency)
 *   Security card  → PATCH /auth/password      (current + new password)
 *   Data card      → GET /transactions + /stats/summary (export as JSON)
 *   Danger zone    → DELETE /transactions      (wipe the account history)
 *   Connection     → GET /events/status        (live stream diagnostics)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTransactions } from '../context/TransactionsContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { api } from '../services/api'
import { fetchSummary } from '../services/statsApi'
import { formatCurrency } from '../utils/format'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import SyncBadge from '../components/feedback/SyncBadge'

const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'AED', label: 'UAE Dirham (د.إ)' },
]

export default function SettingsPage() {
  useDocumentTitle('Settings')
  const { user, logout, updateUser } = useAuth()
  const { transactions, clearAll, source, liveStatus, lastSyncedAt, syncNow, version } = useTransactions()
  const toast = useToast()
  const navigate = useNavigate()

  // `null` means "untouched": the inputs then show the values that came from the
  // API, and a refresh of the user object is reflected without an effect.
  const [editedProfile, setEditedProfile] = useState(null)
  const profile = editedProfile ?? { name: user?.name ?? '', currency: user?.currency ?? 'INR' }
  const setProfile = setEditedProfile
  const [errors, setErrors] = useState({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [summary, setSummary] = useState(null)
  const [connection, setConnection] = useState(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wiping, setWiping] = useState(false)

  useEffect(() => {
    if (source !== 'api') return undefined
    const controller = new AbortController()
    fetchSummary({ signal: controller.signal })
      .then(setSummary)
      .catch(() => setSummary(null))
    api
      .get('/events/status', { signal: controller.signal })
      .then((res) => setConnection(res.data))
      .catch(() => setConnection(null))
    return () => controller.abort()
  }, [source, version])

  const saveProfile = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (profile.name.trim().length < 2) nextErrors.name = 'Please enter at least 2 characters'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSavingProfile(true)
    try {
      const res = await api.patch('/auth/me', { name: profile.name.trim(), currency: profile.currency })
      updateUser(res.data.user) // keep the navbar / header in step without a reload
      setEditedProfile(null)
      toast.success(`Profile saved – you are now ${res.data.user.name}`)
    } catch (err) {
      setErrors(err.fieldErrors ?? {})
      toast.error(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setSavingPassword(true)
    try {
      await api.patch('/auth/password', passwords)
      setPasswords({ currentPassword: '', newPassword: '' })
      toast.success('Password updated. Use it the next time you sign in.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const exportData = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { name: user?.name, email: user?.email, currency: user?.currency },
      statistics: summary,
      transactions,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `spendwise-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${transactions.length} transactions`)
  }

  const wipe = async () => {
    setWiping(true)
    try {
      const deleted = await clearAll()
      setConfirmWipe(false)
      toast.success(`Deleted ${deleted ?? 0} transactions`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {source === 'api'
              ? 'These forms call the SpendWise REST API – refresh the API and the values come back from MongoDB.'
              : 'Sign in to edit your account, change your password and manage server-side data.'}
          </p>
        </div>
        {source === 'api' && <SyncBadge status={liveStatus} lastSyncedAt={lastSyncedAt} onRefresh={syncNow} />}
      </header>

      {/* Account overview -------------------------------------------------- */}
      <section className="card p-5" aria-labelledby="account-heading">
        <h2 id="account-heading" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="user" size={18} className="text-brand-600 dark:text-brand-400" />
          Account
        </h2>
        {source === 'api' && summary ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Transactions" value={summary.transactionCount} />
            <Stat label="Balance" value={formatCurrency(summary.balance, summary.currency)} />
            <Stat label="Expenses (all time)" value={formatCurrency(summary.expense, summary.currency)} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Guest mode – {transactions.length} transactions live in this browser only.
          </p>
        )}
        {source === 'api' && connection && (
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="bolt" size={13} className="text-emerald-500" />
            Realtime stream: {connection.thisUser} open connection{connection.thisUser === 1 ? '' : 's'} for this
            account
            {connection.totalClients > connection.thisUser && ` (${connection.totalClients} across all accounts)`}
          </p>
        )}
      </section>

      {/* Profile ----------------------------------------------------------- */}
      <form onSubmit={saveProfile} className="card space-y-4 p-5" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="edit" size={18} className="text-brand-600 dark:text-brand-400" />
          Profile
          <span className="ml-auto text-xs font-normal text-slate-400">PATCH /auth/me</span>
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="settings-name">
              Display name
            </label>
            <input
              id="settings-name"
              className="input"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              disabled={source !== 'api'}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="settings-currency">
              Display currency
            </label>
            <select
              id="settings-currency"
              className="input"
              value={profile.currency}
              onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
              disabled={source !== 'api'}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as {user?.email}</p>
          <Button type="submit" icon="check" loading={savingProfile} disabled={source !== 'api' || savingProfile}>
            Save profile
          </Button>
        </div>
      </form>

      {/* Password ---------------------------------------------------------- */}
      <form onSubmit={savePassword} className="card space-y-4 p-5" aria-labelledby="password-heading">
        <h2 id="password-heading" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="lock" size={18} className="text-brand-600 dark:text-brand-400" />
          Password
          <span className="ml-auto text-xs font-normal text-slate-400">PATCH /auth/password</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="current-password">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              disabled={source !== 'api'}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="input"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              disabled={source !== 'api'}
              placeholder="8+ characters, letter and number"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            icon="shield"
            loading={savingPassword}
            disabled={source !== 'api' || savingPassword || !passwords.currentPassword || !passwords.newPassword}
          >
            Change password
          </Button>
        </div>
      </form>

      {/* Data -------------------------------------------------------------- */}
      <section className="card space-y-4 p-5" aria-labelledby="data-heading">
        <h2 id="data-heading" className="flex items-center gap-2 text-base font-semibold">
          <Icon name="database" size={18} className="text-brand-600 dark:text-brand-400" />
          Your data
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon="download" onClick={exportData} disabled={transactions.length === 0}>
            Export as JSON
          </Button>
          <Button variant="secondary" icon="swap" onClick={() => navigate('/dashboard?new=1')}>
            Add a transaction
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {transactions.length} transaction{transactions.length === 1 ? '' : 's'} loaded from{' '}
            {source === 'api' ? 'the API' : 'this browser'}
          </span>
        </div>
      </section>

      {/* Danger zone ------------------------------------------------------- */}
      <section className="card space-y-4 border-rose-200 p-5 dark:border-rose-900/60" aria-labelledby="danger-heading">
        <h2
          id="danger-heading"
          className="flex items-center gap-2 text-base font-semibold text-rose-700 dark:text-rose-300"
        >
          <Icon name="alert" size={18} />
          Danger zone
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Deletes every transaction of this account with a single{' '}
          <code className="font-mono text-xs">DELETE /transactions</code> request. The realtime stream notifies your
          other tabs immediately.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            icon="trash"
            onClick={() => setConfirmWipe(true)}
            disabled={transactions.length === 0}
          >
            Delete all transactions
          </Button>
          <Button
            variant="ghost"
            icon="back"
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            Sign out
          </Button>
        </div>
      </section>

      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)} title="Delete all transactions?">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This removes all <strong>{transactions.length}</strong> transactions from{' '}
          {source === 'api' ? 'the database' : 'this browser'} and cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmWipe(false)}>
            Cancel
          </Button>
          <Button variant="danger" icon="trash" onClick={wipe} loading={wiping} disabled={wiping}>
            Yes, delete everything
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  )
}
