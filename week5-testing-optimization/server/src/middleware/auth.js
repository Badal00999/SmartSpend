/**
 * Authentication middleware
 * -------------------------
 * `requireAuth`    – verifies the Bearer JWT, loads the user and attaches it to
 *                    req.user. Responds 401 on any failure.
 * `requireAuthSse` – same, but also accepts `?token=` because the browser
 *                    EventSource API cannot set custom request headers.
 * `requireRole`    – optional role guard for admin-only routes.
 */
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'spendwise-api',
  })
}

/** Verify a token and load the matching user, or throw a 401 ApiError. */
async function authenticate(token) {
  if (!token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header. Use: Bearer <token>')
  }

  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'spendwise-api' })
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token has expired, please log in again' : 'Invalid token'
    throw ApiError.unauthorized(msg)
  }

  const user = await User.findById(payload.sub)
  if (!user) throw ApiError.unauthorized('User no longer exists')
  return user
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ')
  if (scheme !== 'Bearer') {
    throw ApiError.unauthorized('Missing or malformed Authorization header. Use: Bearer <token>')
  }
  req.user = await authenticate(token)
  next()
})

/**
 * Same contract as `requireAuth`, but the token may also arrive as a query
 * parameter. Used only by the SSE endpoint, where the client is the browser's
 * EventSource (no custom headers). Long-lived stream URLs should be treated as
 * secrets; the token still expires after JWT_EXPIRES_IN.
 */
export const requireAuthSse = asyncHandler(async (req, _res, next) => {
  const [scheme, headerToken] = (req.headers.authorization ?? '').split(' ')
  const token = headerToken && scheme === 'Bearer' ? headerToken : req.query.token
  req.user = await authenticate(token)
  next()
})

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden())
    next()
  }
