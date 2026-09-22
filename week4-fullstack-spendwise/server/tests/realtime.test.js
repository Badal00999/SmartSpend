/**
 * Week 4 – realtime (Server-Sent Events) tests.
 *
 * These tests exercise a real HTTP listener (not supertest) because SSE needs a
 * connection that stays open while we make other requests; `fetch()` gives us a
 * readable stream we can parse frame by frame.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createApp } from '../src/app.js'
import { realtime } from '../src/realtime/eventBus.js'
import { api, auth, registerAndLogin, sampleTx } from './helpers.js'

let server
let base

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

afterEach(() => realtime.closeAll())

afterAll(async () => {
  realtime.closeAll()
  await new Promise((resolve) => server.close(resolve))
})

/** Parse one SSE frame (`id:`, `event:`, `data:` lines) into an object. */
function parseFrame(raw) {
  const event = { id: undefined, event: undefined, data: undefined }
  let sawData = false
  for (const line of raw.split('\n')) {
    if (line.startsWith(':') || line.trim() === '') continue
    const idx = line.indexOf(':')
    const field = idx === -1 ? line : line.slice(0, idx)
    const value = idx === -1 ? '' : line.slice(idx + 1).trim()
    if (field === 'id') event.id = Number(value)
    else if (field === 'event') event.event = value
    else if (field === 'data') {
      event.data = JSON.parse(value)
      sawData = true
    }
  }
  return sawData || event.event ? event : null
}

/**
 * Open an SSE connection and collect frames in the background.
 * @returns {Promise<{res: Response, events: object[], close: () => Promise<void>}>}
 */
async function openStream(token, extraQuery = '') {
  const url = `${base}/api/v1/events/stream?token=${encodeURIComponent(token)}${extraQuery}`
  const res = await fetch(url, { headers: { Accept: 'text/event-stream' } })
  const events = []

  if (!res.ok) return { res, events, close: async () => {} }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = parseFrame(buffer.slice(0, sep))
          buffer = buffer.slice(sep + 2)
          if (frame) events.push(frame)
        }
      }
    } catch {
      /* stream cancelled */
    }
  })()

  return {
    res,
    events,
    close: async () => {
      await reader.cancel().catch(() => {})
      await pump.catch(() => {})
    },
  }
}

