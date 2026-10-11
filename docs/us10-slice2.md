# US10 Slice 2: pending booking review

## Current checkpoint: Slice 2 complete locally (AC1, AC2 and AC3)

Branch: `us10/pending-venue-review`, based on main `a28842c`, which includes
the merged Slice 1 implementation. No push or PR has been performed for this branch.
The unrelated untracked root `package-lock.json` has been left untouched.

The team explicitly switched the remaining US10 slices to code-first development.
For each AC, implementation came first, then its tests were added immediately before
moving to another AC. Code and tests are committed together with AC-tagged messages.
The forced-break record below demonstrates test effectiveness; it is **not TDD
RED evidence**. Slice 1's existing RED/GREEN evidence is unchanged.

## AC1 delivered

- Venue Staff get a Booking requests navigation link and `/venues/review` page,
  under the existing `VITE_FEATURE_VENUE_BOOKING` switch.
- The service requests only `pending_approval` rows, oldest first with an ID
  tie-breaker. Each queue item opens the existing Slice 1 decision page.
- Empty/loading states are explicit. Failed reads show an error with manual reload,
  not a misleading empty queue. Other roles do not load the page's queue.
- Stale responses from a previous staff session cannot overwrite the current queue.
  Existing booking RLS remains unchanged; the frontend gate is not a new database policy.

## Validation and coverage

- Full frontend run with coverage: **92 files passed; 889 tests passed, 1 existing TODO**.
- Full disposable database runner: **exit 0**, including the existing 20 US10
  rejection checks and all **22 new AC2/AC3 database assertions**.
- Typecheck, lint and build passed. Build retains its non-failing chunk-size warning.
- The queue service/page, review service, request-details component and conflict component each have **100% lines, statements, branches and
  functions** covered. Across all configured feature files: **87.96% lines/statements,
  87.30% branches, 93.16% functions**. The repository-wide 100% target is not reached;
  remaining gaps are outside those five files. Coverage scope was not narrowed.
- SQL assertions are behavioural integration tests; Vitest cannot measure PL/pgSQL
  coverage. Do not combine SQL pass counts with frontend coverage percentages.
- CI now runs `npm run coverage` and uploads the complete `frontend-coverage`
  artifact, including HTML, LCOV and JSON summary. This workflow change has been
  checked locally but has not run on GitHub for this unpushed branch.

## Forced-break evidence

In `venueBookingQueueService.ts`, the status filter was temporarily changed from
`pending_approval` to `confirmed`. AC-010.1.1 failed on the wrong query value:
**1 failed, 3 passed**, exit 1. The original bytes were restored in a `finally`
block; the defect was never committed. The restored full coverage run above passed.
This proves that the query-contract assertion detects the wrong filter. It does
not by itself prove real Supabase API behaviour.

Saved artifacts under `docs/us10-slice2-evidence`:

- `AC-010.1.1-forced-break.log`: deliberate failure.
- `AC-010.1-restored-full-frontend.log`: restored full-suite run and coverage.
- `full-database.log`: historical AC1 database checkpoint.
- `AC-010.2-frontend.log`, `AC-010.2-database.log`: AC2 checkpoint.
- `AC-010.3-frontend.log`, `AC-010.3-database.log`: AC3 focused checkpoint.
- `slice2-final-frontend.log`, `slice2-final-database.log`: final complete suites.
- `typecheck.log`, `lint.log`, `build.log`: final validation outputs.
- `coverage-summary.json`: machine-readable measured coverage.
- `frontend-coverage.zip`: complete coverage report; extract and open `index.html`.

Logs are saved console output normalized to UTF-8 without terminal colour codes.
Copy the coverage archive/report and the evidence rows below into submission folder 3.
The owner and PR fields must be filled with the actual person and PR after creation;
no owner or PR URL has been invented.

## Evidence rows for Nicole's sheet

All rows: story **US10**, criterion **AC1**, owner **to fill**, PR **not opened**.
The UI tests use a mocked service, so they are component unit tests, not database
integration or end-to-end tests. Commit references are listed below; individual test names carry full AC IDs.

| Test ID | Test name/scenario | Type | Scenario class | Test file | Forced-break log |
| --- | --- | --- | --- | --- | --- |
| AC-010.1.1 | Only pending rows, stable oldest-first order | Unit | Normal | venueBookingQueueService.test.ts | AC-010.1.1-forced-break.log |
| AC-010.1.2 | No matching requests gives an empty queue | Unit | Boundary | venueBookingQueueService.test.ts | — |
| AC-010.1.3 | Database refusal is not an empty queue | Unit | Failure | venueBookingQueueService.test.ts | — |
| AC-010.1.4 | Interrupted request returns an error | Unit | Failure | venueBookingQueueService.test.ts | — |
| AC-010.1.5 | Queue links to the correct booking review | Unit (component) | Normal | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.6 | Empty queue has an explicit message | Unit (component) | Boundary | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.7 | Failed load can be retried manually | Unit (component) | Failure | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.8 | Another role cannot load the staff queue | Unit (component) | Failure | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.9 | Unreadable venue retains its queue item | Unit | Failure | venueBookingQueueService.test.ts | — |
| AC-010.1.10 | Successful null rows map to an empty queue | Unit | Boundary | venueBookingQueueService.test.ts | — |
| AC-010.1.11 | Wait for session loading to finish | Unit (component) | Boundary | VenueBookingQueuePage.test.tsx | — |
| AC-010.1.12 | Older response cannot overwrite a new session's queue | Unit (component) | Conflict | VenueBookingQueuePage.test.tsx | — |

## Capture commands (PowerShell, repository root)

