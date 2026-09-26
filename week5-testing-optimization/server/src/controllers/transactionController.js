/**
 * Transaction controller – CRUD + list with filters/pagination.
 * Every query is scoped to req.user so users can only touch their own data.
 *
 * Week 4: every mutation also publishes an event on the realtime bus, which is
 * how the browser UI stays in sync across tabs/devices without polling.
 */
import { Transaction } from '../models/Transaction.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendCreated, sendNoContent, sendSuccess } from '../utils/response.js'
import { publish } from '../realtime/eventBus.js'

const toDate = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00.000Z`)

/** Escape user input before using it in a regex. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Timestamps of every request are attached to the response envelope (meta). */
const meta = (res) => ({ requestId: res.locals.requestId ?? null })

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
      ...meta(res),
    },
  })
})

/** GET /api/v1/transactions/:id */
export const getTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, user: req.user.id })
  if (!tx) throw ApiError.notFound('Transaction not found')
  sendSuccess(res, tx, { meta: meta(res) })
})

/** POST /api/v1/transactions */
export const createTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.create({ ...req.body, date: toDate(req.body.date), user: req.user.id })
  publish(req.user.id, 'transaction:created', { transaction: tx, origin: originOf(req) })
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
  const delivered = publish(req.user.id, 'transaction:updated', { transaction: tx, origin: originOf(req) })
  sendSuccess(res, tx, { meta: { ...meta(res), delivered } })
})

/** DELETE /api/v1/transactions/:id */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id })
  if (!tx) throw ApiError.notFound('Transaction not found')
  publish(req.user.id, 'transaction:deleted', { id: String(tx.id), origin: originOf(req) })
  sendNoContent(res)
})

/** DELETE /api/v1/transactions – wipe the account's history (Settings → danger zone). */
export const deleteAllTransactions = asyncHandler(async (req, res) => {
  const { deletedCount } = await Transaction.deleteMany({ user: req.user.id })
  publish(req.user.id, 'transaction:cleared', { deletedCount, origin: originOf(req) })
  sendSuccess(res, { deletedCount }, { meta: meta(res) })
})

/** POST /api/v1/transactions/bulk – import many at once (e.g. from the Week 2 localStorage data) */
export const bulkCreateTransactions = asyncHandler(async (req, res) => {
  const docs = req.body.map((t) => ({ ...t, date: toDate(t.date), user: req.user.id }))
  const created = await Transaction.insertMany(docs, { ordered: true })
  publish(req.user.id, 'transaction:imported', { count: created.length, origin: originOf(req) })
  sendCreated(res, { count: created.length, items: created })
})

/**
 * Clients may send `X-Client-Id` so the UI can ignore the echo of its own
 * mutation (avoids double-applying an optimistic update). Purely informational.
 */
function originOf(req) {
  const id = req.get('X-Client-Id')
  return id ? { clientId: id } : undefined
}
