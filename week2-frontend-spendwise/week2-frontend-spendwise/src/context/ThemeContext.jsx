/**
 * ThemeContext – light / dark mode toggle.
 * Persists the preference and falls back to the OS setting on first visit.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadSettings, saveSettings } from '../services/storage'

const ThemeContext = createContext(null)

function getInitialTheme() {
  const saved = loadSettings().theme
  if (saved === 'light' || saved === 'dark') return saved
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  // Apply the class on <html> so Tailwind's `dark:` variant works everywhere
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    saveSettings({ ...loadSettings(), theme })
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo(() => ({ theme, toggleTheme, isDark: theme === 'dark' }), [theme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
