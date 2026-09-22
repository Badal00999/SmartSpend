# Integration notes – how the React client and the Express API fit together

This document is the technical companion to the root `README.md`. It explains
*where* the two halves meet, *why* each decision was taken, and *how* the
behaviour is verified. It is written to be read before the code: every claim
here has a matching test.

---

## 1. Layered view

```
UI components (pages/, components/)          ← know nothing about HTTP
        ▲
Contexts & hooks (context/, hooks/)          ← own the state, decide local vs remote
        ▲
Services (services/)                         ← the only place that speaks HTTP/SSE
        ▲
Express API (server/src/routes → controllers → models)
```

Rules that keep the layers honest:

1. **Components never build URLs.** They call `useTransactions()`,
   `useServerTransactions()` or `useDashboardStats()`; the services own the paths.
2. **One response envelope.** Success is `{ success: true, data, meta? }`, failure
   is `{ success: false, error: { code, message, details? } }`. `api.js` unwraps
   both, so no component ever inspects `response.ok`.
3. **The same object shape in both modes.** Guest (localStorage) and signed-in
   (API) data both become `{ id, title, amount, type, category, payment, date, notes, createdAt }`.
   `services/transactionsApi.js#fromApi` is the single conversion point.
4. **Errors are typed, not strings.** `ApiError` carries `status`, `code`,
   `details[]`, `requestId`, plus `isNetwork`, `isTimeout`, `isServer` helpers used
   by the banners and toasts.

---

## 2. Data flow: one dashboard render

| Step | What happens | Code |
|---|---|---|
| 1 | Read the stored JWT; verify with `GET /auth/me`. 401 → sign out; network error → keep token + banner | `context/AuthContext.jsx` |
| 2 | Decide the data source: `guest` → localStorage, `api:<userId>` → REST | `context/TransactionsContext.jsx` |
| 3 | Load the full list (used for totals, export, detail lookup) | `services/transactionsApi.js#fetchAllTransactions` |
| 4 | Load one page with the filters from the URL | `hooks/useServerTransactions.js` |
| 5 | Load statistics from MongoDB aggregations | `hooks/useDashboardStats.js` → `/stats/*` |
| 6 | Open the SSE stream and listen for changes | `hooks/useRealtime.js` → `services/eventsApi.js` |
| 7 | Any change anywhere bumps `version` → steps 3–5 re-run **without** a loading flash | `TransactionsContext` (`refresh()`) |

### Why the list is server-paged but the totals are not

`GET /transactions` is used with `limit=8` for the screen and with `limit=100`
looping for the in-memory copy. That in-memory copy backs the detail page and the
JSON export. Statistics never use it: `GET /stats/*` aggregates in MongoDB, so
the numbers stay correct when an account grows past a few hundred rows – and the
`data-flow.spec.js` e2e tests assert the cards against the API's own values.

---

## 3. Realtime (Server-Sent Events)

**Why SSE instead of WebSockets?** The traffic is one-directional
(server → client notifications), the browser API reconnects by itself and sends
`Last-Event-ID`, it needs no extra dependency, and it travels over the same port
and proxy as the REST API.

```
POST /transactions ─▶ controller ─▶ Mongo
                            │
                            └─ publish(userId, 'transaction:created', { transaction, origin })
                                        │
       eventBus registry (per user) ────┴──▶ every open EventSource of that user
```

Implementation details worth knowing:

* **Per-user channels.** `eventBus.js` keeps `Map<userId, Set<client>>`; a user can
  never observe another user's events (asserted in `server/tests/realtime.test.js`).
* **Replay buffer.** The last 25 events per user are kept; a browser that
  reconnects sends `Last-Event-ID` and receives whatever it missed.
* **Heartbeats.** A `: ping` comment every 25 s keeps proxies from closing idle
  connections; comments are ignored by `EventSource`.
* **Echo suppression.** Each request carries `X-Client-Id` (a per-tab id kept in
  `sessionStorage`). The server returns it inside `event.origin.clientId`, and the
  provider ignores events that carry its own id – otherwise an optimistic row
  would be applied twice.
* **Graceful fallback.** If `EventSource` is unavailable or blocked, `useRealtime`
  switches the badge to *Auto-refresh* and polls every 15 s.

---

## 4. Mutations: optimistic with rollback

```js
addTransaction: async (data) => {
  const tempId = `temp-${createId()}`
  dispatch({ type: ACTIONS.ADD, payload: { ...data, id: tempId, optimistic: true } })
  try {
    const tx = await remote.createTransaction(data)     // POST /transactions
    dispatch({ type: ACTIONS.REPLACE, payload: { tempId, tx } })
    return tx
  } catch (err) {
    dispatch({ type: ACTIONS.DELETE, payload: tempId }) // rollback
    throw err                                           // caller shows a toast
  }
}
```

