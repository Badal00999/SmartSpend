/**
 * AuthContext
 * -----------
 * Holds the signed-in user for the SpendWise REST API (Week 3 back-end).
 *
 *   status: 'loading'        a saved token is being verified via GET /auth/me
 *           'authenticated'  user object available, requests carry the JWT
 *           'guest'          no account – the app works offline with localStorage
 *
 * Guest mode keeps every Week 2 feature working without a server; signing in
 * switches the TransactionsProvider to the API as its data source.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({
    user: null,
    status: getToken() ? 'loading' : 'guest',
  }))

  // Verify a persisted token once on start-up.
  useEffect(() => {
    if (state.status !== 'loading') return
    const controller = new AbortController()
    api
      .get('/auth/me', { signal: controller.signal })
      .then((res) => setState({ user: res.data.user, status: 'authenticated' }))
      .catch((err) => {
        if (controller.signal.aborted) return
        if (err.status === 401) clearToken() // expired / invalid token
        setState({ user: null, status: 'guest' })
      })
    return () => controller.abort()
  }, [state.status])

  // If any request comes back 401 mid-session (token expired), sign out.
  useEffect(() => {
    const onUnauthorized = () => {
      clearToken()
      setState({ user: null, status: 'guest' })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const finishSignIn = useCallback((data) => {
    setToken(data.token)
    setState({ user: data.user, status: 'authenticated' })
    return data.user
  }, [])

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password }, { auth: false })
      return finishSignIn(res.data)
    },
    [finishSignIn],
  )

  const register = useCallback(
    async ({ name, email, password }) => {
      const res = await api.post('/auth/register', { name, email, password }, { auth: false })
      return finishSignIn(res.data)
    },
    [finishSignIn],
  )

  const logout = useCallback(() => {
    clearToken()
    setState({ user: null, status: 'guest' })
  }, [])

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      isAuthenticated: state.status === 'authenticated',
      login,
      register,
      logout,
    }),
    [state, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Strict hook – throws when used outside the provider. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Lenient hook – returns null outside the provider (lets components/tests run without auth). */
export function useOptionalAuth() {
  return useContext(AuthContext)
}
