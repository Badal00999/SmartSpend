# Test strategy / requirement traceability

## Selection method

Start with the inherited suites (server 76; client 78; browser 28). Run server/client before edits, then inspect input boundaries, request lifecycle and query plans rather than adding duplicate happy-path tests. The final server/client JSON files preserve every assertion name, status and runtime; TEST-INVENTORY.csv adds file-level risk rationale to all 192 Vitest cases. This is not a claim that all possible inputs have been tested.

| New test file | Cases | Test rationale and expected evidence |
|---|---:|---|
| server/tests/week5-validation.test.js | 18 | 3 impossible write dates must fail; real leap day must pass; 3 invalid query dates rejected by list/summary schemas; reversed dates rejected by both; future/equal query endpoints accepted; reversed amounts rejected; zero range retained; regex input remains literal; POST rejects without insert; PATCH rejects without update; bulk payload rejects atomically at validation; 3 HTTP query endpoints consistently return 422. |
| server/tests/week5-query-plan.test.js | 2 | Model declares full sort index; real explain has no SORT/20 documents examined and equal-date pages remain disjoint with unchanged API serialization. Performance must not break correctness. |
| server/tests/week5-logging.test.js | 4 | Normal token, duplicated/mixed-case key, encoded key and arbitrary query value never enter request logs. Each also supplies a sensitive Referer and requires route/status retention. |
| client/src/test/week5-api.test.js | 7 | Stalled response body respects deadline; abort stops retry invocation; default POST not retried; GET capped at three attempts; 204 skips JSON; malformed JSON classified and timer cleared; only authenticated 401 signals expiry. |
| client/src/test/week5-form.test.jsx | 7 | 4 malformed/impossible calendar values rejected; valid leap day accepted; missing date prevents submission with focus/ARIA linkage; valid form trims title and converts amount. |
| e2e/tests/week5-regressions.spec.js | 2 | Real UI/API leap day persists after reload; bypassing native date input via browser fetch still yields backend validation and no database write. |
| **Total new** | **40** | Tests target concrete risks; parameterized cases are counted individually. |

## Inherited regression coverage retained

| Layer / files | Risk coverage |
|---|---|
| server auth, transactions, stats | Authentication, ownership isolation, CRUD, filters, pagination, aggregate totals, validation and status contracts. |
| server app, clientApp, realtime | Health/security envelopes, SPA/static routing, SSE user isolation and replay. |
| client api, context, week4-integration, week4-ui | API envelopes, state changes, optimistic rollback, data hooks, connection banners and settings. |
| client App, TransactionForm, format, stats | Route navigation, forms, formatting and local calculations. |
| e2e auth, crud, data-flow, realtime, settings-and-errors | Browser/API integration, persistent CRUD, two-browser sync, profile/password/export/delete, deliberately simulated network/401 recovery. |

## Execution and interpretation

- Server unit tests share the server harness, so even pure-schema files incur an ephemeral DB setup. This is overhead, not database dependence of those pure assertions.
- After each server test, collections are cleared; test files run sequentially. Query plan tests await index initialization. No persistent database is used.
- Client DOM tests use jsdom and Testing Library; transport tests intentionally mock fetch and fake timers. No timing claim is drawn from fake timers.
- Playwright uses real Chromium with one worker and fresh accounts. It starts its own API/client on ports 4000/5173, refuses to reuse existing servers, and forces an ephemeral test database.
- Coverage reports include source files that were not imported: server startup and client entry points have 0% unit coverage but are exercised by E2E. E2E coverage is not merged into the V8 percentages.
- Remaining low unit coverage includes DashboardPage (47.77% lines), SettingsPage (62.96%), ErrorBoundary (25%) and some chart renderers. Browser success does not remove those unit-coverage gaps. ErrorBoundary fallback and detailed dashboard edge states are useful next targets.
- Whole-suite final results: server 100/100; client 92/92; Chromium 30/30. Historical red logs intentionally show failures. Environment launch/disk failures are retained separately, not silently discarded or counted as app defects.

## Release checks

1. npm run setup succeeds from the packaged project.
2. npm test, npm run test:coverage, npm run lint, npm run build pass.
3. Install browser/dependencies and run npm run test:e2e with ports free.
4. npm run profile preserves ordered IDs and removes blocking SORT.
5. npm run evidence:sanitize, then inspect logs and scan for tokens/secrets.
6. Package source and sanitized evidence; exclude dependencies, build output, raw traces, .env and local secrets.

The optional CI template automates these commands but has not been run on GitHub in this workspace; do not label local results as a CI pass.
