# Week 6 — Render + MongoDB Atlas deployment guide

**Status: prepared and locally tested; no public deployment has been verified.** User-owned accounts are required. Do not put credentials in Git, screenshots, chat or a report. No paid resource should be approved without reviewing its price.

## Architecture and scope

One Render Node web service builds React and serves it through Express on the platform PORT. MongoDB Atlas stores users and transactions independently of service restarts. Relative `/api/v1` URLs avoid a separate front-end domain. The in-process SSE bus is appropriate for one instance; multiple instances need a shared event transport. Do not horizontally scale this implementation without that change.

The free Render service can sleep after inactivity; wake-up delay is not a lost database. Check current pricing/limits before selecting an instance. Atlas M0 is the intended learning-tier option if available. No always-on uptime guarantee is made. The public URL must be tested after deployment; a local preview is not a substitute.

## 1. Push the prepared source

Download `SpendWise-Week6-Deployment-Preparation.zip`, extract, and copy the inner `week6-deployment-spendwise` folder into `C:\Users\badal\SmartSpend-local` alongside Week 4/5. Confirm the following file exists (no extra nested folder):

```powershell
cd C:\Users\badal\SmartSpend-local
Test-Path .\week6-deployment-spendwise\package.json
git remote -v
git status
git add -- week6-deployment-spendwise/
git diff --cached --stat
# Inspect staged files; no .env, credentials, node_modules or raw traces.
git commit -m "Week 6: deployment preparation and maintenance runbooks"
git pull --rebase origin main
git push origin main
```

If the destination already exists or any command fails, stop and inspect; do not overwrite blindly or force push. Root repository URL remains https://github.com/Badal00999/SmartSpend. Verify `week6-deployment-spendwise/` appears before connecting Render.

## 2. Create the Atlas database

1. Sign in at https://www.mongodb.com/atlas. Create a project for SpendWise or use a suitable existing project.
2. Create a **Free / M0** cluster if available. Do not select Flex/dedicated paid compute without choosing to pay. Choose a region near the Render service where both platforms support it.
3. Under Database Access, create a dedicated application database user. Grant read/write access to the `spendwise` database, not project/organization administration. Use a generated password and save it privately.
4. Under Connect → Drivers → Node.js, obtain the connection URI. Use the database name `spendwise` in the URI path. Example shape only:

```text
mongodb+srv://APP_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/spendwise?retryWrites=true&w=majority
```

5. Replace placeholders privately. Reserved characters in username/password must be percent-encoded. Do not paste the actual URI in chat or commit it.
6. Do not open access to the whole Internet as the default fix. After creating the Render service, obtain its outbound CIDR ranges and add those ranges in Atlas Network Access. Render ranges are shared by services in that region, so database credentials and least-privilege access are still essential.

## 3. Create the Render web service

Sign in at https://render.com using your own account. Choose **New → Web Service**, connect GitHub and authorize access to `Badal00999/SmartSpend`.

| Field | Value |
|---|---|
| Name | `spendwise-badal-week6` or another available name |
| Branch | `main` |
| Root Directory | `week6-deployment-spendwise` |
| Language / Runtime | Node |
| Build Command | `npm run deploy:build` |
| Start Command | `npm run deploy:start` |
| Health Check Path | `/api/v1/ready` |
| Instance | Free if offered; review limitations/pricing |

The build script installs client build dependencies explicitly (`--include=dev`), builds the SPA and installs only production server dependencies (`--omit=dev`). It does not install Playwright or run MongoDB-memory-server in production. The start command runs Express, not Vite's development server. PORT is supplied by Render; do not hard-code it.

Set environment variables in Render's private configuration:

| Variable | Value |
|---|---|
| NODE_VERSION | `22` |
| NODE_ENV | `production` |
| SERVE_CLIENT | `true` |
| MONGODB_URI | Your private Atlas URI with `/spendwise` |
| JWT_SECRET | A fresh private random secret, at least 32 characters |
| CORS_ORIGIN | Optional if using the default Render URL; automatically falls back to RENDER_EXTERNAL_URL |

