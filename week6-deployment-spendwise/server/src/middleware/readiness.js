import mongoose from 'mongoose'

// Readiness is intentionally stricter than the existing liveness endpoint.
// An actual lightweight ping detects a connection that is open but unusable.
export function readinessHandler(probe = async () => {
  if (mongoose.connection.readyState !== 1) return false
  await mongoose.connection.db.admin().command({ ping: 1 }, { timeoutMS: 2000 })
  return true
}) {
  return async (_req, res) => {
    let ready = false
    try { ready = await probe() } catch { /* Never expose connection details. */ }
    res.setHeader('Cache-Control', 'no-store')
    res.status(ready ? 200 : 503).json({ success: ready, data: { status: ready ? 'ready' : 'not_ready' } })
  }
}
