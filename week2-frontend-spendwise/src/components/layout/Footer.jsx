/**
 * Footer – simple site footer with data-source attribution.
 */

import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8 dark:text-slate-400">
        <p>
          © {new Date().getFullYear()} SpendWise · Built with React, Vite &amp; Tailwind CSS
        </p>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-4">
            <li>
              <Link to="/dashboard" className="hover:text-brand-600 dark:hover:text-brand-400">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/convert" className="hover:text-brand-600 dark:hover:text-brand-400">
                Currency
              </Link>
            </li>
            <li>
              <a
                href="https://frankfurter.dev"
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-brand-600 dark:hover:text-brand-400"
              >
                Rates by Frankfurter
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
