# Project reflection — working draft, public deployment pending

This draft distinguishes completed engineering work from deployment/maintenance activities still needing verification. The final Word report should be generated only after recording the actual public URL, commit, hosting configuration and acceptance results.

## What worked across the project

Week 1 planning established an expense-tracker scope. Week 2 built the React interface and guest behaviour; Week 3 added Express/MongoDB authentication and transactions. Week 4 integrated state, server queries, settings and real-time updates. Week 5 shifted from feature delivery to targeted validation and performance evidence. Week 6 now packages the application for a persistent hosted environment and documents operational ownership.

The useful continuity was a consistent transaction model and a separate API service layer. It allowed the same interface to support guest data and authenticated persistence without replacing the UI. It also enabled pure logic tests, request-level integration tests and browser tests to isolate failures at different boundaries.

## Specific challenges and what changed

1. **A green suite did not cover calendar meaning.** In Week 5, 76 server and 78 client baseline tests passed, but a new test showed that 2025-02-29 was accepted. JavaScript normalized it into March. Exact date round-trip validation plus POST/PATCH/bulk persistence assertions caught a data-integrity risk that happy-path counts concealed. Lesson: choose tests by risk and semantics, not just a target count.
2. **Request completion is more than receiving headers.** The client cleared its timeout before reading JSON; a stalled response body remained pending. A fake-timer test reproduced it and the guarded read fixed it. Cancellation during retry waits needed its own test. Lesson: explicitly model intermediate asynchronous states.
3. **Performance claims needed explain plans.** The default date/_id sort did not match its original compound index. The Week 5 fixture reduced documents examined from 10,000 to 20 after including the tie-breaker in the index, while preserving ordered IDs. Those were local database measurements, not production user latency. Lesson: document the measurement boundary and avoid extrapolating.
4. **Local convenience was unsafe as a production fallback.** The prior server could start a temporary database if a URI was missing. Week 6 now refuses that configuration in production, rejects example secrets and requires explicit HTTPS origins. This is preventive hardening, not evidence of a real data-loss incident.
5. **Production-mode browser testing exposed an origin mismatch in the harness.** The initial local browser run used HTTP while CORS allowed an HTTPS deployment origin. HTML loaded but JS/CSS requests failed with 403. Rather than weakening production origin validation, the optional smoke test now runs through a local self-signed HTTPS proxy and matches its configured origin. The browser renders the built login/dashboard without observed CSP errors. This still does not prove Render TLS or public access.
6. **Persistent streams affect maintenance.** A standard server.close waits for active SSE responses. Week 6 calls the existing closeAll stream helper before shutdown; the smoke test keeps an SSE stream open and verifies a successful process exit and restart. Stream replay remains process-local, so durable cross-release event delivery is not claimed.

## Feedback incorporated

The earlier evaluator described the report as competent but generic, with too little detail on challenges and solutions. Later documentation therefore pairs a specific input/symptom with the responsible file, root cause, change and regression assertion. Historical failing logs are retained alongside final passes. Environmental failures are not relabelled as product defects, and unperformed deployment steps stay marked pending.

## Improvements still needed

- Complete public Render/Atlas deployment, UAT, restart persistence verification and sanitized deployment screenshots.
- Perform a real backup/isolated restore drill and measure recovery time; a maintenance plan alone is not restore evidence.
- Improve unit coverage of dashboard/error fallback branches and test browsers beyond Chromium.
- Review HttpOnly-cookie or short-lived stream-ticket authentication; localStorage JWT and SSE query tokens have remaining exposure considerations even with CSP/log redaction.
- Add shared event/rate-limit state before scaling beyond one server, and profile real data volumes/concurrent load before making capacity claims.
- Consider recurring transactions, budgets and better exports only after deployment reliability and restore procedures are verified.

## Personal process commitments for future projects

Maintain a requirements-to-test matrix from the start, keep secrets outside code and screenshots, collect evidence during implementation rather than reconstructing it at report time, and distinguish measured outcomes from assumptions. In future work, prepare production configuration and backup strategy earlier so they are not postponed until the last week.

## Completion boundary

Local preparation and tests are complete to the extent recorded in WEEK6-STATUS.md. Public deployment, provider-side operations and final report submission are **pending**, not completed. The assignment's 30–35-hour estimate is not presented as measured time spent.
