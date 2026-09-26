/**
 * Server entry point – connects to the database, then starts listening.
 * Handles graceful shutdown so in-flight requests finish and the DB
 * connection closes cleanly on SIGINT / SIGTERM.
 */
import { createApp } from './app.js'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

async function main() {
  await connectDB()

  // Convenience: when running on the throw-away in-memory database, load demo
  // data so the API (and Swagger "Try it out") is useful straight away.
  if (!env.MONGODB_URI && !env.isTest) {
    const { seedDemoData, DEMO_USER } = await import('../scripts/seed.js')
    const { count } = await seedDemoData()
    logger.info(`Seeded ${count} demo transactions – login with ${DEMO_USER.email} / ${DEMO_USER.password}`)
  }

  const app = createApp()

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`SpendWise API listening on http://localhost:${env.PORT}  (env: ${env.NODE_ENV})`)
    logger.info(`Swagger docs:  http://localhost:${env.PORT}/api/docs`)
  })

  const shutdown = async (signal) => {
    logger.info(`${signal} received – shutting down gracefully`)
    server.close(async () => {
      await disconnectDB()
      process.exit(0)
    })
    // Force exit if something hangs
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason)
  })
}

main().catch((err) => {
  logger.error('Failed to start server', err)
  process.exit(1)
})
