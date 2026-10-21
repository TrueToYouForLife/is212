# US48 evidence

Owner: Jaydon. Local verification: 21 October 2026. Code-first; no TDD claim.
Current branch: `us48-replacement-ui`; PR1 merged in PR #127. Claimed migrations: 0099 and 0100 (0099 applied, 0100 local only).

## PR1 local results

| Evidence | Check | Result |
|---|---|---|
| [database-targeted.log](database-targeted.log) | `bash backend/supabase/tests/run_affected_venue_replacement.sh` | Exit 0; 20 grouped US48 SQL cases, populated migration replay and three real two-session races passed. |
| [database-upgrade.log](database-upgrade.log) | `bash backend/supabase/tests/run_venue_time_conversion.sh` | Exit 0; existing quarter-hour conversion/settings/revalidation checks and races, plus all 20 US48 cases, passed. |
| [database-fresh.log](database-fresh.log) | `bash backend/supabase/tests/run_venue_time_conversion.sh fresh` | Exit 0; fresh numeric migration order, existing current-schema checks and all 20 US48 cases passed. |
| [database-historical.log](database-historical.log) | `bash backend/supabase/tests/run_change_request_review.sh` | Exit 0; historical regression suite, including original US20 replacement checks/race, passed. Intentionally excludes 0075/0098/0099. |
| [frontend-compatibility.log](frontend-compatibility.log) | Targeted replacement service/panel and arrangement-review service tests, from frontend | Exit 0; 22 existing tests in 3 files passed. |

No frontend product code changed; no new full frontend suite, build, lint or coverage
result is claimed. Shell syntax and diff whitespace checks also passed.
Database tests use disposable local Docker PostgreSQL 17 and simulated Supabase
Auth interfaces. They never connect to shared Supabase.

## Failure classification

No product defect was demonstrated during this portion. Initial fixture setup
attempted Coordinator assignment as Venue Staff and selected event rows hidden by
staff RLS, so blocking created no test flags. Fixture setup was corrected; product
permissions were preserved. These are test-fixture mistakes, not product defects.

Conflict errors in existing race logs are expected refusals where the subsequent
PASS checks establish preservation. AC-048.6.6 deliberately injects a database
review-write failure to prove complete transaction rollback. This is a negative
integration test, not a discovered defect, forced product break or TDD red phase.

## Outstanding evidence

PR1 is merged in #127; Jaydon subsequently confirmed 0099 applied. No 0100 shared deployment, manual pass, new GitHub Actions
result, delivered email or PR2 commit/PR/merge is claimed. Shared evidence sheet updates remain pending until story
closeout. PR2 UI/search/badge work is locally implemented; deployed manual checks remain.
Manual steps and next test IDs: `docs/test-cases/US48_test_cases.md`.


## PR2 UI verification — earlier checkpoint, 21 October 2026

- `ui-coverage.log`: full `npm run coverage`, exit 0; **172 files / 1,511 tests**.
  Eleven new US48 cases: ten component tests and one service unit test.
- Configured feature coverage: **95.73% lines/statements, 90.40% branches,
  95.03% functions**. Scope unchanged. Uncovered existing code and some defensive,
  loading/optional-display branches remain; no 100% coverage claim.
- `ui-targeted.log`: 35 targeted tests passed across 6 files after implementation
  refinements, including shared result cards and buffer-search regressions.
- `ui-role-regression.log`: 7 staff-queue tests passed after updating the final
  role-loss assertion to the renamed panel. No full-suite repeat was needed.
- `ui-typecheck.log`, `ui-build.log`, `ui-lint.log`: exit 0. Lint has no warnings.
  Build includes the existing Vite large-chunk warning.
- Commands ran from `frontend/`. No SQL product/test file changed in PR2; no new
  database run is claimed. Backend evidence above remains PR1's verified result.
- Existing US20 proposal tests moved with the extracted form, preserving their IDs
  and intent. Service validation now requires 0099 rather than silently dropping
  affected-booking indicators on an older database.

### Automated product defect

`AC-048.2.3-search-options-failure.log` retains the actual failing targeted run.
With booking-time definitions unavailable, the page displayed its error but the
filter button remained labelled Searching because disabled state also controlled
loading text. The controls now accept separate searching state; the same negative
expectation and final full suite pass. This is a UI feedback defect, not lost data.
Discovered/fixed: Jaydon, 21 October 2026. Shared defect-sheet entry remains pending.
The raw run also includes a test expectation for Cancelled where existing UI says
Released; that expectation and unsupported test API options were test-code mistakes.

