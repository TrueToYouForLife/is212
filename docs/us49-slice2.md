# US49 Slice 2: independent decisions, booking summary and readiness

Branch: `us49/slice2-booking-status-readiness`. Migration **0107** reserved by Justas.
Based on main `af37848`, which includes Slice 1 / PR #146.
Scope: AC-049.4, AC-049.5 and AC-049.6. Code-first, with tests added after each change.

## Behaviour and agreed interpretation

- Existing staff approval/rejection remains per booking. New real-database tests
  verify that a decision preserves sibling records and reservations.
- The assigned coordinator sees **All venue bookings** on the event request page,
  including held, pending, approved, rejected, cancelled and expired bookings.
  Each entry includes the recorded layout/attendance, decision note and suggested
  alternative where available. Historical unknown requirements are labelled.
- The list refreshes every 30 seconds, on window focus, on the page's refresh, and
  through its own refresh button. Failed reads show an error and remove stale data.
  The checked RPC refuses unauthenticated users and anyone other than the current
  assigned coordinator. It does not expose internal staff identities.
- US5 venue readiness requires at least one approved booking, no pending/live-held
  booking and no rejected booking. The user explicitly confirmed that rejection
  must remain outstanding. Cancelled and expired attempts retain their existing
  historical treatment. Other readiness arrangements are unchanged.
- Adding an unrelated approved booking does not silently satisfy a rejected
  requirement. An explicit cancellation or a workflow that supersedes the original
  is needed. The coordinator's individual cancellation controls are Slice 3;
  the cancellation readiness test simulates that later state as a fixture only.
- This is a readiness indicator, not a new automatic event-status transition or
  a new restriction on the existing Confirm event action.

## Tests and evidence

Evidence: `docs/test-evidence/us49-slice2/`.

- Full frontend suite: **180 files / 1,548 tests passed** (`frontend.log`).
- Standalone typecheck, lint and production build passed (`build.log` includes
  the build's typecheck). Existing bundle-size warning remains.
- `database-upgrade.log`, `database-historical.log`, `database-fresh.log`:
  disposable PostgreSQL suites; expected losing concurrent transactions may print
  SQL errors, so use exit status and final PASS assertions.
- `AC-049.5.34-forced-break.log`: temporarily accepted a null RPC response as an
  empty list; the test failed because missing data must not look like no bookings.
  Source restored immediately. This is code-first test verification, not TDD red.
- Coverage results/report are retained alongside these logs. Vitest does not
  measure PostgreSQL function coverage; SQL behaviour is covered by real database
  assertions and replay tests.
  The restored-code coverage run passed all 1,548 tests. Overall coverage is
  96.11% lines/statements, 90.68% branches and 95.13% functions. Both new production
  files (`EventVenueBookings.tsx` and `eventVenueBookingsService.ts`) report 100%
  across those metrics. Extract `coverage-report.zip` and open `index.html`.

New test sources:

| File | Cases |
| --- | --- |
| `backend/supabase/tests/multi_venue_readiness.sql` | AC-049.4.1-3, AC-049.5.1-4, AC-049.6.1-7 |
| `frontend/src/features/events/__tests__/EventVenueBookings.test.tsx` | AC-049.5.30-32 |
| `frontend/src/features/events/__tests__/eventVenueBookingsService.test.ts` | AC-049.5.33-34 |

The database suite runs the 14 cases before and after replaying 0107. Tests cover
mixed statuses, no bookings, all approved, a newly added hold, rejection, explicit
cancellation, sibling preservation, failed reads and assignment access. Initial
reassignment fixture failure was caused by a stale simulated actor; corrected
before the successful run, not recorded as a product defect.

## Manual review after deployment

1. Assigned Coordinator: open an event with two pending venue requests. See both
   entries and outstanding venue readiness.
2. Venue Staff: approve the first request. Coordinator: refresh the event; one
   entry is Approved, the other awaits staff, and readiness remains outstanding.
3. Venue Staff: reject the second with a reason and optional alternative.
   Coordinator: refresh; both decisions remain visible, the approved booking
   remains reserved, and readiness explains the rejected requirement.
4. On another event with two requests, approve both. Venue readiness is complete;
   unrelated readiness lines retain their own status.
5. Reassign the event through Coordinator Lead. The former coordinator must no
   longer receive its booking summary. Verify with a reload/new request.

Manual browser checks and deployment are not claimed. Migration 0107 has not
been applied to shared Supabase. No commit, push or PR was created for Slice 2.
Review impact: shared **US5 readiness** and the event detail page; no changes to
US10 decision functions or notification preferences.

## Scrum record

Keep the full passing summary, forced-break failure/restored passing run, coverage
report and eventual commit/PR link. Screenshots are optional when logs are retained.
Use the AC IDs above in the evidence sheet. Remaining scope is Slice 3 (AC7-9):
individual cancellation, preservation of other arrangements and cancellation notices.
