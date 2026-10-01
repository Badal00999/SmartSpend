# Week 6 status — final

## Completed locally (before owner deployment)

- Separate Week 6 source copy preserved; `week5-testing-optimization/` and `week3-backend-spendwise-api/` unchanged.
- Production fails fast without a MongoDB URI, with a weak/example secret, or with non-HTTPS/wildcard CORS origins. `RENDER_EXTERNAL_URL` is used automatically if no explicit `CORS_ORIGIN` is set.
- `/api/v1/ready` pings MongoDB and returns 200/503 with `no-store`; `/health` remains liveness only.
- Production Helmet CSP enabled with explicit public API connect destinations; Swagger/OpenAPI disabled in production.
- Missing production SPA build is a hard startup failure, not a deceptively healthy API-only deployment.
- Shared demo-account login button removed from production builds; register a private account (hosted DB is not seeded with known credentials).
- SSE streams closed before `server.close()` waits for in-flight HTTP; graceful shutdown verified with an open SSE connection.
- Render deployment scripts (`deploy:build`, `deploy:start`) and optional Blueprint included.
- Detailed deployment guide, maintenance runbook, and project-reflection draft written with concrete historical examples.

## Test results (local verification only)

| Suite | Count | File count | Notes |
|---|---|---|---|
| Server | 116 passed | 10 files | 100 inherited Week 5 + 16 new Week 6 production/readiness cases |
| Client | 92 passed | 10 files | Inherited Week 4/5 suite unchanged |
| Chromium E2E | 30 passed | 1 file | Same-origin browser regressions + real-time/stream checks |
| Production smoke (Node + temp DB) | 5 checks passed | 1 script | CRUD, DB survival across API restart, shutdown with open SSE |
| Optional Chromium HTTPS smoke | 5 checks passed | 1 script | Built login/dashboard, CSP clean, demo button hidden; ephemeral self-signed cert, not platform TLS |
| Build / lint | Passed | — | Client build + server lint |

Total local verification: **238 tests + smoke checks**, all green as of this status update.

## Local challenge resolved this session

An initial optional Chromium smoke used `localhost` HTTP while production CORS configuration requires an explicit HTTPS origin. The harness therefore failed to load assets (403), which is the correct production behaviour, not a deployment defect. The smoke script was corrected to run through a temporary self-signed HTTPS reverse proxy whose origin matches the configured production CORS value. Production origin validation was not relaxed. Initial failure and successful clean runs are retained in `docs/week6/evidence/`.

## Still required — NOT completed

- Owner pushes this Week 6 folder to GitHub.
- Owner creates/uses Render and MongoDB Atlas accounts in their own names, authorizes deployment, and supplies private secrets.
- Actual public HTTPS URL and deployed Git commit recorded.
- Public acceptance tests (login, CRUD, totals, persistence across reload and service restart, SSE, error handling) run against the live URL with sanitized screenshots.
- Provider-side monitoring/backup configuration and owner-approved restore/rollback verification; limitations recorded if unavailable.
- Final Word report and submission ZIP updated with actual deployment evidence, then portal submission.

## Evidence boundaries

`docs/week6/evidence/` is Week 6 local verification. Inherited `docs/evidence/` is Week 5 historical evidence and must not be used as proof of deployment. The production smoke uses a temporary external MongoDB process and, in its browser mode, an ephemeral self-signed TLS proxy; it does not verify Render TLS, Atlas networking, or public access.