/** Wait until `predicate()` is true (or fail the test after `timeout`). */
async function waitFor(predicate, timeout = 4000) {
  const started = Date.now()
  for (;;) {
    if (predicate()) return true
    if (Date.now() - started > timeout) return false
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('GET /api/v1/events/status', () => {
  it('requires authentication', async () => {
    const res = await api().get('/api/v1/events/status')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('reports zero live streams for a fresh user', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get('/api/v1/events/status').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.thisUser).toBe(0)
    expect(res.body.data.totalClients).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/v1/events/stream', () => {
  it('rejects a missing or invalid token', async () => {
    const noToken = await fetch(`${base}/api/v1/events/stream`)
    expect(noToken.status).toBe(401)

    const badToken = await fetch(`${base}/api/v1/events/stream?token=not-a-jwt`)
    expect(badToken.status).toBe(401)
  })

  it('opens an event-stream and announces itself', async () => {
    const { token } = await registerAndLogin()
    const stream = await openStream(token)

    expect(stream.res.status).toBe(200)
    expect(stream.res.headers.get('content-type')).toMatch(/text\/event-stream/)
    expect(stream.res.headers.get('cache-control')).toContain('no-cache')

    expect(await waitFor(() => stream.events.some((e) => e.event === 'stream:ready'))).toBe(true)

    const status = await api().get('/api/v1/events/status').set(auth(token))
    expect(status.body.data.thisUser).toBe(1)

    await stream.close()
  })

  it('accepts the token as a Bearer header too (curl / Postman / test tools)', async () => {
    const { token } = await registerAndLogin()
    const res = await fetch(`${base}/api/v1/events/stream`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    })
    expect(res.status).toBe(200)
    await res.body.cancel()
  })
})

describe('realtime broadcasting', () => {
  it('delivers transaction:created to the open stream', async () => {
    const { token } = await registerAndLogin()
    const stream = await openStream(token)
    await waitFor(() => stream.events.length > 0)

    const created = await api().post('/api/v1/transactions').set(auth(token)).send(sampleTx)
    expect(created.status).toBe(201)

    expect(await waitFor(() => stream.events.some((e) => e.event === 'transaction:created'))).toBe(true)
    const event = stream.events.find((e) => e.event === 'transaction:created')
    expect(event.data.transaction.title).toBe(sampleTx.title)
    expect(event.data.transaction.id).toBe(created.body.data.id)
    expect(typeof event.id).toBe('number')

    await stream.close()
  })

  it('delivers update and delete events as well', async () => {
    const { token } = await registerAndLogin()
    const created = await api().post('/api/v1/transactions').set(auth(token)).send(sampleTx)
    const id = created.body.data.id

    const stream = await openStream(token)
    await waitFor(() => stream.events.length > 0)

    await api().patch(`/api/v1/transactions/${id}`).set(auth(token)).send({ amount: 999 })
    await api().delete(`/api/v1/transactions/${id}`).set(auth(token))

    expect(await waitFor(() => stream.events.some((e) => e.event === 'transaction:updated'))).toBe(true)
    expect(await waitFor(() => stream.events.some((e) => e.event === 'transaction:deleted'))).toBe(true)

    const updated = stream.events.find((e) => e.event === 'transaction:updated')
    expect(updated.data.transaction.amount).toBe(999)
    expect(stream.events.find((e) => e.event === 'transaction:deleted').data.id).toBe(id)

    await stream.close()
  })

  it('never leaks one account’s events into another account’s stream', async () => {
    const alice = await registerAndLogin()
    const bob = await registerAndLogin({ email: 'bob@example.com' })

    const bobStream = await openStream(bob.token)
    await waitFor(() => bobStream.events.length > 0)

    await api().post('/api/v1/transactions').set(auth(alice.token)).send(sampleTx)
    await new Promise((r) => setTimeout(r, 250)) // give a wrong broadcast time to arrive

    expect(bobStream.events.filter((e) => e.event?.startsWith('transaction:'))).toHaveLength(0)

    await bobStream.close()
  })

  it('replays missed events when the client reconnects with lastEventId', async () => {
    const { token } = await registerAndLogin()
    // Three changes happen while nothing is connected…
    await api().post('/api/v1/transactions').set(auth(token)).send(sampleTx)
    await api().post('/api/v1/transactions').set(auth(token)).send({ ...sampleTx, title: 'Second' })
    await api().delete('/api/v1/transactions').set(auth(token))

    // …then the browser reconnects and catches up
    const stream = await openStream(token, '&lastEventId=0')
    expect(await waitFor(() => stream.events.filter((e) => e.data?.transaction || e.data?.id).length >= 2)).toBe(true)
    expect(stream.events.some((e) => e.event === 'transaction:created')).toBe(true)

    await stream.close()
  })
})

describe('DELETE /api/v1/transactions (danger zone)', () => {
  it('removes every transaction and broadcasts transaction:cleared', async () => {
    const { token } = await registerAndLogin()
    await api().post('/api/v1/transactions').set(auth(token)).send(sampleTx)
    await api().post('/api/v1/transactions').set(auth(token)).send({ ...sampleTx, title: 'Another' })

    const stream = await openStream(token)
    await waitFor(() => stream.events.length > 0)

    const res = await api().delete('/api/v1/transactions').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.deletedCount).toBe(2)

    expect(await waitFor(() => stream.events.some((e) => e.event === 'transaction:cleared'))).toBe(true)
    const event = stream.events.find((e) => e.event === 'transaction:cleared')
    expect(event.data.deletedCount).toBe(2)

    const list = await api().get('/api/v1/transactions').set(auth(token))
    expect(list.body.meta.total).toBe(0)

    await stream.close()
  })

  it('only clears the calling user’s data', async () => {
    const alice = await registerAndLogin()
    const bob = await registerAndLogin({ email: 'bob2@example.com' })
    await api().post('/api/v1/transactions').set(auth(alice.token)).send(sampleTx)
    await api().post('/api/v1/transactions').set(auth(bob.token)).send(sampleTx)

    await api().delete('/api/v1/transactions').set(auth(alice.token))

    const bobList = await api().get('/api/v1/transactions').set(auth(bob.token))
    expect(bobList.body.meta.total).toBe(1)
  })
})

describe('request tracing', () => {
  it('echoes an X-Request-Id header and includes it in meta', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get('/api/v1/transactions').set(auth(token)).set('X-Request-Id', 'trace-me-123')
    expect(res.headers['x-request-id']).toBe('trace-me-123')
    expect(res.body.meta.requestId).toBe('trace-me-123')
  })

  it('generates a request id when the caller does not send one', async () => {
    const res = await api().get('/api/v1/health')
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })
})
