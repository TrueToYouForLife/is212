# US27 test evidence

Owner: Jaydon. PR1 verification: 23 October 2026.

Logs record actual local commands/results. Database runs use disposable local Docker
PostgreSQL with simulated Auth interfaces. They do not demonstrate shared Supabase
deployment, browser acceptance or email delivery. Manual checks and evidence-sheet
updates remain pending. Paste sheet rows from chat; do not add TSV files here.

No product defect has been demonstrated in this portion. The initial service-test
failure was an unsupported Vitest matcher; it was fixed in test code. Docker initially
was inaccessible/stopped; starting Docker Desktop allowed local database testing.

## Results and limits

- `frontend-coverage.log`: 175 files / 1,524 tests passed. Overall coverage:
  96.07% statements/lines, 90.53% branches, 95.13% functions.
- `build.log`: typecheck and production build passed (existing large-bundle warning).
- `lint.log`: lint passed. Shell syntax and whitespace checks also passed.
- `database-focused-initial.log`: initial current-schema integration run passed
  before adding the reserved-unit fixture and exact reservation-preservation snapshot.
  This is partial evidence, not a pass for the final SQL test file.
- `database-focused-final.log`: final US27 SQL cases passed, including the reserved
  Operational unit and exact unit/booking/allocation preservation assertions.
- `database-historical.log`: historical database regressions and concurrency passed.
- `database-upgrade.log`: quarter-hour upgrade, US27 cases and concurrency passed.
- `database-fresh.log`: fresh migration order, US27 cases and concurrency passed.
- All four database commands exited 0. Concurrency logs include deliberately refused
  losing requests followed by preservation assertions; these are expected results,
  not product defects. The accidental approval rejection was resolved when Jaydon
  authorised resuming the checks. Frontend results above remain valid; no product
  code changed after that full run. CI, shared deployment and manual checks remain pending.

## PR2 status backend checkpoint

Jaydon confirmed PR1 merged (#142), 0104 applied, and all seven chat manual groups
passed. Shared sheet updates and separate offline/zero-stock manual execution are
not claimed. PR2 uses claimed 0105 and has not been deployed to shared Supabase.

The focused status integration suite (18 grouped cases), all three status/reservation
races and populated migration replay passed. The initial race script used malformed
fixture UUIDs, corrected in test code; this is not a product defect. Deliberate
review/notice failures and losing concurrency calls are expected refusals.
Historical, upgrade and fresh-order final PR2 gates all exited 0, including the
new status races and existing regressions. Logs are under `pr2/database-focused.log`,
`pr2/database-historical.log`, `pr2/database-upgrade.log` and `pr2/database-fresh.log`.
No new frontend full-suite result is claimed for this backend-only portion.
Migration 0105, status UI and manual status-flow verification are not deployed/completed.
