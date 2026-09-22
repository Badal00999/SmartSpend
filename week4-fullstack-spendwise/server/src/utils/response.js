/**
 * Response helpers – every successful response has the same envelope:
 *   { success: true, data: ..., meta?: {...} }
 * so front-end code can rely on one shape.
 */
export function sendSuccess(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data }
  if (meta) body.meta = meta
  return res.status(status).json(body)
}

export function sendCreated(res, data) {
  return sendSuccess(res, data, { status: 201 })
}

export function sendNoContent(res) {
  return res.status(204).send()
}
