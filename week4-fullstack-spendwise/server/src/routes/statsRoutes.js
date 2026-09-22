import { Router } from 'express'
import * as ctrl from '../controllers/statsController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { summaryQuerySchema } from '../validators/schemas.js'

const router = Router()

router.use(requireAuth)
router.get('/summary', validate(summaryQuerySchema, 'query'), ctrl.summary)
router.get('/by-category', validate(summaryQuerySchema, 'query'), ctrl.byCategory)
router.get('/monthly', validate(summaryQuerySchema, 'query'), ctrl.monthly)

export default router
