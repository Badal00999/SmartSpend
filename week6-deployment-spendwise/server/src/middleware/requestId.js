/**
 * Request id middleware
 * ---------------------
 * Every request gets an id (taken from `X-Request-Id` when the caller supplies
 * one, otherwise generated). The id is echoed in the `X-Request-Id` response
 * header and, for API responses, in `meta.requestId`, so a user-visible error
 * message can be traced back to a log line.
 */
import { randomUUID } from 'node:crypto'

export function requestId(req, res, next) {
  const incoming = req.get('X-Request-Id')
  const id = incoming && incoming.length <= 100 ? incoming : randomUUID()
  res.locals.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}

export default requestId
