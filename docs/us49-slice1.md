# US49 Slice 1: multiple venues and per-booking requirements

Branch: `us49/slice1-multiple-venue-bookings`, based on main `0a5c90b`.
Migration: `0102_multi_venue_requirements.sql` (reserved by the team).
Scope: AC-049.1 through AC-049.3. Code-first development, followed immediately
by AC-labelled tests; the forced-break exercise below is not TDD red evidence.

## Behaviour

Assigned coordinators can hold multiple different venues for one eligible event.
Each new booking records its selected venue layout and positive whole-number
attendance. The timetable asks for these fields and My venue bookings displays
them. Staff review uses the booking's requirements, rather than the total event
attendance. Capacity, required facilities/accessibility, availability, closures,
setup and turnaround protection remain checked independently for each space.
Approval rechecks suitability; a failure preserves other bookings.

Migration 0102 retains existing booking rows without inventing historical layout
or attendance values. Legacy rows continue to use event requirements. Pending
replacement consent versions remain valid for those rows. Replacement approval
copies explicit requirements to the replacement booking. Direct browser inserts
and changes to checked requirement fields cannot bypass the checked RPC.

## Verification and evidence

Evidence directory: [test-evidence/us49-slice1](test-evidence/us49-slice1/).

- `frontend.log`: 174 test files and 1,522 tests pass.
- `coverage.log`: the same full suite passes with coverage enabled.
- `coverage-summary.json` and `coverage-report.zip`: machine-readable and HTML
  reports. Extract the ZIP and open `index.html`. Overall statements/lines 95.72%,
  branches 90.53%, functions 94.94%; this is not a claim of 100% coverage.
- `database-upgrade.log`: historical-to-current schema upgrade, US49 checks,
  migration replay and existing concurrency regressions pass.
- `database-fresh.log`: fresh schema, all 18 US49 SQL assertions, replay and
  existing concurrency regressions pass. Includes AC-049.2.7, which explicitly
  checks preservation of existing pending replacement consent versions.
- `database-historical.log`: the full historical database regression suite passes.
- `AC-049.2.31-forced-break.log`: temporarily changed the minimum attendance
  validation from `< 1` to `< 0`; the zero-attendance assertion failed. Restored
  the original code before the successful full coverage run.
- `build.log`: typecheck and production build pass; existing bundle-size warning.
- ESLint and the standalone typecheck also passed during implementation.

SQL assertions exercise real PostgreSQL transactions and permissions. Vitest's
JavaScript coverage does not measure SQL coverage. Expected losing transactions
in concurrency tests can print SQL errors; use the final assertions and process
exit status to distinguish these from suite failures.

Test sources: `backend/supabase/tests/multi_venue_requirements.sql`, the US49
replay assertions in `run_venue_time_conversion.sh`,
`frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx` and
`frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts`.
Existing timetable/page tests were updated to fill the new required inputs.

## Manual showcase (after deployment)

1. Use an assigned Event Coordinator and an Approved/Planning event. Enable the
   existing venue-booking feature flag and use active venues with offered layouts.
2. Open the first venue timetable, select the event, layout and attendance, and
   hold the venue. Repeat at a second venue for the same event with different
   attendance. Both bookings should remain visible in My venue bookings.
3. Try attendance above the selected layout's capacity, or an occupied venue/time.
   The request should fail without releasing either successful booking.
4. As Venue Staff, open each submitted booking's review. Check that attendance
   and layout belong to that booking. Approving one must not decide the other.

These browser steps remain manual checks; automated results are not evidence of
deployment to shared Supabase. Apply the migration through the team's normal
release process before running this frontend against that database.

## Remaining slices

2. Independent decisions, all-booking status display and readiness (AC4-6).
3. Individual cancellation, preservation of other bookings/events and staff
   notifications/audit (AC7-9).

For Scrum evidence, retain the forced-break failure, full passing summary,
coverage report and eventual commit/PR links. Screenshots are optional when
these logs are retained; label the forced break accurately as code-first test
verification. This slice is pushed for review in PR #146, but has not been merged
or applied to shared Supabase.

## PR #146 conflict resolution (23 October 2026)

Integrated main `dbc55c0`. The two conflicting database runners now preserve both
0102 and 0103 exclusions from the historical migration loop, and run the US49
requirements tests before the US33 notification and US27 equipment tests in the
current-schema runner. No change to migration 0102 was needed.

Validation after integration: 178 frontend files / 1,541 tests pass, typecheck
and lint pass, and historical, upgrade and fresh database suites pass including
concurrency checks. See `merge-main-frontend.log` and
`merge-main-database-{historical,upgrade,fresh}.log` in the evidence directory.
The earlier coverage report belongs to the original Slice 1 run.