```powershell
# Deliberate failure: capture the AC identifier, wrong filter and failing totals.
Get-Content -Encoding UTF8 .\docs\us10-slice2-evidence\AC-010.1.1-forced-break.log

# Restored full-suite totals and aggregate coverage.
Select-String -Path .\docs\us10-slice2-evidence\slice2-final-frontend.log -Pattern 'Test Files','Tests  ','All files'

# All 22 new database assertions (AC2 and AC3), including permissions and boundaries.
Select-String -Path .\docs\us10-slice2-evidence\slice2-final-database.log -Pattern 'PASS: AC-010\.[23]\.'

# Find the AC-tagged implementation/test commit; use --all until the branch is merged.
git log --all --oneline --grep='US10'
```

## AC2 and AC3 delivered

Migration **0044_venue_booking_review_details.sql** was reserved by the team and
created on this branch. Its staff-only RPC returns details for an existing booking,
including event timing, attendance, organiser notes and structured venue requirements.
It does not grant general SELECT access to events. Missing optional requirements
remain explicit, and other roles are refused at the database boundary.

Conflicts are calculated from the stored timing using Singapore half-open slot
windows, including the preceding setup and following turnaround cells. The read
shows confirmed bookings and active venue blocks, excludes the booking's own claims,
removed blocks and other venues, and reports unavailable timing instead of falsely
showing no conflicts. These are display checks; approval-time enforcement is Slice 3.

Migration 0044 has been exercised only in the disposable test database. Apply it
through the team's normal deployment process before deploying the frontend that
calls the new RPC. No shared database was changed.

## Local commits and next steps

- `be5aa56`: AC1 queue, immediate tests, forced-break evidence and CI coverage.
- `1dd90f5`: AC2 restricted details read and immediate tests.
- `7257a44`: AC3 conflict display and immediate tests; stronger AC2 timing assertions.

Latest fetched main remained `a28842c`, already an ancestor of this branch, so no
merge conflict exists against that checked version. Recheck before merging because
main can advance. Push and PR creation await the user's go-ahead. Capture the PR's
successful CI checks and eventual merge separately; local results do not prove CI ran.
Two slices remain after Slice 2: Slice 3 approval, then Slice 4 notifications and
final user-story documentation.

## Additional evidence rows for Nicole's sheet

All rows below: story **US10**, owner **to fill**, PR **not opened**.
AC2 maps to commit `1dd90f5` (timing assertion strengthened in `7257a44`);
AC3 maps to `7257a44`. No additional forced break was needed: the saved AC1 break
satisfies the team's at-least-one-per-story rule. Screenshot the saved failure once,
the final passing totals, and the coverage report. Retain logs and commit/PR links
as the reproducible evidence; screenshots are supporting illustrations.

| Test ID | Test name | Type | Scenario |
| --- | --- | --- | --- |
| AC-010.2.1 | Venue Staff read the booked event timing and requirements | Integration (database) | Normal |
| AC-010.2.2 | missing booking is unavailable | Integration (database) | Failure |
| AC-010.2.3 | organiser cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.4 | coordinator cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.5 | coordinator_lead cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.6 | operations_manager cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.7 | tech_support cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.8 | attendee cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.9 | signed-out caller cannot read privileged booking details | Integration (database) | Failure |
| AC-010.2.10 | missing optional requirements remain explicit | Integration (database) | Boundary |
| AC-010.2.11 | RPC does not grant direct access to unrelated event fields | Integration (database) | Failure |
| AC-010.2.12 | displays stored timing in Singapore and both sets of venue requirements | Unit (component) | Normal |
| AC-010.2.13 | absent optional fields are explicit without inventing requirements | Unit (component) | Boundary |
| AC-010.2.14 | recorded empty lists are distinct from missing requirements | Unit (component) | Boundary |
| AC-010.2.15 | successful RPC read preserves event requirements | Unit (service) | Normal |
| AC-010.2.16 | permission errors do not expose the server message or booking data | Unit (service) | Failure |
| AC-010.2.17 | a missing RPC row is unavailable | Unit (service) | Failure |
| AC-010.2.18 | an interrupted read is unavailable without automatic retries | Unit (service) | Failure |
| AC-010.3.1 | confirmed booking conflicts with the setup buffer | Integration (database) | Conflict |
| AC-010.3.2 | confirmed booking conflicts with the event cell | Integration (database) | Conflict |
| AC-010.3.3 | active block conflicts with the turnaround buffer | Integration (database) | Conflict |
| AC-010.3.4 | a booking does not conflict with its own claims | Integration (database) | Boundary |
| AC-010.3.5 | pending claims are not mislabelled as confirmed-booking conflicts | Integration (database) | Boundary |
| AC-010.3.6 | a removed block no longer creates a conflict | Integration (database) | Boundary |
| AC-010.3.7 | an end exactly at PM start does not occupy PM as an event cell | Integration (database) | Boundary |
| AC-010.3.8 | occupied cells outside the event and buffers do not create false conflicts | Integration (database) | Boundary |
| AC-010.3.9 | morning setup uses the previous Singapore days final slot | Integration (database) | Boundary |
| AC-010.3.10 | missing event timing is unavailable rather than a successful no-conflict result | Integration (database) | Failure |
| AC-010.3.11 | another venues occupied cells do not appear as conflicts | Integration (database) | Boundary |
| AC-010.3.12 | displays confirmed event and blocked buffer conflicts with their causes | Unit (component) | Conflict |
| AC-010.3.13 | successful empty conflict results have an explicit message | Unit (component) | Normal |
| AC-010.3.14 | unavailable timing never appears conflict-free | Unit (component) | Failure |
| AC-010.3.15 | a missing conflict list fails closed | Unit (component) | Failure |
| AC-010.3.16 | a missing requested-cell list fails closed | Unit (component) | Failure |
| AC-010.3.17 | the routed review displays event details and conflict information together | Unit (component) | Conflict |
