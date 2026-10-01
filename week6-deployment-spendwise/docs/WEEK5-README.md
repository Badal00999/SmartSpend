# SpendWise — Week 5: Testing, Debugging and Optimization

**Author:** Badal · **Project:** Badal00999/SmartSpend · **Evidence date:** 26 September 2026

This is a self-contained copy of the Week 4 app. Week 2/3/4 folders do not need to run alongside it. The Week 5 work is reproducible boundary testing, fixes to validation and request handling, confidential request logging, and a measured database-index optimization—not a UI redesign.

## Verified results

| Layer | Fresh baseline | Final | New tests |
|---|---:|---:|---:|
| Server: Vitest + Supertest + MongoDB | 76 passing | 100 passing | 24 |
| Client: Vitest + Testing Library | 78 passing | 92 passing | 14 |
| Chromium: Playwright | 28 inherited tests, not rerun before edits | 30 passing | 2 |

Clean-room ZIP verification also passed: locked setup, all 100 server + 92 client tests, and build (see `docs/evidence/cleanroom.log`). Browser tests were run in the working project, not repeated in the extracted copy.

Final total: **222 passing tests**, including **40 new tests**. New failing tests were run before fixes: 14 server-validation failures, 2 transport failures, 3 form-validation failures and 4 logging failures. These are failing assertions, **not 23 independent bugs**. Query-plan tests were added after profiling.

Final source coverage (V8; unit/integration runs only, not Playwright): server **89.72% lines / 72.83% branches**; client **79.77% lines / 67.83% branches**. Coverage is diagnostic, not proof of correctness. Client lint: 0 errors/warnings. Production build: passed.

## 1. Local setup (Windows / VS Code)

Use Node **22.12+ or 24 LTS**, Git and an internet connection for first-time package, browser and MongoDB-binary downloads. This run used Node 20.20.2 on Linux; Windows execution has not been verified here. Older Node 18 is not a supported recommendation for this Vite stack.

Open this folder in VS Code, then PowerShell:

```powershell
npm.cmd run setup
npm.cmd run dev
```

`setup` uses `npm ci` for the committed package locks (client/server/e2e). No root `npm install` is needed. Open **http://localhost:5173/login**, choose **Try the demo account**, or use `demo@spendwise.app` / `Demo1234`. API docs: http://localhost:4000/api/docs. Stop with Ctrl+C.

No `.env` is required for the demo: an ephemeral MongoDB instance starts automatically. Data resets on restart. For persistent data, configure `MONGODB_URI` in **server/.env**; client `VITE_*` settings belong in **client/.env**. A root `.env` is not automatically loaded by the child packages. Never commit real credentials.

To serve the built app on a single port in PowerShell:

```powershell
npm.cmd run build
$env:SERVE_CLIENT = "true"
npm.cmd start
# Open http://localhost:4000; stop with Ctrl+C, then:
Remove-Item Env:SERVE_CLIENT
```

This is a local built-client smoke mode, not a secure public deployment. A real production deployment must also set NODE_ENV=production, a private JWT_SECRET of at least 32 characters, persistent MongoDB and appropriate CORS/TLS settings.

## 2. Run the test suite

Stop running app instances before E2E. The E2E config **refuses to reuse an existing port**, preventing a green result against the wrong project. API tests use a fresh database per test file and clear collections after every test. Playwright creates isolated accounts.

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run lint
npm.cmd run build

# Browser installation, once:
cd e2e
npx.cmd playwright install chromium
cd ..
npm.cmd run test:e2e

# Measured old-index/new-index comparison:
npm.cmd run profile

