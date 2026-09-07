/**
 * Database connection
 * -------------------
 * Connects Mongoose to MongoDB. When MONGODB_URI is empty (or in tests) an
 * in-memory MongoDB instance is started so the API runs with zero setup.
 */
import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

let memoryServer = null

export async function connectDB(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true)

  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    memoryServer = await MongoMemoryServer.create()
    uri = memoryServer.getUri('spendwise')
    logger.warn('MONGODB_URI not set – using in-memory MongoDB (data will be lost on restart)')
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })
  logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
  if (memoryServer) {
    await memoryServer.stop()
    memoryServer = null
  }
}
