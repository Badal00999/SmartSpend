/**
 * asyncHandler – wraps an async route handler so rejected promises are
 * forwarded to Express's error middleware instead of crashing the process.
 * (Express 5 does this natively, but the wrapper keeps intent explicit and
 * works identically on Express 4.)
 */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
