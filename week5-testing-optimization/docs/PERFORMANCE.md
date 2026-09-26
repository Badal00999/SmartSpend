# Query profiling and optimization

## Hypothesis and implementation

`listTransactions` in `server/src/controllers/transactionController.js` sorts the default page by `{date:-1,_id:-1}` under an equality constraint on `user`. The existing `{user:1,date:-1}` index omitted the ID tie-breaker. Hypothesis: including `_id` permits ordered index traversal without a blocking SORT.

Changed `server/src/models/Transaction.js`:

```js
// Before
transactionSchema.index({ user: 1, date: -1 })
// After
transactionSchema.index({ user: 1, date: -1, _id: -1 })
```

The controller's filter, sort, response serialization, ownership checks and pagination contract are unchanged.

## Reproduction

From the project root: `npm run setup`, then `npm run profile`. The script at `server/scripts/profile-transactions.mjs` starts its own ephemeral database. It never reads MONGODB_URI or profiles against personal account data. It asserts that the real model declares the optimized index, reconstructs the old index on a dedicated fixture collection, measures it, drops only that fixture index, creates the new one and repeats.

Fixture: 20,000 deterministic records, two users, 10,000 each; dates span 365 days with many ties. Query: first page, limit 20, one user, date descending then ID descending. Other baseline indexes (user, date, user/category) are retained. There is no explicit hint; MongoDB chooses the plan. Each variant gets five warmups and 30 sequential measured samples. Timing uses Node performance.now around native-driver query consumption. Percentiles use nearest-rank on the sorted 30 samples.

## Captured results

| Evidence | Before | After |
|---|---:|---:|
| Returned documents | 20 | 20 |
| Examined documents | 10,000 | 20 |
| Examined index keys | 10,000 | 20 |
| Blocking SORT stage | present | absent |
| Median local query latency | 13.369 ms | 0.922 ms |
| p95 local query latency | 14.525 ms | 1.206 ms |

Same ordered IDs: **true**. All 60 raw timings, exact environment (Node/CPU/MongoDB), fixture parameters and IDs are in `evidence/performance/query-profile.json`. Winning and execution plans are in `before-explain.json` and `after-explain.json`.

The robust result is less query work and no blocking SORT. Latency is a local observation, not a general promise. Old-first/new-second run order may favour the new case through cache effects. No concurrent traffic, TLS, network latency, Express, authentication or countDocuments was included. Do not label this a whole-API or UI speedup. Different datasets, hardware and query patterns need separate measurement.

## Correctness guard

`server/tests/week5-query-plan.test.js` verifies the actual application model index and a live MongoDB explain plan. With 60 equal-date records it checks no blocking SORT, exactly 20 examined documents, disjoint first/second pages, descending stable IDs, YYYY-MM-DD output and the public `id` field instead of `_id`. This is a deterministic structural performance guard, not a flaky assertion that every query completes below a fixed time threshold.

## Trade-offs and deployment

The wider index consumes more disk and adds write-maintenance work; index size/write throughput were not benchmarked. It does not solve deep skip pagination, every alternative sort, substring search or summary aggregations. Those remain profiling targets, not claimed improvements.

New ephemeral databases build the new index from the model. For an existing persistent database, schedule and verify index creation through your normal migration process. Example MongoDB shell commands, **only after checking your database/collection and permissions**:

```js
db.transactions.createIndex({user:1,date:-1,_id:-1})
db.transactions.getIndexes()
// Verify an explain plan and application behaviour before optionally dropping
// the old user_1_date_-1 index. Do not run syncIndexes blindly on production.
```

Mongoose does not automatically remove the old index just because the schema changed. Keeping both temporarily helps safe rollout but increases storage/write cost. No persistent production database was modified in this task.

## Front-end inspection and deferred work

The application already lazy-loads its pages. The current production build passes, with an entry JS chunk of 267.05 kB (86.39 kB gzip) and dashboard chunk of 416.82 kB (119.19 kB gzip). These are build-output sizes, not measured browser download time, LCP or interaction latency. No new bundle-size reduction is claimed. We avoided speculative memoization/code splitting without a rendering profile. Transport cancellation avoids unnecessary fetch invocations in a controlled test, but no user-perceived speedup is inferred from that test.
