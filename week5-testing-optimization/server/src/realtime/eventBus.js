/**
 * Realtime event bus (Server-Sent Events)
 * ---------------------------------------
 * The Week 3 API was strictly request/response: a client only saw changes it
 * made itself. Week 4 asks for "dynamic data processing and real-time
 * interaction", so this module keeps a registry of open `text/event-stream`
 * connections – grouped by user id – and lets the controllers broadcast an
 * event the moment data changes.
 *
 * Design notes
 *  • No extra dependency: raw `res.write()` on an Express response is enough.
 *  • Events are namespaced per user, so one account can never observe another
 *    account's activity (the same isolation guarantee as the REST layer).
 *  • Every event carries a monotonic `id`. A small per-user ring buffer lets a
 *    reconnecting browser (which sends `Last-Event-ID` automatically) replay
 *    whatever it missed while it was offline.
 *  • A shared heartbeat writes a comment frame every 25 s so proxies and
 *    mobile networks do not silently drop idle connections. Heartbeats are
 *    comments (`: ping`) and are ignored by EventSource.
 */

const MAX_REPLAY_EVENTS = 25
const DEFAULT_HEARTBEAT_MS = 25_000

/** userId → Set<client> */
const subscribers = new Map()
/** userId → Array<{id:number, event:string, data:object}> */
const replayBuffer = new Map()

let sequence = 0
let heartbeat = null
let heartbeatMs = DEFAULT_HEARTBEAT_MS

/** Format a single SSE frame. */
function frame({ id, event, data }) {
  const lines = []
  if (id !== undefined) lines.push(`id: ${id}`)
  if (event) lines.push(`event: ${event}`)
  lines.push(`data: ${JSON.stringify(data)}`)
  return `${lines.join('\n')}\n\n`
}

function remember(userId, entry) {
  const buffer = replayBuffer.get(userId) ?? []
  buffer.push(entry)
  while (buffer.length > MAX_REPLAY_EVENTS) buffer.shift()
  replayBuffer.set(userId, buffer)
}

function startHeartbeat() {
  if (heartbeat) return
  heartbeat = setInterval(() => {
    for (const clients of subscribers.values()) {
      for (const client of clients) {
        // `: …` comment frames keep the socket warm without waking the UI
        client.res.write(`: ping ${Date.now()}\n\n`)
      }
    }
  }, heartbeatMs)
  heartbeat.unref?.()
}

/**
 * Register a new SSE connection for `userId`.
 * @param {string} userId
 * @param {import('express').Response} res
 * @param {{ lastEventId?: string }} [options]
 * @returns {() => void} cleanup function (also wired to req 'close')
 */
export function subscribe(userId, res, { lastEventId } = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable proxy buffering (nginx) – otherwise events arrive in batches
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected to SpendWise realtime stream\n\n')

  const client = { id: `sse_${++sequence}`, userId, res, connectedAt: Date.now() }
  const set = subscribers.get(userId) ?? new Set()
  set.add(client)
  subscribers.set(userId, set)
  startHeartbeat()

  // Tell the client where the stream starts so it can show "Live" immediately
  client.res.write(frame({ event: 'stream:ready', data: { clientId: client.id, at: Date.now() } }))

  // Replay anything the client missed (EventSource sends Last-Event-ID on reconnect)
  const since = Number(lastEventId)
  if (Number.isFinite(since)) {
    for (const entry of replayBuffer.get(userId) ?? []) {
      if (entry.id > since) client.res.write(frame(entry))
    }
  }

  const cleanup = () => {
    const current = subscribers.get(userId)
    if (!current) return
    current.delete(client)
    if (current.size === 0) subscribers.delete(userId)
  }
  res.on('close', cleanup)
  res.on('error', cleanup)

  return cleanup
}

/**
 * Broadcast an event to every open connection of one user.
 * @param {string} userId
 * @param {string} event  e.g. 'transaction:created'
 * @param {object} data
 */
export function publish(userId, event, data = {}) {
  const entry = { id: ++sequence, event, data: { ...data, at: Date.now() } }
  remember(String(userId), entry)

  const set = subscribers.get(String(userId))
  if (!set || set.size === 0) return 0
  const payload = frame(entry)
  for (const client of set) client.res.write(payload)
  return set.size
}

/** Convenience wrapper used by the controllers – keeps event names in one place. */
export function publishChange(userId, resource, action, payload) {
  return publish(String(userId), `${resource}:${action}`, payload)
}

/** Live connection information (used by GET /events/status and the tests). */
export function stats() {
  const byUser = {}
  let total = 0
  for (const [userId, clients] of subscribers) {
    byUser[userId] = clients.size
    total += clients.size
  }
  return { totalClients: total, users: Object.keys(byUser).length, byUser }
}

/** Close every stream – used on graceful shutdown and between tests. */
export function closeAll() {
  for (const clients of subscribers.values()) {
    for (const client of clients) {
      try {
        client.res.end()
      } catch {
        /* already gone */
      }
    }
  }
  subscribers.clear()
  replayBuffer.clear()
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
}

/** Override the heartbeat interval (tests use a very small value). */
export function setHeartbeatMs(ms) {
  heartbeatMs = ms
  if (heartbeat) {
    clearInterval(heartbeat)
    heartbeat = null
    startHeartbeat()
  }
}

export const realtime = { subscribe, publish, publishChange, stats, closeAll, setHeartbeatMs }
export default realtime
