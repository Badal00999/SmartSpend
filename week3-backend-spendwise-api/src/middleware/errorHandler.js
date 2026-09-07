/**
 * Central error handling
 * ----------------------
 * `notFound`     – 404 for unknown routes.
 * `errorHandler` – converts any thrown error (ApiError, Mongoose, JWT, JSON
 *                  parse, unknown) into a consistent JSON envelope:
 *                  { success:false, error:{ code, message, details? } }
 * Stack traces are only included outside production.
 */
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { logger } from '../utils/logger.js'

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`))
}

/** Map well-known third-party errors to ApiError. */
function normalise(err) {
  if (err instanceof ApiError) return err

  // Mongoose: invalid ObjectId, e.g. /transactions/abc
  if (err.name === 'CastError') return ApiError.badRequest(`Invalid value for ${err.path}`)

  // Mongoose schema validation (defence in depth – Zod runs first)
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    return ApiError.validation(details)
  }

  // MongoDB duplicate key (unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field'
    return ApiError.conflict(`An account with this ${field} already exists`)
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON in request body')

  // Body too large
  if (err.type === 'entity.too.large') return new ApiError(413, 'Request body too large', { code: 'PAYLOAD_TOO_LARGE' })

  // CORS rejection from our origin callback
  if (err.message?.startsWith('CORS:')) return ApiError.forbidden(err.message)

  return null
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const apiError = normalise(err)

  if (!apiError) {
    // Unexpected error – log it fully, hide details from the client
    logger.error(`${req.method} ${req.originalUrl}`, err)
  }

  const status = apiError?.statusCode ?? 500
  const body = {
    success: false,
    error: {
      code: apiError?.code ?? 'INTERNAL_ERROR',
      message: apiError?.message ?? 'Something went wrong on our side',
    },
  }
  if (apiError?.details) body.error.details = apiError.details
  if (!env.isProd && !apiError) body.error.stack = err.stack

  res.status(status).json(body)
}
