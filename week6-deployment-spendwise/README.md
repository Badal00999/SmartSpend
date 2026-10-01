# SpendWise — Week 6 deployment preparation

**Status: READY FOR OWNER-LED DEPLOYMENT, NOT YET PUBLICLY DEPLOYED.**

This self-contained folder is the Week 6 version of the React + Express + MongoDB application. It must be pushed alongside, not over, the previous week folders in `Badal00999/SmartSpend`. The intended public host is one Render Node web service with a persistent MongoDB Atlas database.

## Start here

1. [Deployment guide (exact GitHub, Atlas and Render steps)](docs/week6/DEPLOYMENT.md)
2. [Maintenance, backups, restore and rollback runbook](docs/week6/MAINTENANCE.md)
3. [Public acceptance checklist — currently NOT RUN](docs/week6/ACCEPTANCE.md)
4. [Project reflection draft](docs/week6/REFLECTION-DRAFT.md)
5. [Progress and evidence boundary](docs/WEEK6-STATUS.md)

Do not submit a final deployment report claiming a live app until the actual public URL and acceptance results have been recorded. No hosting accounts, paid resources or public services were created from this workspace.

## What changed in Week 6

- Production fails fast without a MongoDB URI, with a weak/example secret or with non-HTTPS/wildcard CORS origins. Render's supplied RENDER_EXTERNAL_URL is used if no explicit CORS_ORIGIN is set.
- A production database connection never silently falls back to temporary MongoDB.
- `/api/v1/ready` checks connection state and pings MongoDB. It returns 200/503 and no-store; `/health` remains liveness.
- Production Helmet CSP is enabled with explicit public API connection destinations. Swagger/OpenAPI are disabled in production.
- Missing production SPA output is a startup failure instead of a deceptively healthy API-only deployment.
- The known-password demo login button is absent in production builds. Register a private account; the hosted database is not automatically seeded with demo credentials.
- Shutdown closes SSE streams before waiting for HTTP connections. Exception logs avoid raw production error objects and query-bearing URLs.
- Separate deploy build/start scripts install only the required runtime server dependencies; an optional Render Blueprint is included.

## Executed local verification

| Check | Result |
|---|---|
| Full server regression | 116 passed (100 inherited + 16 new production/readiness cases) |
| Full client regression | 92 passed |
| Chromium development E2E | 30 passed |
| Client lint / production build | Passed |
| Production-mode smoke | SPA/deep links, CSP, private account CRUD, database survival across API-process restart, shutdown with active SSE: passed |
| Optional local HTTPS Chromium smoke | Built login/dashboard rendered; no observed CSP errors; demo button hidden: passed |
| Public Render/Atlas UAT | **Not run — owner deployment pending** |
| Real backup / restore / rollback drill | **Not run — plan only** |

Logs are under `docs/week6/evidence/`. The HTTPS smoke creates a one-day self-signed certificate in a temporary folder and ignores its validation in the test browser only; production settings are not relaxed. It uses a local proxy and a separate temporary MongoDB process, not Render/Atlas. A record surviving API restart here does not prove hosted persistence. Original `docs/evidence/`, Week 4/5 READMEs, video/screenshots and old test reports are historical references, not Week 6 deployment evidence.

## Local development and tests

Recommended Node 22.12+ or 24 LTS (local verification used Node 20.20.2). Open this folder in VS Code:

```powershell
npm.cmd run setup
npm.cmd run dev
```

Open http://localhost:5173/login. Local development still offers the demo account. Stop all app servers before browser tests; tests intentionally do not reuse an existing service.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
cd e2e
npx.cmd playwright install chromium
cd ..
npm.cmd run test:e2e
npm.cmd run test:production
```

Optional HTTPS browser smoke also needs an `openssl` executable in PATH:

```powershell
npm.cmd run test:production:browser
```

Linux: use npm/npx; Playwright may need `npx playwright install --with-deps chromium` in e2e/. The scripts above are local tests. Do not use the ephemeral database for hosted production.

## Render configuration

Root Directory: `week6-deployment-spendwise`

```text
Build Command: npm run deploy:build
Start Command: npm run deploy:start
Health Check: /api/v1/ready
```

Private environment: NODE_ENV=production, NODE_VERSION=22, SERVE_CLIENT=true, MONGODB_URI=your Atlas URI, JWT_SECRET=a newly generated private secret. RENDER_EXTERNAL_URL is provided by Render; an explicit CORS_ORIGIN must be an exact HTTPS origin without trailing slash. Never place secrets in VITE_* variables, the repo or chat.

`deploy:build` deliberately removes server devDependencies. To run local tests again afterwards, run `npm run setup` to restore them. The optional smoke scripts need development tooling and are not the hosted start command.

## Release limitations

Single-instance SSE/rate-limit state, localStorage JWTs and SSE query tokens remain architectural constraints. Production logging is redacted, but upstream proxy logs need separate review. No paid monitoring, backup schedule, multibrowser certification or load test has been configured/claimed. Documentation gives plans and exact next steps; public results must be collected after actual deployment.
