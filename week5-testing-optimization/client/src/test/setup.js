/**
 * Vitest setup – runs before every test file.
 * Adds jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) and polyfills
 * browser APIs that jsdom doesn't implement.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// jsdom lacks <dialog>.showModal / close – provide simple stand-ins
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// matchMedia is used by ThemeContext
window.matchMedia ??= vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// Recharts' ResponsiveContainer needs ResizeObserver
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom defines scrollTo but logs "Not implemented" – replace it outright
window.scrollTo = vi.fn()
Element.prototype.scrollIntoView ??= vi.fn()
