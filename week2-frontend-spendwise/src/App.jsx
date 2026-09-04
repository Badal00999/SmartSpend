/**
 * App – composes global providers and declares the route table.
 *
 * Provider order (outer → inner):
 *   ErrorBoundary  → catches render crashes
 *   ThemeProvider  → light / dark mode
 *   ToastProvider  → notifications
 *   TransactionsProvider → app data
 *   BrowserRouter  → client-side routing
 *
 * Pages are lazy-loaded so the initial bundle stays small (code-splitting).
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Layout from './components/layout/Layout'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { TransactionsProvider } from './context/TransactionsContext'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TransactionDetailPage = lazy(() => import('./pages/TransactionDetailPage'))
const ConverterPage = lazy(() => import('./pages/ConverterPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading page">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <TransactionsProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<LandingPage />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="transactions/:id" element={<TransactionDetailPage />} />
                    <Route path="convert" element={<ConverterPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TransactionsProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
