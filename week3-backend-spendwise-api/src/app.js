/**
 * Express application factory
 * ---------------------------
 * Creating the app in a function (instead of at module top level) lets tests
 * build a fresh instance without starting a network listener.
 *
 * Middleware order matters:
 *   security headers → CORS → rate limit → logging → body parsing →
 *   routes → 404 → error handler
 */
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import YAML from 'yaml'

import { env } from './config/env.js'
import authRoutes from './routes/authRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import statsRoutes from './routes/statsRoutes.js'
import metaRoutes from './routes/metaRoutes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()

  // Behind a reverse proxy (Render, Railway, Nginx) trust X-Forwarded-* headers
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  // ---- Security ----------------------------------------------------------
  app.use(helmet({ contentSecurityPolicy: false })) // CSP off so Swagger UI can load its inline assets
  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser tools (curl, Postman) which send no Origin header
        if (!origin || env.CORS_ORIGINS.includes(origin) || env.CORS_ORIGINS.includes('*')) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} is not allowed`))
      },
      credentials: true,
    }),
  )
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: env.isTest ? 10_000 : 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, slow down' } },
    }),
  )

  // ---- Logging & parsing -------------------------------------------------
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'))
  app.use(express.json({ limit: '100kb' }))

  // ---- API documentation -------------------------------------------------
  const openapi = YAML.parse(readFileSync(path.join(__dirname, 'docs', 'openapi.yaml'), 'utf8'))
  app.get('/api/v1/openapi.json', (_req, res) => res.json(openapi))
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'SpendWise API Docs' }))

  // ---- Routes ------------------------------------------------------------
  app.get('/', (_req, res) =>
    res.json({
      name: 'SpendWise API',
      version: openapi.info.version,
      docs: '/api/docs',
      health: '/api/v1/health',
    }),
  )
  app.use('/api/v1', metaRoutes)
  app.use('/api/v1/auth', authRoutes)
  app.use('/api/v1/transactions', transactionRoutes)
  app.use('/api/v1/stats', statsRoutes)

  // ---- Errors ------------------------------------------------------------
  app.use(notFound)
  app.use(errorHandler)

  return app
}