To generate a secret locally in PowerShell (do not send its output to anyone):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Only the secret value goes into Render, never into client VITE_* variables. For an explicit CORS_ORIGIN use the actual HTTPS origin, for example `https://YOUR-ACTUAL-SERVICE.onrender.com`, with no path/trailing slash. Multiple approved HTTPS origins can be comma-separated. Do not use `*`.

If using the optional Blueprint instead, select `week6-deployment-spendwise/render.yaml` in the Blueprint flow; it generates JWT_SECRET and prompts for MONGODB_URI. Manual setup above is sufficient; you do not need both approaches.

## 4. Allow the service to reach Atlas

After Render creates the service, open that service's **Connect → Outbound** section. Copy **all** listed CIDR ranges and add them to Atlas Network Access. These are not the service's inbound website IP and are not your laptop's IP. Allow propagation, then retry the deploy if the first attempt could not connect.

Official instructions: https://render.com/docs/outbound-ip-addresses . Do not assume that adding only your home IP grants the Render service access.

## 5. Deploy and inspect

Start deployment and watch Build/Runtime logs. Success should include a completed Vite build, a connected database and listening server. Readiness must return HTTP 200. `/api/v1/health` is liveness, not a readiness substitute; `/api/v1/ready` checks database connectivity/ping and returns 503 if unavailable.

On the public URL:

1. Open `/login`. Production intentionally hides the shared demo-account button. **Create your own account**; no known-password demo user is seeded into Atlas automatically.
2. Add a non-sensitive test transaction. Verify list, totals, edit/delete and reload.
3. Test deep links such as `/settings` directly; they must render the SPA.
4. Verify HTTPS and `/api/v1/ready`. Swagger/OpenAPI endpoints are intentionally disabled in production; `/api/docs` should return 404.
5. Use the same account in two tabs to check SSE. Record actual results in ACCEPTANCE.md.
6. Restart the Render API service and confirm the saved record persists in Atlas. This is different from a browser reload.
7. Capture sanitized screenshots of the public app, readiness response and successful deploy event. Avoid environment pages, tokens and account passwords.

Disable automatic deploys initially if you want controlled releases. Do not claim uptime from a single successful check. Run the entire public acceptance checklist before finalizing the Week 6 report.

## Troubleshooting (diagnosis before changes)

| Symptom | Check / fix |
|---|---|
| Root directory missing | GitHub folder must exist on main; use exact `week6-deployment-spendwise` |
| vite not found during build | Use provided build command; NODE_ENV=production otherwise omits dev build tooling |
| Missing database / example secret | Production intentionally fails fast; set private real values, do not disable guardrails |
| Atlas connection timeout | Check Render outbound ranges in Atlas, cluster availability, database user and URI |
| Authentication failed to MongoDB | Database user is different from Atlas website login; check credentials/encoding privately |
| Readiness 503 | Inspect database/network incident; don't replace readiness with unconditional 200 |
| CORS 403 / assets fail | Exact public HTTPS origin must match. A localhost browser against a production-only origin is not equivalent to the public deployment |
| Production client build missing | Check build logs; built client must exist before Express starts |
| First visit delayed | Review free-instance cold start; retry readiness after wake-up, then investigate persistent failures |
| Demo account login unavailable | Intended; register a private account in production |
| SSE reconnects after release | Streams end on graceful shutdown; reconnect/refetch after deploy. Replay is process-local and not durable across restart |

## References consulted

- Render Express deployment: https://render.com/docs/deploy-node-express-app
- Render outbound IP ranges: https://render.com/docs/outbound-ip-addresses
- Render free-service limitations: https://render.com/docs/free
- Atlas free cluster setup: https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/

Provider screens and limits may change. Record the actual settings used, actual public URL and commit in the final report, not the placeholders in this guide.
