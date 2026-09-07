/**
 * Authentication middleware
 * -------------------------
 * `requireAuth` – verifies the Bearer JWT, loads the user and attaches it to
 *                 req.user. Responds 401 on any failure.
 * `requireRole` – optional role guard for admin-only routes.
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

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
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

  req.user = user
  next()
})

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden())
    next()
  }
