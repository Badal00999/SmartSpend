/**
 * ApiError – an Error subclass carrying an HTTP status code and a stable
 * machine-readable `code`. Thrown anywhere in the request pipeline and turned
 * into a JSON response by the central error handler.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status
   * @param {string} message    human-readable message
   * @param {object} [options]
   * @param {string} [options.code]     e.g. 'VALIDATION_ERROR'
   * @param {unknown} [options.details] extra info (field errors, etc.)
   */
  constructor(statusCode, message, { code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code ?? ApiError.defaultCode(statusCode)
    this.details = details
    this.isOperational = true // expected error, not a bug
  }

  static defaultCode(status) {
    return (
      {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        429: 'TOO_MANY_REQUESTS',
      }[status] ?? 'INTERNAL_ERROR'
    )
  }

  static badRequest(msg = 'Bad request', details) {
    return new ApiError(400, msg, { details })
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg)
  }
  static forbidden(msg = 'You do not have permission to do that') {
    return new ApiError(403, msg)
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg)
  }
  static conflict(msg = 'Resource already exists') {
    return new ApiError(409, msg)
  }
  static validation(details, msg = 'Validation failed') {
    return new ApiError(422, msg, { details })
  }
}
