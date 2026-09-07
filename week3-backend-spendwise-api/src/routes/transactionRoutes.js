import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/transactionController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  createTransactionSchema,
  idParamSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from '../validators/schemas.js'

const router = Router()

// All transaction routes require a logged-in user
router.use(requireAuth)

router
  .route('/')
  .get(validate(listTransactionsQuerySchema, 'query'), ctrl.listTransactions)
  .post(validate(createTransactionSchema), ctrl.createTransaction)

router.post('/bulk', validate(z.array(createTransactionSchema).min(1).max(500)), ctrl.bulkCreateTransactions)

router
  .route('/:id')
  .get(validate(idParamSchema, 'params'), ctrl.getTransaction)
  .patch(validate(idParamSchema, 'params'), validate(updateTransactionSchema), ctrl.updateTransaction)
  .delete(validate(idParamSchema, 'params'), ctrl.deleteTransaction)

export default router
