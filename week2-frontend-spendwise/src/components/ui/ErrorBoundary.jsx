/**
 * ErrorBoundary – catches render errors anywhere below it and shows a
 * recoverable fallback instead of a blank white screen.
 * (Error boundaries must be class components – React has no hook for this.)
 */

import { Component } from 'react'
import Button from './Button'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          An unexpected error occurred. Your data is safe — try reloading the app.
        </p>
        <pre className="mt-4 max-w-full overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-rose-700 dark:bg-slate-800 dark:text-rose-300">
          {String(this.state.error?.message ?? this.state.error)}
        </pre>
        <Button className="mt-6" onClick={this.handleReset} icon="refresh">
          Reload SpendWise
        </Button>
      </div>
    )
  }
}
