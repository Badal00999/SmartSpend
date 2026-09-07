/**
 * Integration tests – render the whole app and navigate between pages the way
 * a user would (clicking links), asserting each view appears.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
  // Stub remote APIs so tests are fast and deterministic
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (String(url).includes('dummyjson')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 1,
              firstName: 'Asha',
              lastName: 'K',
              email: 'asha@example.com',
              image: 'https://example.com/avatar.png',
              company: { title: 'Engineer' },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ base: 'INR', date: '2026-09-04', rates: { USD: 0.012, EUR: 0.011 } }),
      })
    }),
  )
})

describe('App navigation', () => {
  it('renders the landing page and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: /know exactly where your/i })).toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'Main' })
    await user.click(within(nav).getByRole('link', { name: /dashboard/i }))

    expect(await screen.findByRole('heading', { name: /transactions/i })).toBeInTheDocument()
    expect(await screen.findByText(/good (morning|afternoon|evening), asha/i)).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page')
  })

  it('opens a transaction detail view from the dashboard list', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    const links = await screen.findAllByRole('link', { name: /grocery run – reliance fresh/i })
    await user.click(links[0])

    expect(await screen.findByRole('heading', { level: 1, name: /grocery run – reliance fresh/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(screen.getByText(/weekly vegetables/i)).toBeInTheDocument()
  })

  it('shows the 404 page for unknown routes', async () => {
    window.history.pushState({}, '', '/does-not-exist')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('renders converted amount from the exchange-rate API', async () => {
    window.history.pushState({}, '', '/convert')
    render(<App />)
    expect(await screen.findByText(/1 INR = 0\.0120 USD/)).toBeInTheDocument()
  })
})
