# US41 restored arrangement regression coverage

Owner: Jaydon. Recorded: 2 November 2026.
Branch: `us41-arrangement-regression-coverage`. Base: `749e6a0`.

## Scope and fixture changes

Restores execution of the ten existing SQL case IDs in `arrangement_revalidation.sql`
and `arrangement_layout_capacity.sql`; no new case IDs are allocated. The new focused
runner invokes both files and is called by each existing CI database gate before the
final US41 historical replay. No production function, migration or frontend source
is changed by this portion.

Fixtures now use canonical theatre/classroom codes and catalogue-backed equipment/
accessibility arrays. A second equipment type makes the rollback proposal a real
requirement change. A temporary helper calls the real venue-aware cell calculator
when installed and the real legacy calculator in the historical gate. Neither is
mocked or replaced during normal verification. These booking fixtures intentionally
retain null US49 per-booking overrides, exercising the event-requirement fallback;
they do not claim new per-booking override coverage or US47 buffer-boundary cases.

Existing assertions retain independent reasons, capacity equality/overflow, timing
conflicts and free intervals, notice attribution, resolution authorisation/history,
reservation preservation and transactional failure. AC-041.1.4 additionally compares
complete event/request/revalidation/flag/notice/outbox snapshots after the forced
notification refusal. Unused old replay snapshots are removed; AC-041.1.3 has its own
populated fixture and comparison and still runs last.

## Verification results

| Evidence | Result |
| --- | --- |
| [database-focused-initial.log](database-focused-initial.log) | Exit 0; ten restored cases passed before strengthening the rollback snapshot |
| [database-focused-retest.log](database-focused-retest.log) | Exit 0; final ten-case focused current-schema run, including the complete rollback snapshot |
| [database-historical-retest.log](database-historical-retest.log) | Exit 0; historical gate/races, all ten restored cases and both AC-041.1.3 replay checkpoints passed |
| [database-upgrade.log](database-upgrade.log) | Exit 0; quarter-hour upgrade gate/races, all ten restored cases and replay passed |
| [database-fresh.log](database-fresh.log) | Exit 0; fresh-order quarter-hour gate/races, all ten restored cases and replay passed |
| [assertion-probes-retest.log](assertion-probes-retest.log) | Exit 0; deliberately suppressing revalidation failed AC-041.3.2; using >= at capacity failed AC-041.3.1; moving an allocation's return date during resolution failed AC-041.1.2. Probe subtransactions restored the functions/data; the unchanged full ten-case suite then passed |

Commands from repository root:

```bash
bash backend/supabase/tests/run_arrangement_revalidation.sh
bash backend/supabase/tests/run_change_request_review.sh
bash backend/supabase/tests/run_venue_time_conversion.sh
bash backend/supabase/tests/run_venue_time_conversion.sh fresh
```

The effectiveness probes temporarily changed database functions only inside their
own disposable container; no application or migration file was edited. They used the
unchanged case assertions and rolled each mutation back. These are deliberate test
effectiveness checks, not discovered defects or TDD cycles. Existing losing race calls
are expected refusals followed by preservation checks. Normal suite success is based
on the command exit and all assertions, not merely finding PASS text in a log.

## Test setup and probe corrections

While strengthening the snapshot, its first helper ordered
`event_change_revalidations` by nonexistent `id` instead of `change_request_id`.
[AC-041.1.4-test-helper-failure.log](AC-041.1.4-test-helper-failure.log) and
[database-historical-initial.log](database-historical-initial.log) retain the SQL error
(exit 3). Correcting the test helper required no product change. The focused and
historical retests passed. Upgrade/fresh reached the restored case after this helper
correction and passed its final snapshot assertion; those successful gates were not
repeated. The initial focused success predates the stronger snapshot and is labelled
separately, not presented as verification of that extension.

The first preservation probe attempted to delete confirmed venue slots, which the
existing slot-protection guard correctly refused with 23514 before the intended
snapshot assertion. [assertion-probes-initial.log](assertion-probes-initial.log) retains
that probe-harness failure (exit 3). The final probe changes an equipment allocation's
return date and reaches AC-041.1.2 as intended. No production safeguard was disabled.

These are test/probe setup corrections and expected injected refusals, not product
defects. No genuine product defect was found and no automated-defect row is justified.

## Results and reporting limits

All normal runs used disposable PostgreSQL 17 with simulated Auth claims and real
functions, constraints, RLS and transactions. No shared Supabase deployment, UI/manual
result, frontend suite/build, new coverage percentage or delivered email is claimed.
CLI trailing whitespace/blank endings are normalised without changing result text.

US41 still has 22 source IDs: eleven frontend and eleven SQL. The eleven SQL IDs now
execute through the established CI database entry points; two replay checkpoints are
one grouped ID. Frontend cases were not rerun for this test-only portion. Existing
manual reports and the original historical logs are unchanged. Refresh the ten
existing overview records/evidence references when updating the sheet; do not create
duplicate case rows or populate Automated Test Case Runs.
