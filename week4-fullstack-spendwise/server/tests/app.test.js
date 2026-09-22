import { describe, it, expect } from 'vitest'
import { api } from './helpers.js'

describe('Meta routes & cross-cutting behaviour', () => {
  it('GET / describes the API', async () => {
    const res = await api().get('/')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'SpendWise API', docs: '/api/docs' })
  })

  it('GET /api/v1/health reports database status', async () => {
    const res = await api().get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'connected' })
  })

  it('GET /api/v1/meta/categories exposes enums', async () => {
    const res = await api().get('/api/v1/meta/categories')
    expect(res.body.data.types).toEqual(['income', 'expense'])
    expect(res.body.data.categories).toContain('food')
    expect(res.body.data.paymentMethods).toContain('upi')
  })

  it('serves the OpenAPI document and Swagger UI', async () => {
    const json = await api().get('/api/v1/openapi.json')
    expect(json.status).toBe(200)
    expect(json.body.openapi).toBe('3.0.3')
    expect(Object.keys(json.body.paths)).toEqual(
      expect.arrayContaining(['/auth/register', '/transactions', '/transactions/{id}', '/stats/summary']),
    )
    const ui = await api().get('/api/docs/')
    expect(ui.status).toBe(200)
    expect(ui.text).toContain('swagger-ui')
  })

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api().get('/api/v1/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/v1/does-not-exist not found' },
    })
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"bad json')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('sets security headers and hides X-Powered-By', async () => {
    const res = await api().get('/api/v1/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBeDefined()
  })

  it('allows the configured CORS origin and blocks others', async () => {
    const ok = await api().get('/api/v1/health').set('Origin', 'http://localhost:5173')
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173')

    const blocked = await api().get('/api/v1/health').set('Origin', 'https://evil.example')
    expect(blocked.status).toBe(403)
    expect(blocked.body.error.code).toBe('FORBIDDEN')
  })
})
