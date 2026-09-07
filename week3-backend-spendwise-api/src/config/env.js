/**
 * Environment configuration
 * -------------------------
 * Reads `.env`, validates required values and exports a frozen config object.
 * Failing fast on bad configuration is safer than discovering it at runtime.
 */
import 'dotenv/config'

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isProd = NODE_ENV === 'production'
const isTest = NODE_ENV === 'test'

const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'dev-only-insecure-secret')
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production. Set it in your environment or .env file.')
}
if (isProd && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.')
}

export const env = Object.freeze({
  NODE_ENV,
  isProd,
  isTest,
  PORT: Number(process.env.PORT) || 4000,
  /** Empty string ⇒ start an in-memory MongoDB (dev/demo convenience). */
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGINS: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
})
