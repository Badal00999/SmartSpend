// Reproducible, isolated query profile. Never connects to the user's database.
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import assert from 'node:assert/strict'
import { Transaction } from '../src/models/Transaction.js'

const output = fileURLToPath(new URL('../../docs/evidence/performance/', import.meta.url))
await mkdir(output, { recursive: true })
const mongod = await MongoMemoryServer.create()
try {
  await mongoose.connect(mongod.getUri('week5_benchmark'))
  // Use a dedicated collection; identical model fields without model index auto-creation.
  const collection = mongoose.connection.collection('profile_transactions')
  const owner = new mongoose.Types.ObjectId('000000000000000000000001')
  const other = new mongoose.Types.ObjectId('000000000000000000000002')
  const rows = Array.from({ length: 20000 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId((i + 100).toString(16).padStart(24, '0')),
    user: i < 10000 ? owner : other,
    title: `Fixture ${i}`, amount: (i % 999) + 1, type: 'expense', category: 'food', payment: 'upi', notes: '',
    date: new Date(Date.UTC(2025, 0, 1 + (i % 365))),
  }))
  await collection.insertMany(rows)
  await collection.createIndex({ user: 1 })
  await collection.createIndex({ date: 1 })
  await collection.createIndex({ user: 1, category: 1 })
  const oldKey = { user: 1, date: -1 }
  const nextKey = { user: 1, date: -1, _id: -1 }
  const schemaHasIndex = Transaction.schema.indexes().some(([key]) => JSON.stringify(key) === JSON.stringify(nextKey))
  assert(schemaHasIndex, 'Application schema must declare the profiled optimized index')
  const query = () => collection.find({ user: owner }).sort({ date: -1, _id: -1 }).limit(20)
  const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
  async function measure(label) {
    for (let i = 0; i < 5; i++) await query().toArray()
    const samplesMs = []
    let items
    for (let i = 0; i < 30; i++) {
      const start = performance.now(); items = await query().toArray(); samplesMs.push(performance.now() - start)
    }
    const explain = await query().explain('executionStats')
    await writeFile(`${output}${label}-explain.json`, JSON.stringify(explain, null, 2))
    return {
      samplesMs, medianMs: percentile(samplesMs, 0.5), p95Ms: percentile(samplesMs, 0.95),
      totalDocsExamined: explain.executionStats.totalDocsExamined,
      totalKeysExamined: explain.executionStats.totalKeysExamined,
      returned: explain.executionStats.nReturned,
      blockingSort: JSON.stringify(explain.queryPlanner.winningPlan).includes('"stage":"SORT"'),
      ids: items.map(row => String(row._id)),
    }
  }
  const oldName = await collection.createIndex(oldKey)
  const before = await measure('before')
  await collection.dropIndex(oldName)
  await collection.createIndex(nextKey)
  const after = await measure('after')
  assert.deepEqual(after.ids, before.ids, 'Optimization must preserve ordered response IDs')
  assert.equal(after.blockingSort, false)
  assert.equal(after.totalDocsExamined, 20)
  const result = {
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, mongodb: (await mongoose.connection.db.admin().serverInfo()).version },
    method: 'Native MongoDB query; sequential old-index then new-index runs; 5 warmups + 30 measured samples each; not HTTP latency or a load test.',
    fixture: { documents: 20000, owners: 2, documentsPerOwner: 10000, days: 365, page: 1, limit: 20 },
    beforeIndex: oldKey, afterIndex: nextKey, before, after,
    orderedIdsEqual: true,
    caveats: 'Warm local in-memory database. Order/cache effects and shared hardware influence timings. Default descending-date page only; countDocuments, deep pages and other sorts are not optimized by this experiment.',
  }
  await writeFile(`${output}query-profile.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally { await mongoose.disconnect(); await mongod.stop() }