* Update: the previous row is kept and restored if `PATCH` fails.
* Delete: the row is removed immediately and re-inserted if `DELETE` fails.
* Bulk actions (`Add demo data`, guest-data import, wipe) always wait for the
  server, because the client cannot guess the ids the server will assign.

---

## 5. Failure modes the UI understands

| Situation | Detection | UI response |
|---|---|---|
| Browser offline | `navigator.onLine` + `online/offline` events | Red banner: “You are offline. Showing the data that was already loaded…” (changes sent when the connection returns) |
| API process stopped / wrong port | `NETWORK_ERROR` or failed `GET /health` poll | Amber banner “Back-end not reachable” with **Retry**; the shell keeps rendering |
| Token expired / invalidated | 401 on any authenticated request | Token dropped, toast “Your session expired – please sign in again”, login page shows an explanation |
| Token cannot be verified because the API is down | `GET /auth/me` network error | **Session is kept**; banner + Retry re-verifies and signs back in |
| Validation error | 422 `details[]` | Messages next to the matching form fields (`ApiError.fieldErrors`) |
| Rate limited | 429 `TOO_MANY_REQUESTS` | Toast with the server's message |
| Server bug | 5xx | Toast with message + `requestId`; GETs are retried twice with backoff |
| Slow/hung request | 12 s timeout (`VITE_REQUEST_TIMEOUT_MS`) | `TIMEOUT` error → banner, no infinite spinner |

---

## 6. Configuration

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `VITE_API_URL` | client | `/api/v1` | API base path (dev: proxied by Vite to `:4000`) |
| `API_PROXY_TARGET` | Vite config | `http://localhost:4000` | Where the dev proxy forwards `/api` |
| `VITE_REQUEST_TIMEOUT_MS` | client | `12000` | Per-request timeout |
| `PORT` | server | `4000` | HTTP port |
| `MONGODB_URI` | server | *(empty)* | Empty ⇒ in-memory MongoDB + demo seed |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | server | dev fallback / `7d` | Token signing |
| `CORS_ORIGIN` | server | `http://localhost:5173` | Comma-separated allow-list |
| `SERVE_CLIENT`, `CLIENT_DIST` | server | prod: on | Serve `client/dist` from the API process |
| `RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX` | server | `300`, `20` per 15 min | Tunable so tests can raise them |

---

## 7. Verification map

| Claim | Proof |
|---|---|
| Client sends the query the server expects | `client/src/test/week4-integration.test.jsx` (`toApiQuery`, `useServerTransactions`) |
| Pagination/filters/search/sort really run on the server | `e2e/tests/data-flow.spec.js` (assertions against `GET /transactions` meta) |
| Charts show aggregation results | `e2e/tests/data-flow.spec.js` (compared with `GET /stats/summary`) |
| A change on device A reaches device B without a reload | `e2e/tests/realtime.spec.js` (two browser contexts) |
| Own events are not applied twice | `server/tests/realtime.test.js` (`origin.clientId`) + client integration test |
| Events never leak between accounts | `server/tests/realtime.test.js` (isolation test) |
| Optimistic rollback works | `client/src/test/week4-integration.test.jsx` (422 and 5xx cases) |
| Offline / API-down / expired-session behaviour | `e2e/tests/settings-and-errors.spec.js` |
| Production single-port mode (static + SPA fallback) | `server/tests/clientApp.test.js` |
| Settings talk to the new endpoints | `e2e/tests/settings-and-errors.spec.js` |

Counts at the time of writing: **server 76**, **client 78**, **e2e 28** — all green.

---

## 8. Deliberate trade-offs

* **Context + reducer instead of Redux/Zustand.** The state is one list plus auth; a
  reducer keeps it testable without a dependency (the reducer is exported and unit-tested).
* **Full list in memory *and* a paged API call.** The paged call keeps the screen
  light and honest; the full copy keeps the detail route and the JSON export simple.
  Both are invalidated by the same `version` counter, so they cannot drift.
* **SSE, not WebSockets**, for the reasons in §3.
* **In-memory MongoDB hygiene.** Long test sessions can leave `mongo-mem-*`
  directories behind, which makes the next `mongod` fail with an `fassert()`
  error; the troubleshooting table in the README documents the one-line fix.
* **No service worker offline queue.** Out of scope for this week; the banner tells
  the user instead of pretending the change was saved.
* **Settings page kept small** (profile, password, export, wipe, diagnostics) –
  it exists to prove the endpoints are wired, not to become a second app.
