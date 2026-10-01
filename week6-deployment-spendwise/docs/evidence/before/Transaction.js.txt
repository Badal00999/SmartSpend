/**
 * Transaction model
 * -----------------
 * Mirrors the Week 2 front-end data model exactly:
 *   title, amount, type, category, payment, date, notes
 * Every transaction belongs to one user (multi-tenant isolation is enforced in
 * the controllers by always filtering on `user`).
 */
import mongoose from 'mongoose'

export const TRANSACTION_TYPES = ['income', 'expense']

export const CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'entertainment',
  'health',
  'education',
  'travel',
  'salary',
  'freelance',
  'other',
]

export const PAYMENT_METHODS = ['upi', 'card', 'cash', 'bank', 'wallet']

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    amount: { type: Number, required: true, min: 0.01, max: 10_000_000 },
    type: { type: String, required: true, enum: TRANSACTION_TYPES },
    category: { type: String, required: true, enum: CATEGORIES },
    payment: { type: String, required: true, enum: PAYMENT_METHODS, default: 'upi' },
    /** Stored as a real Date; API accepts/returns YYYY-MM-DD. */
    date: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, maxlength: 200, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id
        delete ret._id
        ret.date = ret.date instanceof Date ? ret.date.toISOString().slice(0, 10) : ret.date
        return ret
      },
    },
  },
)

// Compound index: the most common query is "this user's transactions, newest first"
transactionSchema.index({ user: 1, date: -1 })
transactionSchema.index({ user: 1, category: 1 })

export const Transaction = mongoose.model('Transaction', transactionSchema)
