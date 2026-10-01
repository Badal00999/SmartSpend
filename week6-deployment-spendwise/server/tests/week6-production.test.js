import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { validateProductionConfig } from '../src/config/production.js'
import { readinessHandler } from '../src/middleware/readiness.js'
import { api } from './helpers.js'

const valid = { nodeEnv: 'production', mongodbUri: 'mongodb+srv://example.invalid/spendwise', jwtSecret: 'a'.repeat(48), corsOrigins: ['https://spendwise.example'] }
describe('Week 6 production guardrails', () => {
  it('accepts an explicit production config', () => expect(() => validateProductionConfig(valid)).not.toThrow())
  it('preserves no-config local development', () => expect(() => validateProductionConfig({ nodeEnv: 'development' })).not.toThrow())
  it.each(['', 'https://example.invalid'])('rejects absent or wrong-protocol database: %s', mongodbUri => {
    expect(() => validateProductionConfig({ ...valid, mongodbUri })).toThrow(/MONGODB_URI/)
  })
  it.each(['short', 'change-me-in-production-please-32-characters'])('rejects weak/example secret: %s', jwtSecret => {
    expect(() => validateProductionConfig({ ...valid, jwtSecret })).toThrow(/JWT_SECRET/)
  })
  it.each([[], ['*'], ['http://spendwise.example'], ['https://spendwise.example/path'], ['https://user:password@spendwise.example']])('rejects insecure/ambiguous origins: %j', corsOrigins => {
    expect(() => validateProductionConfig({ ...valid, corsOrigins })).toThrow(/CORS|HTTPS/)
  })
  it('accepts an explicit list of HTTPS origins', () => {
    expect(() => validateProductionConfig({ ...valid, corsOrigins: ['https://one.example', 'https://two.example'] })).not.toThrow()
  })
})
describe('Week 6 readiness', () => {
  it('real connected database answers 200 with no cache', async () => {
    const res = await api().get('/api/v1/ready')
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ready')
    expect(res.headers['cache-control']).toBe('no-store')
  })
  it('unavailable database answers 503', async () => {
    const app = express(); app.get('/ready', readinessHandler(async () => false))
    expect((await request(app).get('/ready')).status).toBe(503)
  })
  it('probe failure answers 503 without leaking database details', async () => {
    const app = express(); app.get('/ready', readinessHandler(async () => { throw new Error('private-db-host') }))
    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    expect(res.text).not.toContain('private-db-host')
  })
})

describe('Week 6 built-client release paths', () => {
  it('serves the shell even when the release root contains a hidden parent directory', async () => {
    const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const path = await import('node:path')
    const { mountClient } = await import('../src/clientApp.js')
    const temp = await mkdtemp(path.join(tmpdir(), 'week6-static-'))
    try {
      const dist = path.join(temp, '.release', 'dist')
      await mkdir(dist, { recursive: true })
      await writeFile(path.join(dist, 'index.html'), '<div id="root">release</div>')
      const app = express(); mountClient(app, dist)
      const response = await request(app).get('/settings')
      expect(response.status).toBe(200)
      expect(response.text).toContain('id="root"')
    } finally { await rm(temp, { recursive: true, force: true }) }
  })
})