# Before sharing generated logs:
npm.cmd run evidence:sanitize
```

On Linux, use `npm` / `npx` instead of `npm.cmd` / `npx.cmd`; Chromium may also require `cd e2e && npx playwright install --with-deps chromium` (system package installation needs permission).

Focused runs:

```powershell
npm.cmd --prefix server test -- tests/week5-validation.test.js
npm.cmd --prefix server test -- tests/week5-query-plan.test.js
npm.cmd --prefix server test -- tests/week5-logging.test.js
npm.cmd --prefix client test -- src/test/week5-api.test.js
npm.cmd --prefix client test -- src/test/week5-form.test.jsx
npm.cmd --prefix e2e test -- tests/week5-regressions.spec.js
```

## 3. Test strategy and rationale

- **Boundary/value tests:** impossible dates, valid leap day, reversed date/amount ranges, zero bounds and literal regex search. Calendar correctness matters because transactions drive financial summaries.
- **API + database integration:** POST/PATCH/bulk invalid-date requests must return 422 **and leave data unchanged**. Query validation must prevent invalid dates reaching MongoDB.
- **Component tests:** error-to-input accessibility, focus on first invalid field, blocking invalid submissions, trimming titles and numeric amount conversion.
- **Transport unit tests with fake timers/fetch:** bounded retries, body-read timeout, cancellation during backoff, 204 responses, malformed JSON and authenticated-only expiry notification. These intentionally simulate failure conditions; they are not real network timing measurements.
- **Browser tests:** valid leap-day input through the real UI persists after reload; an impossible date sent through same-origin browser fetch is rejected by the real API with no inserted records. Inherited tests cover CRUD, two-browser SSE, settings and recovery. Some inherited error tests deliberately intercept requests to simulate outages/401s; do not describe the entire suite as unmocked.
- **Query-plan guard:** assert no blocking SORT, 20 examined documents for 20 results and stable disjoint pages. Do not use noisy millisecond limits as unit-test assertions.
- **Confidential logging:** capture actual middleware output for ordinary, repeated, mixed-case and encoded query parameters. No query values or Referer are logged.

See [TEST-MATRIX.md](docs/TEST-MATRIX.md) for requirement/risk mapping and [TEST-INVENTORY.csv](docs/TEST-INVENTORY.csv) for every Vitest assertion, result and rationale.

## 4. Concrete fixes

| Case | Reproduction | Root cause | Fix / evidence |
|---|---|---|---|
| D1 Calendar/ranges | POST date `2025-02-29` returned 201; invalid month filter was not rejected by the schema | `Date` normalises invalid days; query schema checked format only | Round-trip calendar validation, ordered range rules and front-end parity. `red-server.log`, `red-form.log`, final results |
| D2 Body timeout | Headers arrive but JSON body never finishes; at 60 ms a 50 ms request is still pending | Timer cleared after `fetch`, before `res.json()` | Keep timeout active through body read; preserve TIMEOUT classification. `red-client.log` |
| D3 Cancelled retry | Abort during 250 ms backoff still invokes fetch twice in the transport test | Backoff was not abort-aware | Abortable delay plus loop entry check; final test expects exactly one invocation |
| D4 Token in log | SSE access log included `?token=…` | Morgan dev/combined format logs original URL | Route-only structured formatter, omit Referer, keep request ID. `red-logging.log`, final E2E log |

Detailed reproduction, changed files, regression assertions and limitations: [DEBUGGING.md](docs/DEBUGGING.md). Original relevant source snapshots and a unified patch are included under `docs/evidence/`.

## 5. Measured optimization

Default API sort is `{ date: -1, _id: -1 }`. The old `{ user: 1, date: -1 }` index could not satisfy the complete sort. The schema now includes **`{ user: 1, date: -1, _id: -1 }`**.

| Metric | Old index | New index |
|---|---:|---:|
| Documents examined | 10,000 | 20 |
| Keys examined | 10,000 | 20 |
| Blocking SORT | Yes | No |
| Returned records | 20 | 20 |
| Median local query time | 13.369 ms | 0.922 ms |
| p95 local query time | 14.525 ms | 1.206 ms |

Method: dedicated ephemeral DB, 20,000 deterministic records, two owners, 10,000 records each, 365 dates, page 1 / limit 20, 5 warmups + 30 measured samples per index. Same ordered IDs before/after. Old index is reconstructed by the benchmark, then replaced; this is **not two HTTP load tests**. No timing claim for the whole dashboard, production or concurrent traffic is made. The old-first/new-second order can bias timing through cache effects; structural explain evidence is stronger than the local milliseconds.

Run `npm run profile` to regenerate raw samples and both explain plans in `docs/evidence/performance/`. See [PERFORMANCE.md](docs/PERFORMANCE.md) for trade-offs and persistent-database migration guidance.

## 6. Evidence map

- `docs/evidence/baseline-tests.log`: unchanged Week 4 server/client baseline.
- `docs/evidence/red-*.log`: genuinely failing pre-fix tests (intentionally failing historical evidence).
- `docs/evidence/final-server.log`, `final-client.log`, `final-e2e.log`: final executed suites.
- `docs/evidence/server-results.json`, `client-results.json`: machine-readable individual assertions.
- `docs/evidence/*-coverage/coverage-summary.json`: source coverage; unexecuted branches remain visible.
- `docs/evidence/performance/`: raw samples, environment details and MongoDB explain plans.
- `docs/evidence/screenshots/leap-day-ui.png`: new Week 5 browser evidence, not a reused Week 4 image.
- `docs/evidence/environment-*.log`: tooling failures separated from product defects.
- `docs/ci/week5.yml`: optional CI template, **not yet executed on GitHub**. Copy into the repository root `.github/workflows/` to activate.

Logs have token redaction and ANSI cleanup. The `.gitignore` intentionally includes sanitized evidence logs while excluding dependencies, real `.env`, builds and Playwright raw traces. The old `docs/screenshots/`, `docs/video/`, `docs/INTEGRATION.md` and `docs/WEEK4-README.md` are historical Week 4 references, not Week 5 test evidence.

## 7. Troubleshooting and limits

- **Missing folder/package.json:** open this project folder, not the SmartSpend repo root and not its `client/` folder, for root commands.
- **Port 4000/5173 busy:** stop the previous app with Ctrl+C. E2E intentionally refuses existing servers.
- **Chromium missing shared libraries:** install Playwright system dependencies. The captured initial E2E launch failure was infrastructure, not an app regression.
- **MongoDB says disk space below 524,288,000 bytes:** stop test/DB processes, inspect temporary `mongo-mem-*` directories, remove only confirmed stale test directories and retry. Do not delete a running database or lower safety limits. This sandbox had a 993 MB `/tmp` volume.
- **PowerShell execution policy error:** use `npm.cmd` / `npx.cmd` as above; no system-wide policy change is needed.
- **Chart warnings in jsdom:** its fake ResizeObserver has no real layout. Assertions still pass; browser tests exercise real rendering. These warnings are retained, not hidden.
- Tests cover Chromium only. No mobile/Safari/Firefox certification, public deployment, soak/load test or real-user latency measurement was performed. Other sort orders, substring search, deep pagination and countDocuments remain potential profiling targets.
- No claimed 30–35-hour time sheet: that is the assignment estimate, not a measured execution duration.

## Submission

Upload the Week 5 Word report in the portal, use `https://github.com/Badal00999/SmartSpend` after pushing `week5-testing-optimization/`, and paste the supplied description. The ZIP contains source, tests, configuration, README, debugging reports and sanitized logs. The portal shown accepts Word files, not ZIP; keep the ZIP as the required compressed deliverable and share it through an allowed attachment/link if requested.
