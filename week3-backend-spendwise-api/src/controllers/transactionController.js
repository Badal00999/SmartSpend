/**
 * Transaction controller – CRUD + list with filters/pagination.
 * Every query is scoped to req.user so users can only touch their own data.
 */
import { Transaction } from '../models/Transaction.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendCreated, sendNoContent, sendSuccess } from '../utils/response.js'

const toDate = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00.000Z`)

/** Escape user input before using it in a regex. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Build the Mongo filter from validated query params. */
export function buildFilter(userId, q = {}) {
  const filter = { user: userId }
  if (q.type) filter.type = q.type
  if (q.category) filter.category = q.category
  if (q.payment) filter.payment = q.payment
  if (q.from || q.to) {
    filter.date = {}
    if (q.from) filter.date.$gte = toDate(q.from)
    if (q.to) filter.date.$lte = toDate(q.to)
  }
  if (q.minAmount !== undefined || q.maxAmount !== undefined) {
    filter.amount = {}
    if (q.minAmount !== undefined) filter.amount.$gte = q.minAmount
    if (q.maxAmount !== undefined) filter.amount.$lte = q.maxAmount
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i')
    filter.$or = [{ title: rx }, { notes: rx }]
  }
  return filter
}

/** GET /api/v1/transactions */
export const listTransactions = asyncHandler(async (req, res) => {
  const q = req.validatedQuery
  const filter = buildFilter(req.user.id, q)
  const sortField = q.sort.replace('-', '')
  const sortDir = q.sort.startsWith('-') ? -1 : 1
  const skip = (q.page - 1) * q.limit

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ [sortField]: sortDir, _id: -1 }).skip(skip).limit(q.limit),
    Transaction.countDocuments(filter),
  ])

  sendSuccess(res, items, {
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      hasNext: skip + items.length < total,
      hasPrev: q.page > 1,
    },
  })
})

/** GET /api/v1/transactions/:id */
export const getTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, user: req.user.id })
  if (!tx) throw ApiError.notFound('Transaction not found')
  sendSuccess(res, tx)
})

/** POST /api/v1/transactions */
export const createTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.create({ ...req.body, date: toDate(req.body.date), user: req.user.id })
  sendCreated(res, tx)
})

/** PATCH /api/v1/transactions/:id */
export const updateTransaction = asyncHandler(async (req, res) => {
  const update = { ...req.body }
  if (update.date) update.date = toDate(update.date)

  const tx = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, update, {
    returnDocument: 'after',
    runValidators: true,
  })
  if (!tx) throw ApiError.notFound('Transaction not found')
  sendSuccess(res, tx)
})

/** DELETE /api/v1/transactions/:id */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id })
  if (!tx) throw ApiError.notFound('Transaction not found')
  sendNoContent(res)
})

/** POST /api/v1/transactions/bulk – import many at once (e.g. from the Week 2 localStorage data) */
export const bulkCreateTransactions = asyncHandler(async (req, res) => {
  const docs = req.body.map((t) => ({ ...t, date: toDate(t.date), user: req.user.id }))
  const created = await Transaction.insertMany(docs, { ordered: true })
  sendCreated(res, { count: created.length, items: created })
})
