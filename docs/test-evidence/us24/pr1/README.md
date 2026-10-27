# US24 PR1 backend evidence

Owner: Jaydon. Verification date: 27 October 2026. Code-first development.
Claimed migration: 0112. Local database runs only; shared deployment is not claimed.

## Results

| Log | Actual verification |
|---|---|
| `database-focused-initial.log` | Initial 20 grouped SQL cases passed, including four races and populated replay. |
| `database-focused-expanded.log` | Expanded 21-case checkpoint passed, including legacy upgrade preservation. |
| `database-focused-final.log` | All 23 documented grouped cases passed; includes the final Under Maintenance/completed-inspection refusals and stronger failure fixture with future reviews/notices to roll back. |
| `database-historical.log` | Historical regressions and existing concurrency gates passed; final US24 extension passed all 23 cases. |
| `database-upgrade.log` | Quarter-hour upgrade/shared regressions and concurrency passed; US24 extension passed the earlier 21-case test set. |
| `database-fresh.log` | Fresh-order/shared regressions and concurrency passed; US24 extension passed the earlier 21-case test set. |

All six commands exited 0. Upgrade/fresh gates completed before two missing planned
assertions and a stronger rollback fixture were added. The final focused run verifies
that final test set; no product code changed between the runs. Counts were checked
against unique PASS IDs and the documented case table, rather than raw assertion counts.
Shell syntax and tracked/new-file whitespace checks passed. No frontend files changed;
no new frontend test/coverage/build result is claimed.

The focused runner creates disposable PostgreSQL 17, bootstraps simulated Supabase
Auth interfaces, loads real migrations and seeds isolated allocations. Its initial
upgrade applies 0112 over existing unit/allocation/defect rows; its populated replay
preserves records after real concurrent inspections. Shared database runners also
invoke this extension in their own disposable containers. It never connects to shared
Supabase, sends a real email or uses live Auth/API sessions.

## Failures and limits

No genuine product defect was found. Validation refusals, stale losing decisions,
reservation refusals and deliberately injected inspection-write failure are expected
negative/atomicity checks, not discovered defects or TDD evidence.

A test-assembly mistake left two documented cases absent from the test file; an earlier
23-case progress count was incorrect. Unique-ID verification identified 21 passing
cases. The missing cases were added and all 23 passed in the final focused run.
This is a test/documentation issue, not an application defect for the defect sheet.

Local file reads were intermittently slow, and one Git diff command reported a transient
file-mapping error. Subsequent checks completed; no dependency/configuration changes
were needed. These observations do not establish a root cause or a product defect.

CLI log trailing whitespace/blank EOF lines were normalised for repository checks;
result/error text and leading indentation are retained. Initial/expanded logs are
historical checkpoints, not evidence that the final test file ran at those points.

## Remaining work

PR1 changes no frontend. The return UI, manual acceptance, CI results, shared migration
deployment and evidence-sheet update remain pending. Manual checks will use real
Technical Support/Coordinator accounts after PR2. Queued email is not proof of delivery.
Sheet rows belong in chat; no TSV files or Automated Test Case Runs entries are created.
