# US41 populated replay verification

Owner: Jaydon. Recorded: 2 November 2026.
Branch: `us41-replay-preservation-test`. Base: `917ecb4`.

## Scope

One new grouped case, AC-041.1.3, compares all columns of review flags and their
notification records before and after replaying 0052 and then 0053. The assertion
runs after each migration in the same psql session. The fixture contains two
independent venue reasons and one equipment reason, one open reason, and two
resolutions recorded through the assigned Coordinator RPC using both methods.
Nonempty fixture guards prevent a vacuous pass. Comparisons run as administrator
to avoid RLS hiding rows, and use EXCEPT ALL in both directions to detect additions,
deletions and changed metadata, including resolved notes, methods, actors and times.

The fixture uses simulated Auth claims and synthetic accounts. It seeds reasons
through the protected producer as administrator; it does not retest the complete
change-approval path. No physical user action or live Auth/API session is claimed.

## Results

| Evidence | Command / result |
| --- | --- |
| [database-focused.log](database-focused.log) | `bash backend/supabase/tests/run_arrangement_review_replay.sh` — exit 0; current fresh schema, populated replay after each US41 migration passed |
| [database-historical.log](database-historical.log) | `bash backend/supabase/tests/run_change_request_review.sh` — exit 0; existing historical gate/races and the final US41 replay check passed |
| [database-upgrade.log](database-upgrade.log) | `bash backend/supabase/tests/run_venue_time_conversion.sh` — exit 0; quarter-hour upgrade/regressions/races and the final US41 replay check passed |
| [database-fresh.log](database-fresh.log) | `bash backend/supabase/tests/run_venue_time_conversion.sh fresh` — exit 0; fresh-order quarter-hour gate and final US41 replay check passed |
| [database-probes.log](database-probes.log) | Deliberate comparison-effectiveness probes — exit 0; changed open reason, changed resolution, deleted notifications and an extra reason each caused the exact assertion to refuse; probe subtransactions rolled back and the unchanged final assertion passed |

Each normal runner prints two PASS notices for this one ID, one after each migration;
these are two checkpoints of one grouped case, not two new test cases. The probe log
contains two baseline PASS notices, four EXPECTED REFUSAL notices and a final PASS.
The temporary probe harness used the actual comparison statement from the checked-in
test; no application or migration was edited. These deliberate checks are not product
defects or a TDD red/green cycle. Existing race-loser errors in gate logs are expected
when followed by their preservation assertions and a successful command exit.

All databases were disposable PostgreSQL 17 Docker containers. No shared Supabase
deployment, frontend suite/build, manual result, delivered email or new runtime
coverage percentage is claimed. Docker initially was stopped, then its socket required
execution outside the sandbox; starting Docker Desktop and allowing the local runs
resolved verification access. No database assertion failed during the normal runs.
CLI trailing whitespace/blank endings are normalised; result/error text is retained.

## Runner order and remaining gap

The new runner is the final operation in both existing CI database entry points. This
is deliberate: replaying 0052/0053 restores historical function definitions, so no
current-schema behaviour test may follow it in that disposable container. The existing
workflow therefore exercises it in historical, upgrade and fresh modes without a new
CI job. Never apply these historical replays to shared Supabase as a verification step.

The separate files `arrangement_revalidation.sql` and `arrangement_layout_capacity.sql`
contain ten older SQL case IDs but are not invoked by the current checked-in runners.
They remain source-mapped, not newly verified by this run. Restoring those behavioural
checks requires assessing their legacy fixtures against current contracts; it is not
claimed complete by adding this replay case. Eleven frontend US41 cases were not rerun.

No genuine product defect was found. No new automated-defect or manual-pass spreadsheet
row is justified. Supply the new integration-case overview row in chat; do not populate
Automated Test Case Runs, which remains owned by GitHub Actions.
