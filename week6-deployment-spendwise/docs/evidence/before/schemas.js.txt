/**
 * Zod validation schemas
 * ----------------------
 * Every request body / query / param is validated before it reaches a
 * controller. Schemas are exported individually so tests can import them.
 */
import { z } from 'zod'
import { CATEGORIES, PAYMENT_METHODS, TRANSACTION_TYPES } from '../models/Transaction.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const dateString = z
  .string()
  .regex(ISO_DATE, 'Date must be in YYYY-MM-DD format')
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), 'Invalid calendar date')
  .refine((s) => new Date(`${s}T00:00:00Z`) <= new Date(), 'Date cannot be in the future')

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id format')

// ---------- Auth ----------
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  currency: z.string().length(3).toUpperCase().optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    currency: z.string().length(3).toUpperCase().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/),
})

// ---------- Transactions ----------
const transactionFields = {
  title: z.string().trim().min(1, 'Title is required').max(60),
  amount: z.coerce.number().positive('Amount must be greater than zero').max(10_000_000),
  type: z.enum(TRANSACTION_TYPES),
  category: z.enum(CATEGORIES),
  payment: z.enum(PAYMENT_METHODS),
  date: dateString,
  notes: z.string().trim().max(200),
}

export const createTransactionSchema = z.object({
  ...transactionFields,
  payment: transactionFields.payment.default('upi'),
  notes: transactionFields.notes.optional().default(''),
})

// No defaults here – a PATCH must only touch the fields the client sent
export const updateTransactionSchema = z
  .object(transactionFields)
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' })

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(TRANSACTION_TYPES).optional(),
  category: z.enum(CATEGORIES).optional(),
  payment: z.enum(PAYMENT_METHODS).optional(),
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
  q: z.string().trim().max(60).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  sort: z.enum(['date', '-date', 'amount', '-amount', 'createdAt', '-createdAt']).default('-date'),
})

export const summaryQuerySchema = z.object({
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
  months: z.coerce.number().int().min(1).max(24).default(6),
})

export const idParamSchema = z.object({ id: objectId })
