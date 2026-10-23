# US27 PR3 — frontend evidence

Owner: Jaydon. Verification date: 23 October 2026.

PR3 merged in #144. Jaydon reported the chat status-flow and subsequent auto-close
manual checks passed; see `../manual-results.md`. Shared evidence-sheet update remains
pending. The verification section below describes the pre-refinement checkpoint;
final auto-close checks are recorded at the end. No full-suite rerun is claimed. Code-first development.

Eleven new cases cover status validation/service handling and real panel/catalogue
components with mocked services. They do not establish live Supabase Auth/API access,
shared frontend deployment, manual acceptance or delivered email. Migration 0105 was
already applied according to Jaydon; this portion changes no database schema or functions.

## Genuine defect

`AC-027.2.3-stale-status-after-save.log`: a confirmed save refreshed stock but left
the open panel showing Operational and old history/version. Fast React-batched catalogue
refreshes can skip rendering loading, so the panel did not reliably unmount/reload.
The initial fix keyed the panel by selected unit and refresh revision, explicitly reloading it
after success. The same expectation passed in the targeted retest. No reservation or
audit loss was demonstrated. Record this as an automated product defect, owner Jaydon.

## Environment issues

Initial verification spent several minutes reading local dependency files. Typecheck
also reported missing standard Promise definitions across existing code; it passed on
retry without project configuration, lockfile or dependency changes by this portion.
Exact root cause is unconfirmed. These are separate from the product defect above.
No simulated break is presented as a discovered defect.

## Verification

- Targeted retest: 17 tests / three files passed (11 new status cases, six catalogue regressions).
- Typecheck passed on the final retry.
- `frontend-coverage.log`: full suite passed, 1,535 tests / 177 files. Overall coverage:
  96.12% statements/lines, 90.60% branches, 95.22% functions.
- `lint.log`: lint passed. `build.log`: typecheck and production build passed, with the
  existing large-bundle warning. Whitespace checks passed. All final commands exited 0.
- `targeted-retest.log` and `typecheck.log` retain the successful targeted/final checks.
- No database test rerun is claimed for this frontend-only portion. PR2's real PostgreSQL,
  rollback, permission and concurrency evidence remains under `../pr2/`.
- At this checkpoint, status-flow manual checks and sheet updates were pending; later
  manual feedback is recorded below. Sheet rows are
  supplied through chat; do not create TSV files or populate Automated Test Case Runs.

## Manual feedback refinement

Jaydon reported the status checks were okay, then requested automatically closing the
panel after a confirmed save so another unit can be managed immediately. Confirmed
no-ops also close; errors/stale saves retain the panel and note. This supersedes the
earlier refresh-revision key; reopening reads fresh status/history/version. AC-027.2.3
was extended to verify automatic close, another-unit management and reopening history.
Jaydon confirmed the manual auto-close check passed after previously reporting status
checks passed (23 October 2026). Exact fixture/account IDs and email delivery were not
supplied; do not infer separate execution of every optional checklist scenario. The earlier full-suite log
predates this small refinement; subsequent targeted/build/lint checks are recorded separately.

- `autoclose-tests.log`: 13 tests / two files passed, including the extended AC-027.2.3.
- `autoclose-build.log`: typecheck and production build passed.
- `autoclose-lint.log`: lint passed. Whitespace check passed; all commands exited 0.
