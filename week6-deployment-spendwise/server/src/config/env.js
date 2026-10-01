/**
 * Environment configuration
 * -------------------------
 * Reads `.env`, validates required values and exports a frozen config object.
 * Failing fast on bad configuration is safer than discovering it at runtime.
 */
import 'dotenv/config'
import { validateProductionConfig } from './production.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const MONGODB_URI = process.env.MONGODB_URI?.trim() ?? ''
const CORS_ORIGINS = (process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL || (isProd ? '' : 'http://localhost:5173'))
  .split(',').map(s => s.trim()).filter(Boolean)
validateProductionConfig({ nodeEnv: NODE_ENV, mongodbUri: MONGODB_URI, jwtSecret: JWT_SECRET, corsOrigins: CORS_ORIGINS })

export const env = Object.freeze({
  NODE_ENV,
  isProd,
  isTest,
  PORT: Number(process.env.PORT) || 4000,
  /** Empty string ⇒ start an in-memory MongoDB (dev/demo convenience). */
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  /**
   * Rate limits (requests per 15-minute window). Tunable by environment so the
   * end-to-end suite and load tests can raise them without touching the code.
   */
  RATE_LIMIT_API_MAX: Number(process.env.RATE_LIMIT_API_MAX) || (isTest ? 10_000 : 300),
  RATE_LIMIT_AUTH_MAX: Number(process.env.RATE_LIMIT_AUTH_MAX) || (isTest ? 1_000 : 20),
  /** Serve the built React app (client/dist) from this same port. */
  SERVE_CLIENT: process.env.SERVE_CLIENT ? process.env.SERVE_CLIENT !== 'false' : isProd,
  CLIENT_DIST:
    process.env.CLIENT_DIST ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'client', 'dist'),
  CORS_ORIGINS,
})
