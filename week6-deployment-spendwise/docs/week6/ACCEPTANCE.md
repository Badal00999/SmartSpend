# Public deployment acceptance — NOT RUN

This checklist cannot be marked passed using local evidence. Complete after the owner deploys to Render/Atlas. Use synthetic, non-sensitive records. Do not share tokens, database URIs or passwords.

- Actual public HTTPS URL: **PENDING**
- Deployed Git commit: **PENDING**
- Hosting region / selected tier: **PENDING**
- Atlas project/cluster (non-secret display name): **PENDING**
- Tester/date/time/timezone: **PENDING**

| ID | Action | Expected | Actual / evidence |
|---|---|---|---|
| UAT-01 | Open public /login from normal browser | Valid platform TLS; built UI loads; no shared demo button | NOT RUN |
| UAT-02 | Open /api/v1/ready | HTTP 200, ready, no-store | NOT RUN |
| UAT-03 | Register a unique test account, sign out/in | Correct session; wrong password rejected | NOT RUN |
| UAT-04 | Add test expense ₹125 dated 2024-02-29 | Row and totals agree; date preserved | NOT RUN |
| UAT-05 | Edit amount to ₹150, reload | Updated value remains in list and totals | NOT RUN |
| UAT-06 | Open same account in second tab; add/delete a row | Other tab updates or recovers through documented refresh behaviour | NOT RUN |
| UAT-07 | Open /settings and /dashboard as direct URLs | SPA deep links work, API URLs still JSON | NOT RUN |
| UAT-08 | Restart Render API service with saved test record | Account/record survives via Atlas; application returns ready | NOT RUN |
| UAT-09 | Delete test row and reload | Deleted row stays absent | NOT RUN |
| UAT-10 | Account B tries to read account A transaction ID | 404/no data disclosure; use only your own test accounts | NOT RUN |
| UAT-11 | Offline browser then reconnect | Clear feedback, no crash, recover without unexplained data loss | NOT RUN |
| UAT-12 | Inspect runtime logs / production headers | Request IDs, no token query values; CSP; no public Swagger | NOT RUN |
| UAT-13 | Currency converter / guest profile external requests | Allowed public API requests or clear upstream failure feedback; no unintended CSP block | NOT RUN |
| UAT-14 | Controlled release/rollback exercise | Known-good commit restored with compatible data | NOT RUN |
| UAT-15 | Backup and isolated restore drill | Verified counts/sample records; documented restore time | NOT RUN |

Save sanitized screenshots/log excerpts under `docs/week6/evidence/public/` after execution. Keep precise failure notes and remediation rather than filling every row as passed. UAT-14/15 require owner approval; do not perform destructive production experiments merely to obtain screenshots.

Local evidence currently available: server/client regression, production guardrail/readiness tests and a production-mode smoke using a separate temporary DB process. Optional Chromium smoke uses an ephemeral self-signed HTTPS reverse proxy with ignoreHTTPSErrors for that local certificate; this is not platform TLS verification.
