/**
 * TransactionForm – controlled form used for both "add" and "edit".
 *
 * Validation runs on submit and on blur of touched fields. Every input is
 * linked to its label + error message (aria-describedby / aria-invalid) so
 * screen-reader users hear the error in context.
 */

import { useId, useState } from 'react'
import {
  CATEGORIES,
  EXPENSE_CATEGORY_IDS,
  INCOME_CATEGORY_IDS,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
} from '../../utils/categories'
import { todayISO } from '../../utils/format'
import Button from '../ui/Button'

export const EMPTY_FORM = {
  title: '',
  amount: '',
  type: 'expense',
  category: 'food',
  payment: 'upi',
  date: todayISO(),
  notes: '',
}

/** Pure validator – exported so it can be unit-tested in isolation. */
export function validateTransaction(values) {
  const errors = {}
  if (!values.title.trim()) errors.title = 'Please enter a title.'
  else if (values.title.trim().length > 60) errors.title = 'Title must be 60 characters or fewer.'

  const amount = Number(values.amount)
  if (values.amount === '' || Number.isNaN(amount)) errors.amount = 'Please enter an amount.'
  else if (amount <= 0) errors.amount = 'Amount must be greater than zero.'
  else if (amount > 10_000_000) errors.amount = 'Amount looks too large.'

  if (!values.date) errors.date = 'Please pick a date.'
  else if (values.date > todayISO()) errors.date = 'Date cannot be in the future.'

  if (!values.category) errors.category = 'Please choose a category.'
  if (values.notes && values.notes.length > 200) errors.notes = 'Notes must be 200 characters or fewer.'
  return errors
}

/**
 * FormField – label + control + error/hint wrapper.
 * Defined at module level (not inside TransactionForm) so React keeps the same
 * component identity between renders and inputs never lose focus.
 */
function FormField({ uid, name, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={`${uid}-${name}`} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${uid}-${name}-error`} role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${uid}-${name}-hint`} className="mt-1 text-xs text-slate-400">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export default function TransactionForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [values, setValues] = useState({ ...EMPTY_FORM, ...initialValues })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const uid = useId()

  const allowedCategories = CATEGORIES.filter((c) =>
    (values.type === 'income' ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS).includes(c.id),
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    let next = { ...values, [name]: value }
    // When the type changes, make sure the category is still valid for it
    if (name === 'type') {
      const allowed = value === 'income' ? INCOME_CATEGORY_IDS : EXPENSE_CATEGORY_IDS
      if (!allowed.includes(next.category)) next = { ...next, category: allowed[0] }
    }
    setValues(next)
    if (touched[name]) setErrors(validateTransaction(next))
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched((t) => ({ ...t, [name]: true }))
    setErrors(validateTransaction(values))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validateTransaction(values)
    setErrors(nextErrors)
    setTouched({ title: true, amount: true, date: true, category: true, notes: true })
    if (Object.keys(nextErrors).length > 0) {
      // Move focus to the first invalid field
      const first = Object.keys(nextErrors)[0]
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ ...values, title: values.title.trim(), amount: Number(values.amount) })
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (name) => (touched[name] && errors[name] ? errors[name] : null)

  const inputProps = (name) => ({
    id: `${uid}-${name}`,
    name,
    value: values[name],
    onChange: handleChange,
    onBlur: handleBlur,
    'aria-invalid': fieldError(name) ? 'true' : undefined,
    'aria-describedby': fieldError(name) ? `${uid}-${name}-error` : undefined,
    className: `input ${fieldError(name) ? 'border-rose-500 focus:border-rose-500' : ''}`,
  })

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Type toggle – radio group styled as segmented control */}
      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {TRANSACTION_TYPES.map((t) => {
            const checked = values.type === t.id
            return (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
                  checked
                    ? t.id === 'income'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t.id}
                  checked={checked}
                  onChange={handleChange}
                  className="sr-only"
                />
                {t.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <FormField uid={uid} error={fieldError('title')} name="title" label="Title">
        <input
          type="text"
          placeholder="e.g. Grocery shopping"
          maxLength={80}
          autoComplete="off"
          {...inputProps('title')}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField uid={uid} error={fieldError('amount')} name="amount" label="Amount (₹)">
          <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" {...inputProps('amount')} />
        </FormField>
        <FormField uid={uid} error={fieldError('date')} name="date" label="Date">
          <input type="date" max={todayISO()} {...inputProps('date')} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField uid={uid} error={fieldError('category')} name="category" label="Category">
          <select {...inputProps('category')}>
            {allowedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField uid={uid} error={fieldError('payment')} name="payment" label="Payment method">
          <select {...inputProps('payment')}>
            {PAYMENT_METHODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField
        uid={uid}
        error={fieldError('notes')}
        name="notes"
        label="Notes (optional)"
        hint={`${values.notes.length}/200`}
      >
        <textarea rows={2} maxLength={200} placeholder="Anything worth remembering…" {...inputProps('notes')} />
      </FormField>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting} icon="check">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
