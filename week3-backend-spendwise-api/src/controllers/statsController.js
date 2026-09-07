/**
 * Stats controller – aggregation endpoints that power the dashboard.
 * Uses MongoDB aggregation pipelines so the maths happens in the database.
 */
import mongoose from 'mongoose'
import { Transaction } from '../models/Transaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/response.js'

const userMatch = (req, extra = {}) => ({
  user: new mongoose.Types.ObjectId(req.user.id),
  ...extra,
})

function dateRange(q) {
  const range = {}
  if (q.from) range.$gte = new Date(`${q.from}T00:00:00.000Z`)
  if (q.to) range.$lte = new Date(`${q.to}T00:00:00.000Z`)
  return Object.keys(range).length ? { date: range } : {}
}

/** GET /api/v1/stats/summary – totals + this-month figures */
export const summary = asyncHandler(async (req, res) => {
  const q = req.validatedQuery
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [allTime, thisMonth, counts] = await Promise.all([
    Transaction.aggregate([
      { $match: userMatch(req, dateRange(q)) },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: userMatch(req, { date: { $gte: monthStart } }) },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    Transaction.countDocuments(userMatch(req, dateRange(q))),
  ])

  const pick = (rows, type) => rows.find((r) => r._id === type)?.total ?? 0
  const income = pick(allTime, 'income')
  const expense = pick(allTime, 'expense')

  sendSuccess(res, {
    income,
    expense,
    balance: income - expense,
    transactionCount: counts,
    thisMonth: {
      income: pick(thisMonth, 'income'),
      expense: pick(thisMonth, 'expense'),
    },
    currency: req.user.currency,
  })
})

/** GET /api/v1/stats/by-category – expense split by category */
export const byCategory = asyncHandler(async (req, res) => {
  const q = req.validatedQuery
  const rows = await Transaction.aggregate([
    { $match: userMatch(req, { type: 'expense', ...dateRange(q) }) },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ])
  const grand = rows.reduce((s, r) => s + r.total, 0)
  sendSuccess(
    res,
    rows.map((r) => ({
      category: r._id,
      total: r.total,
      count: r.count,
      percent: grand ? Math.round((r.total / grand) * 1000) / 10 : 0,
    })),
    { meta: { totalExpense: grand } },
  )
})

/** GET /api/v1/stats/monthly – income vs expense per month for the last N months */
export const monthly = asyncHandler(async (req, res) => {
  const { months } = req.validatedQuery
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))

  const rows = await Transaction.aggregate([
    { $match: userMatch(req, { date: { $gte: start } }) },
    {
      $group: {
        _id: { y: { $year: '$date' }, m: { $month: '$date' }, type: '$type' },
        total: { $sum: '$amount' },
      },
    },
  ])

  // Fill every month (even empty ones) so charts have a continuous axis
  const buckets = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    buckets.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, income: 0, expense: 0 })
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.month, i]))
  for (const r of rows) {
    const key = `${r._id.y}-${String(r._id.m).padStart(2, '0')}`
    if (key in idx) buckets[idx[key]][r._id.type] = r.total
  }
  sendSuccess(res, buckets)
})
