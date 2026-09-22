/**
 * Week 4 – single-port production mode.
 * `mountClient()` serves the built React app from the API process so the whole
 * project can run on one URL (`npm start`), which is what the setup
 * instructions in the README/report describe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { mountClient } from '../src/clientApp.js'
import { api } from './helpers.js'

let dist
let app

beforeAll(async () => {
  dist = await mkdtemp(path.join(tmpdir(), 'spendwise-dist-'))
  await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>SpendWise</title><div id="root"></div>')
  await mkdir(path.join(dist, 'assets'))
  await writeFile(path.join(dist, 'assets', 'app-abc123.js'), 'console.log("bundle")')

  app = express()
  mountClient(app, dist)
  app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } }))
})

afterAll(async () => {
  await rm(dist, { recursive: true, force: true })
})

describe('mountClient()', () => {
  it('serves index.html at the root', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('id="root"')
    expect(res.headers['cache-control']).toContain('no-cache')
  })

  it('serves hashed assets with long-lived caching', async () => {
    const res = await request(app).get('/assets/app-abc123.js')
    expect(res.status).toBe(200)
    expect(res.text).toContain('bundle')
    expect(res.headers['cache-control']).toContain('max-age=31536000')
  })

  it('falls back to index.html for client-side routes (SPA)', async () => {
    for (const route of ['/dashboard', '/settings', '/login', '/transactions/abc']) {
      const res = await request(app).get(route)
      expect(res.status).toBe(200)
      expect(res.text).toContain('id="root"')
    }
  })

  it('does not swallow missing files – they still 404', async () => {
    const res = await request(app).get('/assets/missing.js')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('reports cleanly when there is no build on disk', () => {
    const fresh = express()
    expect(mountClient(fresh, path.join(dist, 'does-not-exist'))).toBe(false)
  })
})

describe('client mount takes precedence over the JSON API root', () => {
  it('serves the app shell at / instead of the API info document', async () => {
    const expressApp = express()
    const mounted = mountClient(expressApp, dist)
    expect(mounted).toBe(true)
    if (!mounted) expressApp.get('/', (_req, res) => res.json({ name: 'SpendWise API' }))

    const root = await request(expressApp).get('/')
    expect(root.headers['content-type']).toContain('text/html')
    expect(root.text).toContain('id="root"')
  })
})

describe('API process without a client build (test default)', () => {
  it('answers unknown non-API routes with a JSON 404 envelope', async () => {
    const res = await api().get('/dashboard')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
