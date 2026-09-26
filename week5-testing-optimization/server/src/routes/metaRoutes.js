/**
 * Public, unauthenticated helper routes: health check + reference data.
 */
import { Router } from 'express'
import mongoose from 'mongoose'
import { CATEGORIES, PAYMENT_METHODS, TRANSACTION_TYPES } from '../models/Transaction.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

/** GET /api/v1/health */
router.get('/health', (_req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ?? 'unknown'
  sendSuccess(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    database: dbState,
    timestamp: new Date().toISOString(),
  })
})

/** GET /api/v1/meta/categories – enums the client can use for dropdowns */
router.get('/meta/categories', (_req, res) => {
  sendSuccess(res, { types: TRANSACTION_TYPES, categories: CATEGORIES, paymentMethods: PAYMENT_METHODS })
})

export default router
