import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as ctrl from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../validators/schemas.js'
import { env } from '../config/env.js'

const router = Router()

// Stricter limit on credential endpoints to slow brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again in 15 minutes' } },
})

router.post('/register', authLimiter, validate(registerSchema), ctrl.register)
router.post('/login', authLimiter, validate(loginSchema), ctrl.login)
router.get('/me', requireAuth, ctrl.me)
router.patch('/me', requireAuth, validate(updateProfileSchema), ctrl.updateMe)
router.patch('/password', requireAuth, validate(changePasswordSchema), ctrl.changePassword)

export default router
