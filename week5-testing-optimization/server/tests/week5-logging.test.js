import express from 'express'
import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { requestLogger } from '../src/middleware/requestLogger.js'

describe('W5 log confidentiality', () => {
  it.each([
    '/api/v1/events/stream?token=private-test-value',
    '/api/v1/events/stream?ToKeN=private-test-value&token=another-private-value',
    '/api/v1/events/stream?%74oken=private-test-value',
    '/api/v1/events/stream?search=private-test-value',
  ])('logs route/status without credentials or query values: %s', async url => {
    const lines = []
    const app = express()
    app.use(requestLogger({ stream: { write: text => lines.push(text) } }))
    app.get('/api/v1/events/stream', (_req, res) => res.sendStatus(200))
    await request(app).get(url).set('Referer', 'https://example.test/?token=private-test-value')
    const log = lines.join('')
    expect(log).not.toContain('private')
    expect(log).not.toContain('?')
    expect(log).toContain('GET /api/v1/events/stream 200')
  })
})
