/**
 * Realtime routes (Week 4)
 * ------------------------
 * GET /api/v1/events/stream – Server-Sent Events stream with every change the
 *                            signed-in user makes (this device or any other).
 * GET /api/v1/events/status – how many live streams this account has open;
 *                            handy for diagnostics and for the e2e tests.
 */
import { Router } from 'express'
import { requireAuth, requireAuthSse } from '../middleware/auth.js'
import { sendSuccess } from '../utils/response.js'
import { realtime } from '../realtime/eventBus.js'

const router = Router()

/** GET /api/v1/events/stream */
router.get('/stream', requireAuthSse, (req, res) => {
  // Keep the socket open indefinitely – no timeouts, no compression
  req.socket.setTimeout(0)
  req.socket.setNoDelay(true)
  req.socket.setKeepAlive(true)

  const lastEventId = req.headers['last-event-id'] ?? req.query.lastEventId
  realtime.subscribe(String(req.user.id), res, { lastEventId })

  // `subscribe` already wired res 'close' to the cleanup function
  req.on('close', () => res.end())
})

/** GET /api/v1/events/status */
router.get('/status', requireAuth, (req, res) => {
  const info = realtime.stats()
  sendSuccess(res, {
    ...info,
    thisUser: info.byUser[String(req.user.id)] ?? 0,
  })
})

export default router
