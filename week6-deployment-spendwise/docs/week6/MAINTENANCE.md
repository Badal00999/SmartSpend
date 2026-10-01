# Maintenance runbook — proposed, not yet exercised on a public deployment

Owner: Badal. Hosting/database accounts and credentials remain with the owner. Public URL, deployed commit and last restore-drill date must be recorded after deployment. This is a maintenance plan, not evidence that automated monitoring/backups have already been configured.

## Routine schedule

| Frequency / event | Action | Evidence to retain |
|---|---|---|
| Each release | Run tests/lint/build; review dependency/config changes; verify readiness and UAT | Commit SHA, release time, sanitized logs, acceptance checklist |
| Daily during evaluation | Check public readiness/login; inspect 5xx and database alerts | Timestamp, HTTP status, incident notes; distinguish cold starts |
| Weekly | Review provider usage/billing, errors, access list, database size and dependencies | Notes and reviewed changes; no automatic `audit fix --force` |
| Before schema changes and weekly for meaningful data | Encrypted database backup under an appropriate plan/process | Backup completion, size, checksum, location and retention date |
| Monthly / after backup changes | Restore into a separate test database and verify counts + sampled records | Restore time, check results, measured recovery duration |
| Credential exposure / owner changes | Rotate affected database password/JWT secret, redeploy and review logs | Incident record; never store old secrets in ticket/report |

## Monitoring and error reporting

- Render readiness path `/api/v1/ready` returns 200 only with a connected, pingable database; failure is 503 with no host/credential details. Existing `/health` reports process status but is not sufficient for readiness.
- Request logs contain method, path without query, status, duration and request ID. Production exception logs retain name/code/request ID instead of full credential-bearing objects; responses do not expose stack traces. Inspect Render runtime logs first; correlate an incident with the X-Request-Id response header.
- No Sentry/email/SMS alert integration has been activated here. Configure provider alerts through the owner's accounts and test a notification before claiming it works. Avoid sending tokens, passwords or transaction payloads to third-party error collectors.
- Free-service cold starts affect response time. An external monitor must respect service terms and budget; do not use pings merely to evade free-tier sleep restrictions.
- Maintain a short incident record: detection time, symptoms, impacted feature, request ID, cause, action, verification and prevention. For authentication/ownership exposure, stop public use and rotate secrets before resuming.

## Backup and restore

The app's Settings JSON export is a user data convenience, **not a complete MongoDB backup**: it does not preserve all users, password hashes, indexes or database metadata. Do not describe it as full disaster recovery.

Check current Atlas tier backup capabilities; do not assume M0 includes scheduled snapshots. If managed backups are unavailable, use MongoDB Database Tools from a trusted machine and permit only that machine's current IP temporarily. Use a dedicated appropriately scoped backup user, interactive password input and encrypted storage outside the repository. Backups contain personal financial data and password hashes.

Example command shape (replace cluster host and username; password should be entered privately when prompted):

```powershell
mongodump --uri="mongodb+srv://YOUR_CLUSTER.mongodb.net/spendwise" --username="BACKUP_USER" --archive="spendwise-backup.archive.gz" --gzip
```

Never place the actual password in the command/URI or upload the archive to GitHub. Encrypt the resulting archive, keep access restricted and remove temporary plaintext copies safely. Proposed retention: four weekly encrypted copies plus a pre-migration backup, subject to the owner's storage/privacy needs.

Restore drill: first provision a separate `spendwise_restore` database and scoped restore credentials. Use namespace mapping, not a destructive restore over production:

```powershell
mongorestore --uri="mongodb+srv://YOUR_CLUSTER.mongodb.net/" --username="RESTORE_USER" --archive="spendwise-backup.archive.gz" --gzip --nsInclude="spendwise.*" --nsFrom="spendwise.*" --nsTo="spendwise_restore.*"
```

Enter the password privately when prompted. Compare user/transaction counts, representative non-sensitive records and indexes. Test a separate staging app pointing to the restored DB, never silently repoint the public app. Delete the restore database only after recording the drill and checking it is not production. These commands are templates, **not executed backup/restore evidence**.

Suggested targets (not guarantees): with weekly backups, worst-case recovery point can be up to seven days; use daily backups if that loss is unacceptable. Establish a recovery-time target only after timing a restore. Public deployment and restore verification are pending.

## Updates and safe release

1. Review a change in a branch; keep package locks. Run npm run setup, npm test, npm run lint, npm run build and relevant browser tests.
2. Test production configuration and migration compatibility locally/staging. Back up before destructive or schema-changing operations.
3. Record the current known-good commit and database compatibility. Deploy the reviewed commit explicitly on Render, preserving secret environment settings.
4. Check readiness, login, CRUD, persistence and SSE; watch request errors after release. Mark UAT with real results and timestamps.
5. If checks fail, use Render's supported rollback/deploy-specific-commit flow to the recorded known-good commit (availability depends on the plan). Alternatively revert the application change with a new reviewed Git commit and redeploy. Never force-push history as the default recovery procedure.
6. Code rollback does not reverse database migrations. Prefer additive/backward-compatible migrations; restore or migration reversal needs a separately reviewed recovery plan.

## Security and capacity notes

- Use HTTPS, private random JWT secret, exact CORS origins, least-privilege database credentials and restricted Atlas IP ranges. Never set MONGODB_URI to an ephemeral database in production.
- JWT secret rotation invalidates existing sessions; tell users to sign in again. Database credential rotation needs a tested environment update and redeploy.
- JWTs currently live in localStorage and SSE tokens travel in query strings. CSP and application log redaction reduce risk, but proxy logs need separate review; an HttpOnly cookie/short-lived stream-ticket design is future work, not implemented.
- The default query index is `{user:1,date:-1,_id:-1}`. Review/create indexes deliberately for persistent databases; do not blindly run syncIndexes in production.
- SSE replay/rate limits are in-memory. Stay on one instance for this internship deployment. Scaling requires shared event/rate-limit state and separate testing.
- Establish usage alerts/budget limits where available; do not promise a permanent free plan or zero spend if paid resources are enabled.
