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
 *
 * Week 4 additions
 *  • `sessionExpired` – a mid-session 401 (expired/invalidated token) is
 *    handled gracefully: the token is dropped, a toast explains what happened
 *    and the auth page can show "your session expired, please sign in again".
 *  • `updateUser()` – keeps the in-memory user in step after PATCH /auth/me.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../services/api'
import { useOptionalToast } from './ToastContext'

const AuthContext = createContext(null)

/**
 * The "your session expired" flag is kept in sessionStorage (per tab) so the
 * explanation survives the reload/navigation that follows an expiry, and is
 * cleared as soon as the user signs in again.
 */
const EXPIRED_KEY = 'spendwise.sessionExpired'

function readExpiredFlag() {
  try {
    return window.sessionStorage.getItem(EXPIRED_KEY) === '1'
  } catch {
    return false
  }
}

function writeExpiredFlag(value) {
  try {
    if (value) window.sessionStorage.setItem(EXPIRED_KEY, '1')
    else window.sessionStorage.removeItem(EXPIRED_KEY)
  } catch {
    /* private mode – the flag simply does not survive a reload */
  }
}

export function AuthProvider({ children }) {
  const toast = useOptionalToast()
  const [state, setState] = useState(() => ({
    user: null,
    status: getToken() ? 'loading' : 'guest',
  }))
  /**
   * True when the token could not be verified because the API was unreachable
   * (network/proxy error) rather than because it was rejected. The session is
   * *kept* in that case, so a retry – or simply a page reload once the server is
   * back – signs the user straight back in instead of losing the session.
   */
  const [backendUnreachable, setBackendUnreachable] = useState(false)
  /** True after the API rejected our token mid-session (not on a fresh visit). */
  const [sessionExpired, setSessionExpiredState] = useState(readExpiredFlag)
  const setSessionExpired = useCallback((value) => {
    writeExpiredFlag(value)
    setSessionExpiredState(value)
  }, [])

  // Verify a persisted token once on start-up.
  useEffect(() => {
    if (state.status !== 'loading') return
    const controller = new AbortController()
    api
      .get('/auth/me', { signal: controller.signal })
      .then((res) => {
        setBackendUnreachable(false)
        setState({ user: res.data.user, status: 'authenticated' })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (err.status === 401) {
          clearToken() // expired / invalid token → really sign out
          setState({ user: null, status: 'guest' })
          return
        }
        // Could not reach the API: keep the token, tell the UI what happened
        setBackendUnreachable(true)
        setState({ user: null, status: 'guest' })
      })
    return () => controller.abort()
  }, [state.status])

  // The current status is mirrored into a ref so the (global) 401 listener can
  // read it without being re-created on every state change.
  const statusRef = useRef(state.status)
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  // If any request comes back 401 mid-session (token expired / invalidated),
  // sign out gracefully and explain what happened instead of leaving the user
  // staring at request after failed request.
  useEffect(() => {
    const onUnauthorized = () => {
      clearToken()
      if (statusRef.current === 'authenticated') {
        setSessionExpired(true)
        toast?.info('Your session expired – please sign in again')
      }
      setState({ user: null, status: 'guest' })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [toast, setSessionExpired])

  const finishSignIn = useCallback((data) => {
    setToken(data.token)
    setSessionExpired(false)
    setState({ user: data.user, status: 'authenticated' })
    return data.user
  }, [setSessionExpired])

  /**
   * Try to verify the stored token again – used by the "Retry" button in the
   * connection banner once the back-end is reachable again.
   */
  const recheckSession = useCallback(() => {
    if (!getToken()) return false
    setBackendUnreachable(false)
    setState({ user: null, status: 'loading' })
    return true
  }, [])

  /** Merge a patch into the cached user (used after PATCH /auth/me). */
  const updateUser = useCallback((patch) => {
    setState((current) => (current.user ? { ...current, user: { ...current.user, ...patch } } : current))
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
    setSessionExpired(false)
    setState({ user: null, status: 'guest' })
  }, [setSessionExpired])

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      isAuthenticated: state.status === 'authenticated',
      /** Set when the API invalidated our token while the app was open. */
      sessionExpired,
      /** Set when the API could not be reached at start-up (token kept). */
      backendUnreachable,
      recheckSession,
      clearSessionExpired: () => setSessionExpired(false),
      updateUser,
      login,
      register,
      logout,
    }),
    [state, sessionExpired, backendUnreachable, recheckSession, setSessionExpired, login, register, logout, updateUser],
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
