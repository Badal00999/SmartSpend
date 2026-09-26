/**
 * Component tests for TransactionForm – simulates real user interaction with
 * Testing Library's user-event.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionForm, { validateTransaction, EMPTY_FORM } from '../components/transactions/TransactionForm'

describe('validateTransaction', () => {
  it('flags missing title and amount', () => {
    const errors = validateTransaction({ ...EMPTY_FORM })
    expect(errors.title).toBeDefined()
    expect(errors.amount).toBeDefined()
  })

  it('rejects non-positive amounts', () => {
    expect(validateTransaction({ ...EMPTY_FORM, title: 'x', amount: '0' }).amount).toMatch(/greater than zero/)
  })

  it('rejects future dates', () => {
    expect(validateTransaction({ ...EMPTY_FORM, title: 'x', amount: '5', date: '2999-01-01' }).date).toMatch(/future/)
  })

  it('passes a valid transaction', () => {
    expect(validateTransaction({ ...EMPTY_FORM, title: 'Coffee', amount: '120' })).toEqual({})
  })
})

describe('<TransactionForm />', () => {
  it('shows accessible error messages and does not submit when invalid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TransactionForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining(['Please enter a title.', 'Please enter an amount.']),
    )
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits normalised values when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TransactionForm onSubmit={onSubmit} submitLabel="Add" />)

    await user.type(screen.getByLabelText('Title'), '  Coffee  ')
    await user.type(screen.getByLabelText(/amount/i), '150')
    await user.selectOptions(screen.getByLabelText('Category'), 'food')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Coffee', amount: 150, type: 'expense', category: 'food' })
  })

  it('switches category list when type changes to income', async () => {
    const user = userEvent.setup()
    render(<TransactionForm onSubmit={() => {}} />)

    await user.click(screen.getByRole('radio', { name: 'Income' }))

    const options = [...screen.getByLabelText('Category').options].map((o) => o.value)
    expect(options).toEqual(['salary', 'freelance', 'other'])
  })

  it('keeps focus in the title input while typing (no remount bug)', async () => {
    const user = userEvent.setup()
    render(<TransactionForm onSubmit={() => {}} />)
    const title = screen.getByLabelText('Title')
    await user.click(title)
    await user.keyboard('Hello world')
    expect(title).toHaveFocus()
    expect(title).toHaveValue('Hello world')
  })
})
