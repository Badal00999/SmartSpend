/**
 * Auth controller – register, login, profile, change password.
 */
import { User } from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../utils/response.js'
import { signToken } from '../middleware/auth.js'

/** POST /api/v1/auth/register */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, currency } = req.body

  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists')
  }

  const user = await User.create({ name, email, password, currency })
  sendCreated(res, { user, token: signToken(user) })
})

/** POST /api/v1/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  // `password` has select:false – opt in explicitly
  const user = await User.findOne({ email }).select('+password')
  // Same message for unknown email and wrong password (don't leak which one)
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password')
  }

  sendSuccess(res, { user, token: signToken(user) })
})

/** GET /api/v1/auth/me */
export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: req.user })
})

/** PATCH /api/v1/auth/me */
export const updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body)
  await req.user.save()
  sendSuccess(res, { user: req.user })
})

/** PATCH /api/v1/auth/password */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = await User.findById(req.user.id).select('+password')

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized('Current password is incorrect')
  }

  user.password = newPassword
  await user.save()
  // Issue a fresh token so clients can rotate
  sendSuccess(res, { message: 'Password updated', token: signToken(user) })
})
