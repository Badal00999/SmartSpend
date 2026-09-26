import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TransactionForm, { EMPTY_FORM, validateTransaction } from '../components/transactions/TransactionForm'

const valid = { ...EMPTY_FORM, title: 'Leap day meal', amount: '20', date: '2024-02-29' }
describe('W5 front-end calendar parity and form behaviour', () => {
  it.each(['2025-02-29', '2026-04-31', '2026-00-10', 'not-a-date'])('rejects impossible/malformed date %s', date => {
    expect(validateTransaction({ ...valid, date }).date).toBeTruthy()
  })
  it('accepts leap day with no validation errors', () => {
    expect(validateTransaction(valid)).toEqual({})
  })
  it('links the missing-date error to the input and prevents submit', () => {
    const submit = vi.fn()
    render(<TransactionForm initialValues={{ ...valid, date: '' }} onSubmit={submit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const date = screen.getByLabelText('Date')
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(date.getAttribute('aria-describedby'))).toHaveTextContent('Please pick a date')
    expect(date).toHaveFocus()
    expect(submit).not.toHaveBeenCalled()
  })
  it('trims title and sends numeric amount on valid submission', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm initialValues={{ ...valid, title: '  Meal  ' }} onSubmit={submit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Meal', amount: 20, date: '2024-02-29' })))
  })
})
