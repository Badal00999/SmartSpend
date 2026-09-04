/**
 * NotFoundPage – catch-all route ("*").
 */

import { useDocumentTitle } from '../hooks/useDocumentTitle'
import Button from '../components/ui/Button'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-7xl font-black tracking-tight text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        The page you're looking for doesn't exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button to="/" variant="secondary" icon="home">
          Home
        </Button>
        <Button to="/dashboard" icon="dashboard">
          Dashboard
        </Button>
      </div>
    </div>
  )
}