PR2 remains local/uncommitted. No shared deployment, manual result, PR2 CI result
or delivered email is claimed. Manual checklist: `docs/test-cases/US48_test_cases.md`.

Migration 0099 deployment was subsequently confirmed by Jaydon. Manual UI results
remain pending; this confirmation is not a manual workflow pass.


## Venue-block daily range refinement — superseded checkpoint

Jaydon requested readable start/end selection instead of 96 quarter-hour checkboxes.
At this checkpoint the form expanded one daily half-open interval to the same database slot array;
no SQL or stored-block changes. Full day and 24:00 remain supported.

- `block-range-targeted.log`: 27 tests passed in 4 files, including the existing
  US12/US47 cases adapted to range selection and new grouped AC-048.2.6.
- `block-range-coverage.log`: full coverage run, **172 files / 1,512 tests passed**.
  Configured coverage at that checkpoint: **95.72% lines/statements, 90.35% branches,
  95.03% functions**. Scope unchanged; earlier 1,511-test log is the prior checkpoint.
- `block-range-typecheck.log`, `block-range-build.log`, `block-range-lint.log`:
  passed. Existing Vite chunk-size warning remains.
- Initial lint overlapped Vite's temporary config cleanup and encountered a missing
  temporary file; rerunning after build/test completion passed. This was a tooling
  race, not a product defect. A duplicate time-option test selector was corrected
  to inspect both dropdowns; that was a test assertion mistake.

Manual verification remains pending; deployment of 0099 was confirmed by Jaydon.


## Continuous blocks (0100) — final local verification, 21 October 2026

Jaydon explicitly chose a continuous start date/time → end date/time interval,
replacing the daily interpretation above. Migration 0100 was claimed before coding.
No deployed migration was edited and no existing booking/block coverage is rewritten.

| Evidence | Check | Result |
|---|---|---|
| `continuous-ui-targeted.log` | Targeted blocking components/validation/services | 58 tests / 11 files passed at the development checkpoint. |
| `continuous-ui-coverage.log` | Full frontend coverage | Exit 0; 173 files / 1,516 tests. Coverage 95.73% lines/statements, 90.46% branches, 95.05% functions; configured scope unchanged. |
| `continuous-ui-build.log` | Build including TypeScript check | Exit 0; existing Vite chunk-size warning only. |
| `continuous-ui-lint.log` | Lint after build/test completion | Exit 0, no warnings. |
| `continuous-database-targeted.log` | Focused current-schema Docker checks | Exit 0; US48 cases/races and continuous endpoints, preservation, settings, removal, replay and mixed-request concurrency. |
| `continuous-database-historical.log` | Historical database regression gate | Exit 0; intentionally skips 0075/0098/0099/0100 so historical fixtures retain their original contract. |
| `continuous-database-upgrade.log` | Populated upgrade and concurrency gate | Exit 0; current booking/settings/replacement regressions plus 0100 checks. |
| `continuous-database-fresh.log` | Fresh numeric migration order and concurrency gate | Exit 0; current booking/settings/replacement regressions plus 0100 checks. |

Four shared US12 frontend cases and eleven shared integration cases were added,
including the real two-session mixed legacy/continuous block race. Existing US12/US47
control tests retain their IDs and intent. AC-048.2.6 now checks the final continuous
form contract rather than the superseded daily conversion. Test allocation and
manual steps are in `docs/test-cases/US48_test_cases.md`.

The first continuous SQL attempt asserted settings-created reviews in
`venue_booking_flags`; settings correctly use `arrangement_review_flags`.
The fixture assertion was corrected. No product failure was demonstrated in this
refinement. Expected refusal errors in concurrency logs are followed by final-state
PASS assertions. Earlier AC-048.2.3 remains the genuine product defect for the sheet.

Shared contract changes affect US12 blocking and US47 conflict readers. Apply 0100
after 0099, before this frontend. Jaydon owns review, merge and shared deployment.
Manual results, 0100 deployment, PR2 CI/review and evidence-sheet closeout remain pending.

The upgrade/fresh logs precede final allocation of the two new AC-012.10 IDs:
they show .10.8 for upgrade and .10.7 for replay. Final focused evidence and case
notes use .10.7 for upgrade and .10.8 for replay, in execution order. Assertions are
unchanged; raw historical logs retain their original labels.
