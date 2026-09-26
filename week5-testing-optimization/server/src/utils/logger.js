/**
 * Minimal structured logger (no extra dependency).
 * Silent in test mode so test output stays readable.
 */
const silent = process.env.NODE_ENV === 'test'

const ts = () => new Date().toISOString()

export const logger = {
  info: (...a) => !silent && console.log(`[${ts()}] INFO `, ...a),
  warn: (...a) => !silent && console.warn(`[${ts()}] WARN `, ...a),
  error: (...a) => !silent && console.error(`[${ts()}] ERROR`, ...a),
}
