# US48 evidence

Owner: Jaydon. Local verification: 21 October 2026. Code-first; no TDD claim.
Branch: `us48-replacement-integrity`. Claimed migration: 0099.

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

No shared deployment, manual pass, GitHub Actions result, delivered email, commit,
PR or merge is claimed. Shared evidence sheet updates remain pending until story
closeout. The backend is ready for inspection; US48 UI/search/badge work remains.
Manual steps and next test IDs: `docs/test-cases/US48_test_cases.md`.
