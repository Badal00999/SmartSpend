/**
 * Global test setup – spins up an in-memory MongoDB once per test file and
 * wipes all collections between tests so every test starts clean.
 */
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { connectDB, disconnectDB } from '../src/config/db.js'

beforeAll(async () => {
  await connectDB('') // '' ⇒ in-memory server
})

afterEach(async () => {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
})

afterAll(async () => {
  await disconnectDB()
})
