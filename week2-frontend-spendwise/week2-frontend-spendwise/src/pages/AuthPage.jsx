/**
 * AuthPage – "/login" and "/register"
 * Sign in to / create an account on the SpendWise REST API (Week 3 back-end).
 * Field-level errors come straight from the API's 422 `details` array.
 */

import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTransactions } from '../context/TransactionsContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export const DEMO_CREDENTIALS = {
  email: 'demo@spendwise.app',
  password: 'Demo1234',
}

const MODES = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to sync your transactions across devices.',
    submit: 'Sign in',
    switchText: "Don't have an account?",
    switchLabel: 'Create one',
    switchTo: '/register',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Free, takes ten seconds. Your data is stored securely on the SpendWise API.',
    submit: 'Create account',
    switchText: 'Already registered?',
    switchLabel: 'Sign in',
    switchTo: '/login',
  },
}

/** Client-side checks mirror the API's Zod rules so most mistakes are caught instantly. */
export function validateAuth(values, mode) {
  const errors = {}
  if (mode === 'register' && values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (mode === 'register') {
    if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password))
      errors.password = 'Use at least one letter and one number.'
  } else if (!values.password) {
    errors.password = 'Enter your password.'
  }
  return errors
}

export default function AuthPage({ mode = 'login' }) {
  const copy = MODES[mode]
  useDocumentTitle(copy.submit)
  const { isAuthenticated, login, register } = useAuth()
  const { countImportable } = useTransactions()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (isAuthenticated) return <Navigate to={location.state?.from ?? '/dashboard'} replace />

  const importable = countImportable()

  const handleChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }))
  }

  const submit = async (creds) => {
    setSubmitting(true)
    setFormError(null)
    try {
      const user = mode === 'register' ? await register(creds) : await login(creds.email, creds.password)
      toast.success(mode === 'register' ? `Account created. Welcome, ${user.name}!` : `Welcome back, ${user.name}!`)
      navigate(location.state?.from ?? '/dashboard', { replace: true })
    } catch (err) {
      if (err.details?.length) setErrors(err.fieldErrors)
      else setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validateAuth(values, mode)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    submit({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    })
  }

  const useDemo = () => {
    setValues((v) => ({ ...v, ...DEMO_CREDENTIALS }))
    submit(DEMO_CREDENTIALS)
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20 animate-fade-in">
      {/* Left: pitch */}
      <div className="hidden lg:block">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Icon name="shield" size={14} />
          Secured with JWT · bcrypt
        </span>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Your money, on every device.</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          SpendWise now runs on a real back-end. Sign in and your transactions are stored on the SpendWise REST API
          instead of just this browser.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
          {[
            'Cloud-synced income & expenses',
            'Server-side statistics for the dashboard',
            'Import what you already added as a guest',
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: form */}
      <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>

        {importable > 0 && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
            You have <strong>{importable}</strong> transaction
            {importable === 1 ? '' : 's'} saved in this browser. After signing in you can import them into your account.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {mode === 'register' && (
            <Field id="auth-name" label="Name" error={errors.name}>
              <input
                id="auth-name"
                name="name"
                type="text"
                autoComplete="name"
                value={values.name}
                onChange={handleChange}
                className="input"
                placeholder="Badal"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'auth-name-error' : undefined}
              />
            </Field>
          )}

          <Field id="auth-email" label="Email" error={errors.email}>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              className="input"
              placeholder="you@example.com"
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'auth-email-error' : undefined}
            />
          </Field>

          <Field
            id="auth-password"
            label="Password"
            error={errors.password}
            hint={mode === 'register' ? 'At least 8 characters with a letter and a number.' : undefined}
          >
            <div className="relative">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={values.password}
                onChange={handleChange}
                className="input pr-20"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : undefined}
                aria-describedby={errors.password ? 'auth-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>

          {formError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
            >
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" loading={submitting} icon={submitting ? undefined : 'check'}>
            {copy.submit}
          </Button>
        </form>

        {mode === 'login' && (
          <Button variant="outline" className="mt-3 w-full" onClick={useDemo} disabled={submitting}>
            Try the demo account
          </Button>
        )}

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            {copy.switchLabel}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Prefer not to sign up?{' '}
          <Link to="/dashboard" className="underline hover:text-slate-600 dark:hover:text-slate-200">
            Continue as guest
          </Link>{' '}
          – data stays in this browser.
        </p>
      </div>
    </div>
  )
}

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  )
}
