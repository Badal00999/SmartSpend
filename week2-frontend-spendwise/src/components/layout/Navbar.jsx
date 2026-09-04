/**
 * Navbar – sticky top navigation, collapses to a hamburger menu on mobile.
 * Uses NavLink so the active route is highlighted and gets aria-current="page".
 */

import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import Icon from '../ui/Icon'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/convert', label: 'Currency', icon: 'globe' },
]

export function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold tracking-tight ${className}`} aria-label="SpendWise home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
        <svg viewBox="0 0 64 64" width="20" height="20" aria-hidden="true">
          <path d="M18 40 L28 28 L36 35 L48 20" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="20" r="5" fill="#fbbf24" />
        </svg>
      </span>
      <span className="text-lg">
        Spend<span className="text-brand-600 dark:text-brand-400">Wise</span>
      </span>
    </Link>
  )
}

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()

  // The mobile menu remembers which route it was opened on, so navigating to
  // a new route implicitly closes it – no "setState inside useEffect" needed.
  const [openedOn, setOpenedOn] = useState(null)
  const open = openedOn === location.pathname
  const toggleMenu = () => setOpenedOn(open ? null : location.pathname)
  const closeMenu = () => setOpenedOn(null)

  // Close on Escape for keyboard users
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpenedOn(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={linkClass}>
                <Icon name={item.icon} size={16} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={isDark}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={20} />
          </button>

          <Link
            to="/dashboard?new=1"
            className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 sm:inline-flex"
          >
            <Icon name="plus" size={16} strokeWidth={2.4} />
            Add
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950"
      >
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={linkClass} onClick={closeMenu}>
                <Icon name={item.icon} size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <Link
              to="/dashboard?new=1"
              onClick={closeMenu}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Icon name="plus" size={16} strokeWidth={2.4} />
              Add transaction
            </Link>
          </li>
        </ul>
      </div>
    </header>
  )
}
