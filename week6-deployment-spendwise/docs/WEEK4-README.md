> Historical Week 4 reference. For Week 5 results, setup, fixes and limitations use the project-root README and docs/DEBUGGING.md.

# SpendWise – Full-Stack Expense Tracker

> **YUVA Internship · Junior Full Stack Developer · Week 4 – Integrating Front-End with Back-End**
> Part of **SmartSpend** ([Badal00999/SmartSpend](https://github.com/Badal00999/SmartSpend)).
> Week 1 = plan & architecture · Week 2 = React front-end · Week 3 = REST API · **Week 4 = this folder: the two halves are now one application.**

SpendWise is an expense tracker that works in two modes with the same interface:

| Mode | Where the data lives | What you get |
|---|---|---|
| **Guest** (no account) | `localStorage` in the browser | The app works offline and with zero setup (Week 2 behaviour) |
| **Signed in** | MongoDB through the SpendWise REST API | Server-side statistics, pagination & search, multi-device sync, live updates |

The interesting part of this week is not either half on its own – it is the **glue**: one command starts both, one port can serve both, and a change made on your phone appears on your laptop without a refresh.

---

## 1. What was integrated (Week 4 scope)

| # | Requirement from the task | How this folder satisfies it |
|---|---|---|
| 1–2 | Integrate front-end with back-end services; dynamic data processing and **real-time interaction** | Every screen reads from the API when signed in **and** a Server-Sent Events stream pushes changes made by any other tab/device into the UI instantly (`GET /api/v1/events/stream`). |
| 3 | ZIP with **both** front-end and back-end source + updated README | `client/` + `server/` (+ `e2e/`), and this README. |
| 4 | Detailed instructions for setting up and running the integrated app locally | §5 *Quick start* – `npm run setup`, `npm run dev`, plus a single-port production mode (`npm run build && npm start`). |
| 5 | Short **video demonstration** (screen capture) **or** deployment link | `docs/video/spendwise-week4-demo.webm` (≈1 minute, captioned) + 9 stills in `docs/screenshots/`. The recorder script is `e2e/record-demo.mjs`, so the video can be regenerated. |
| 7 | Asynchronous data fetching and **proper state management** | React Context + reducer store, request-key based loading states, `AbortController` cancellation, optimistic updates with rollback, realtime invalidation. |
| 8 | Test API endpoints from the UI and **handle exceptions gracefully** | Offline banner, "back-end not reachable" banner with retry, session-expiry handling, per-field 422 messages, 429/5xx messages, request timeouts – covered by tests. |
| 9 | Seamless data flow across layers, validated from both ends | 3 test layers: server tests (76), client tests (78), and **28 end-to-end browser tests** that assert the UI against the API's own responses. |
| 10 | Document the challenges and solutions | §11 below and `docs/INTEGRATION.md`. |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Browser (React 19)                              │
│                                                                              │
│  Pages            Dashboard · Transaction detail · Settings · Auth · Convert │
│  State            AuthContext ─┐                                             │
│  (Context+Reducer)             └─ TransactionsContext ── useRealtime (SSE)    │
│  Data hooks       useServerTransactions · useDashboardStats                   │
│  Transport        src/services/api.js  (fetch + JWT + timeout + retry)        │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │  HTTPS/JSON  (REST, JWT bearer)              │  text/event-stream
                │  /api/v1/**                                  │  /api/v1/events/stream
┌───────────────▼──────────────────────────────────────────────▼───────────────┐
│                       Express 5 API (Node.js, ESM)                           │
│  Middleware   requestId → helmet → CORS → rate-limit → morgan → json body    │
│  Routes       /auth · /transactions · /stats · /events · /meta · /health      │
│  Validation   Zod schemas (body, query, params) → 422 with per-field details  │
│  Auth         requireAuth (Bearer) · requireAuthSse (?token= for EventSource) │
│  Realtime     eventBus: per-user subscriber registry + replay + heartbeats    │
│  Errors       central errorHandler → { success:false, error:{code,message} }  │
│  Docs         Swagger UI at /api/docs · OpenAPI at /api/v1/openapi.json       │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │  Mongoose 9
        ┌───────▼────────┐
        │    MongoDB     │  Users (bcrypt hash) · Transactions (owner-scoped)
        │  (or in-memory)│  Aggregation pipelines for all dashboard statistics
        └────────────────┘
```

### Request lifecycle of one dashboard load (signed in)

1. `AuthContext` verifies the stored JWT with `GET /auth/me`; a 401 drops the token, a network error keeps it and shows the "back-end unreachable" banner.
2. `TransactionsContext` switches its source to the API and fetches every page (used for totals/export).
3. `useDashboardStats()` fires `GET /stats/summary`, `/stats/by-category` and `/stats/monthly?months=6` in parallel – MongoDB aggregation does the maths.
4. `useServerTransactions()` fires `GET /transactions?page&limit&q&type&category&sort` for exactly the rows on screen.
5. `useRealtime()` keeps an `EventSource` open; any mutation on any device bumps `version`, which re-runs steps 3–4 without a spinner.

---

## 3. Integration points (the actual glue)

| Client side | Talks to | Notes |
|---|---|---|
| `services/api.js` | *all* endpoints | Adds `Authorization`, `X-Client-Id`, timeout + retry, converts error envelopes into typed `ApiError`, dispatches `spendwise:unauthorized` on 401. |
| `services/transactionsApi.js` | `/transactions*` | Builds query strings, normalises records (`createdAt` → ms), bulk import, bulk delete. |
| `services/statsApi.js` | `/stats/*`, `/meta/*`, `/health` | Dashboard numbers and the connection banner. |
| `services/eventsApi.js` | `/events/stream` | Wraps `EventSource` (token via query string, because EventSource cannot set headers) and maps event names. |
| `hooks/useServerTransactions.js` | `/transactions` (paged) | Server-side search/filter/sort/page; identical shape in guest mode. |
| `hooks/useDashboardStats.js` | `/stats/*` | API in signed-in mode, local maths in guest mode – same object shape. |
| `hooks/useRealtime.js` | SSE | Status (`live`/`polling`/`offline`) + version counter; falls back to a 15 s poll if `EventSource` is unavailable. |
| `context/TransactionsContext.jsx` | — | Optimistic mutations with rollback, echo suppression (ignores its own events), silent refresh. |
| `components/feedback/SyncBadge.jsx` | — | Shows *Live* / *Connecting* / *Auto-refresh* / *Offline* / *Local only* and the last sync time. |
| `components/feedback/ConnectionBanner.jsx` | `/health` | Retry + re-verify session once the API is reachable again. |

Server side, each mutation publishes an event (`transaction:created|updated|deleted|imported|cleared`) through `src/realtime/eventBus.js`; events are namespaced per user, replayed for reconnecting clients (`Last-Event-ID`) and kept alive with 25 s comment heartbeats.

---

## 4. Folder structure

```
spendwise-fullstack/
├── client/                     # React 19 + Vite 8 + Tailwind v4 (Week 2 app, Week 4 integration)
│   ├── src/components/         # UI, transactions, charts, feedback (SyncBadge, ConnectionBanner)
│   ├── src/context/            # AuthContext, TransactionsContext, Theme, Toast
│   ├── src/hooks/              # useServerTransactions, useDashboardStats, useRealtime, useOnlineStatus…
│   ├── src/pages/              # Landing, Dashboard, Detail, Settings, Auth, Converter, 404
│   ├── src/services/           # api, transactionsApi, statsApi, eventsApi, storage, userApi…
│   └── src/test/               # 78 Vitest tests (8 files)
├── server/                     # Express 5 + MongoDB (Week 3 API + Week 4 realtime/serving)
│   ├── src/routes|controllers|models|validators|middleware
│   ├── src/realtime/eventBus.js# SSE subscriber registry + replay buffer
│   ├── src/clientApp.js        # serves client/dist in production (SPA fallback)
│   ├── tests/                  # 76 Vitest + Supertest tests (6 files)
│   └── docs/API.md             # Markdown API reference (endpoints, params, examples)
├── e2e/                        # 28 Playwright tests against the real stack
│   ├── tests/*.spec.js         # auth · crud · data-flow · realtime · settings-and-errors
│   └── record-demo.mjs         # regenerates the demo video + screenshots
├── docs/
│   ├── INTEGRATION.md          # integration points, data flow, decisions, challenges
│   ├── video/spendwise-week4-demo.webm
│   └── screenshots/01…09.png
├── scripts/setup.mjs           # npm run setup  (installs all three packages)
├── scripts/dev.mjs             # npm run dev    (starts API + client together)
├── .env.example
└── package.json                # one place for every command
```

---

## 5. Quick start

**Requirements:** Node.js ≥ 18 (tested on 20) and npm. *No database installation is needed* – when `MONGODB_URI` is empty the API starts an in-memory MongoDB and seeds it with demo data, so the project runs on any machine.

```bash
# 1. install everything (client, server, e2e)
npm run setup

# 2. run the integrated app (API + web app together)
npm run dev
```

Then open **http://localhost:5173/login** and press **“Try the demo account”** — email `demo@spendwise.app`, password `Demo1234`.

| URL | What it is |
|---|---|
| http://localhost:5173 | The React app (Vite dev server, proxies `/api` to the API) |
| http://localhost:4000/api/docs | Swagger UI – every endpoint, “Try it out” |
| http://localhost:4000/api/v1/health | Health check (`{ status, uptime, database }`) |

### Production mode (one port, no proxy)

```bash
npm run build     # builds the React app into client/dist
npm start         # the API serves the UI *and* the API on http://localhost:4000
```

`SERVE_CLIENT=true` (the default when `NODE_ENV=production`) makes Express serve `client/dist` with long-lived caching for the hashed assets and an SPA fallback for client-side routes.

### Using a real database

```bash
cp .env.example .env
# set MONGODB_URI=mongodb://127.0.0.1:27017/spendwise   (or an Atlas connection string)
npm --prefix server run seed     # loads the demo account + 32 transactions
```

### Tests

```bash
npm test          # server (76) + client (78)
npm run test:e2e  # 28 Playwright tests – needs `npx playwright install chromium` once
```

`npm run test:e2e` starts the API and the dev server automatically and drives a real Chromium browser against them.

### Demo video

The recording in `docs/video/` is produced by a script, not by hand:

```bash
cd e2e && npm run video   # writes docs/video/*.webm and docs/screenshots/*.png
```

---

## 6. Feature tour (what to look at)

| Screen | Integration highlight |
|---|---|
| **Dashboard** | Stat cards & charts come from `/stats/*` (MongoDB aggregations). The *Live* pill means the SSE stream is open. Filters, search, sort and page number all live in the URL and are sent to the API. |
| **Add / edit / delete** | Optimistic: the row appears instantly, is confirmed by the API, and rolls back with a toast if the server rejects it. |
| **Second browser tab / phone** | Sign in to the same account: actions in one window appear in the other without refreshing. |
| **Settings** | `PATCH /auth/me` (name, currency), `PATCH /auth/password`, JSON export, and a danger-zone `DELETE /transactions` that wipes the account with one request. |
| **Swagger UI** | The same OpenAPI 3.0 document the client was written against. |
| **Stop the API** | The banner explains what happened and offers *Retry*; your session is **kept**, so retrying signs you straight back in. |
| **Token expires** | The app signs you out with “Your session expired…” on the login page instead of failing request after request. |

---

## 7. API surface used by the client

| Method & path | Used by |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Auth page |
| `GET /auth/me`, `PATCH /auth/me` | Session restore, Settings (profile) |
| `PATCH /auth/password` | Settings (security) |
| `GET /transactions` (`page, limit, type, category, payment, from, to, q, minAmount, maxAmount, sort`) | Dashboard list (server-side) |
| `POST /transactions`, `POST /transactions/bulk` | Add form, demo data, guest-data import |
| `GET/PATCH/DELETE /transactions/:id` | Detail page, edit, delete |
| `DELETE /transactions` | Settings danger zone |
| `GET /stats/summary`, `/stats/by-category`, `/stats/monthly` | Dashboard cards & charts |
| `GET /events/stream`, `GET /events/status` | Realtime sync + diagnostics |
| `GET /meta/categories`, `GET /health` | Reference data, connection banner |

Full parameter and response documentation: **[`server/docs/API.md`](server/docs/API.md)**, Swagger UI at `/api/docs`, and the Postman collection in `server/docs/SpendWise-API.postman_collection.json`.

---

## 8. Data model (shared by both weeks)

```js
User          { name, email (unique), passwordHash (bcrypt, 12 rounds), currency, role, timestamps }
Transaction   { user → User, title, amount > 0, type: 'income'|'expense',
                category: food|transport|shopping|bills|entertainment|health|education|travel|salary|freelance|other,
                payment: cash|card|upi|bank|wallet, date, notes, timestamps }
```

The client's Week 2 fields map 1:1 onto the API payload (`services/transactionsApi.js#toPayload`), which is why guest data can be imported into an account with `POST /transactions/bulk` without any transformation.

---

## 9. Security & reliability (unchanged from Week 3, exercised from the UI)

* bcrypt (12 rounds) password hashing; login answers the same for a wrong email and a wrong password.
* JWT bearer tokens (`issuer: spendwise-api`, 7-day expiry) with issuer verification; SSE accepts the token as a query parameter because `EventSource` cannot set headers.
* Zod validation on body/query/params → `422 { details: [{ field, message }] }`, rendered next to the matching form field.
* Every query is scoped to the authenticated user, so another account's id returns `404`, never data.
* Helmet, CORS allow-list, 100 kB body limit, global (300/15 min) and auth (20/15 min) rate limits — both configurable through `RATE_LIMIT_*` env vars for tests.
* Central error handler normalises Mongoose/JSON/CORS errors; `X-Request-Id` is echoed on every response and appears in `meta.requestId` for support.
* Abort on unmount + request timeouts (12 s) + retry with backoff for idempotent GETs.

---

## 10. Test evidence

| Suite | Command | Result |
|---|---|---|
| Server (Vitest + Supertest + mongodb-memory-server) | `npm --prefix server test` | **76 passing** (transactions 24, auth 15, stats 9, app 8, realtime 13, static serving 7) |
| Client (Vitest + Testing Library) | `npm --prefix client test -- --run` | **78 passing** (8 files, incl. 13 integration + 17 UI tests added this week) |
| End-to-end (Playwright, Chromium, real API + real DB) | `npm run test:e2e` | **28 passing** (auth 7, CRUD 5, data flow 6, realtime 3, settings & errors 7) |
| Lint | `npm --prefix client run lint` | 0 errors, 0 warnings |

The e2e suite is the honest proof of integration: it never mocks the API, and its assertions compare what the screen shows with what `GET /stats/*` and `GET /transactions` return.

---

## 11. Challenges and how they were solved

| Challenge | Symptom | Solution |
|---|---|---|
| **Browser `EventSource` cannot send headers** | The SSE endpoint kept answering `401` because the JWT never arrived. | Added `requireAuthSse`, which accepts `?token=` as well as the `Bearer` header, plus tests for both. |
| **Realtime echo of your own write** | A new row appeared twice (once optimistically, once from the SSE event). | Every request carries an `X-Client-Id` header; the server includes it in the event's `origin`, and the client ignores events from its own tab. |
| **CORS rejected the browser origin** | `CORS: origin http://127.0.0.1:5173 is not allowed` in the e2e run. | Playwright now drives `http://localhost:5173` and the e2e server config allows both spellings; production stays locked to `CORS_ORIGIN`. |
| **Loading states caused cascading renders** | Lint (React compiler rules) flagged `setState` inside effects in the new data hooks. | `loading` is **derived** from a request key (`filters\|page\|version\|refresh`) instead of being toggled in an effect – fewer renders and no stale rows. |
| **E2E suite tripped the rate limiter** | After ~20 tests: `TOO_MANY_REQUESTS` while registering test accounts. | Limits moved into `env` (`RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX`); the e2e config raises them, production keeps the strict defaults. |
| **In-memory MongoDB died mid-run** | `Mongod internal error (fassert() failure)` once several test processes had run. | `mongodb-memory-server` data directories are wiped between runs (`/tmp/mongo-mem-*`); documents the start commands so a fresh machine never sees it. |
| **A network blip logged the user out** | `GET /auth/me` failing offline dropped the session. | Auth now distinguishes *401* (token really invalid → sign out) from *unreachable* (keep token, show banner, re-verify on retry or reload). |
| **Timestamps and filters drifted between screens** | Charts counted rows that the list had filtered out. | The list is paged/filtered **by the server**; the charts come from aggregations over the whole account – the two can no longer disagree (asserted in `data-flow.spec.js`). |
| **Screenshots/video were stale after UI changes** | Manual screenshots age quickly. | `e2e/record-demo.mjs` regenerates the video and all stills from the live app, with on-screen captions. |

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot reach the SpendWise API. Is the back-end running?` | Start the API (`npm run dev` starts both). Check http://localhost:4000/api/v1/health. |
| `Port 4000/5173 already in use` | `PORT=4100 npm start` and `API_PROXY_TARGET=http://localhost:4100 npm --prefix client run dev`. |
| Demo login fails | With `MONGODB_URI` empty the database is in-memory and re-seeded on start; with a real database run `npm --prefix server run seed`. |
| `npm test` cannot download a MongoDB binary | It caches to `node_modules/.cache/mongodb-memory-server`; on a locked-down network set `MONGODB_URI` to a local MongoDB and run the suites there. |
| Live pill says “Auto-refresh” | `EventSource` was blocked (proxy/ad-blocker). The app falls back to polling every 15 s – everything still works. |
| Playwright complains about a missing browser | `npx playwright install chromium` (once per machine). |
| `Mongod internal error (fassert() failure)` from the in-memory database | Left-over data directories from a killed test run: delete them (`rm -rf /tmp/mongo-mem-*` on Linux/macOS, `del %TEMP%\mongo-mem-*` on Windows) and re-run. |

---

## 13. Internship deliverable mapping

| Task element | Where it lives |
|---|---|
| Compressed project with both source trees | `SpendWise-Week4-FullStack.zip` (`client/`, `server/`, `e2e/`, `docs/`) |
| Updated README describing the integration | this file + `docs/INTEGRATION.md` |
| Setup/run instructions | §5, `scripts/setup.mjs`, `scripts/dev.mjs`, `.env.example` |
| Video demonstration | `docs/video/spendwise-week4-demo.webm`, stills in `docs/screenshots/` |
| Challenges & solutions | §11 + `docs/INTEGRATION.md` |
| GitHub | https://github.com/Badal00999/SmartSpend → `week4-fullstack-spendwise/` |

---

## 14. Credits & licence

Built by **Badal** ([Badal00999](https://github.com/Badal00999)) for the YUVA internship. MIT licensed. Exchange-rate data in the converter comes from the public [Frankfurter](https://frankfurter.dev) API; the guest profile card uses [DummyJSON](https://dummyjson.com).
