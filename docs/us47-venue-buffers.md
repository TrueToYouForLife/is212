# US47 — Configure venue setup and turnaround

Owner: Jaydon. Story: SCRUM-242. Updated: 21 October 2026.

## Current integration status

Migration 0098 and the Venue Staff settings panel are implemented locally on
`us47-buffer-settings-review`. Venue Staff can edit independent setup and turnaround
durations under Manage venues → Edit venue. Zero means none; valid durations are
non-negative multiples of 15 minutes. Settings apply per venue, including to new
holds; they are not chosen by Coordinators or separately on every approval.

The user confirmed 0074/0075 deployment and the preceding readability fix's manual
checks. 0098 is not applied to shared Supabase. This branch requires coordinated
0098/frontend deployment, CI review and the manual checks below before US47 is Done.
Historical checkpoints below describe earlier states and are superseded by this
section and the 0098 implementation section.

## Agreed direction

Venue setup and turnaround are independent durations in non-negative multiples of
15 minutes, defaulting to zero. Availability and conflict checks must include both
durations. Existing bookings and holds that become conflicting must remain recorded,
be flagged for review, and notify their Coordinators and Venue Staff.

The earlier on/off AM/PM/Night interpretation is superseded. The supporting change
to 15-minute bookings is included in this work. Development is code-first, with
short-lived branches and small coherent PRs.

## Foundation checkpoint — migration 0074

Branch: `us47-venue-buffer-settings`.

- Adds `venues.setup_minutes` and `venues.turnaround_minutes`, with zero defaults,
  NOT NULL and non-negative/multiple-of-15 constraints.
- Adds internal `venue_occupied_period(start, end, setup_minutes, turnaround_minutes)`.
  It returns an exact half-open timestamp range. For a 10:00–12:00 event with
  30-minute setup and 45-minute turnaround, the result is 09:30–12:45.
- Rejects null/non-finite or unordered event times and invalid buffer durations.
- Does not round event timestamps, allocate cells, change existing reservations,
  or replace the current booking calculations.
- Browser writes to these new fields are temporarily blocked, including Venue
  Staff writes, because current booking logic does not consume them yet. Existing
  venue edits continue to work. Trusted database operations can set valid values.
- No new public RPC or user interface is exposed. The later integration must
  replace the temporary guard with the final authorised save/review workflow.

This is partial implementation, not completion of AC-047.1 or AC-047.2. AC-047.3
is not implemented by this migration. Tests and evidence are recorded in
[US47 test cases](test-cases/US47_test_cases.md).

## Remaining portions

1. Integrate venue duration configuration with 15-minute booking creation,
   holds, approval, search, suitability, maintenance blocks and calendar displays.
2. Preserve existing occupied periods when converting legacy reservations and
   update historical-migration replay checks alongside affected consumers.
3. Detect conflicts caused by settings changes, preserve reservations, and
   record review flags and notifications for Coordinators and Venue Staff.
4. Complete regression checks, browser verification and shared evidence records.

Migration 0074 has not been applied to shared Supabase. Commits, pushes and PRs
are performed manually. No manual UI pass is claimed for this internal foundation.

## Conversion checkpoint — draft 0075, 19 October 2026

Branch: `us47-booking-time-integration`. Foundation merged; shared deployment of
0074 has not been explicitly confirmed in this checkpoint.

Draft `backend/supabase/migration-drafts/0075_venue_booking_time_integration.sql`
is deliberately outside the automatic migration sequence. **Do not deploy it:**
booking functions and frontend consumers are not yet compatible with this conversion.

The draft introduces 96 quarter-hour slots and expands saved legacy occupied cells
using their catalogue times. Booking identity, status, expiry and other metadata
are preserved. Event timestamps are not used to reconstruct old reservations.
Legacy gaps remain free. Block definitions are expanded too, including removed
blocks and active blocks overlapping reservations; removed blocks gain no claims.
Confirmed-claim and re-block triggers are disabled only within the conversion
transaction and restored before commit. Unexpected duplicate occupancy aborts
instead of silently discarding a reservation.

The separate disposable runner `backend/supabase/tests/run_venue_time_conversion.sh`
passed three grouped preservation cases, including a second application of the
draft. Evidence: [conversion database log](test-evidence/us47/conversion-database.log).
This is a focused conversion test, not a passing full post-conversion application
suite. The ordinary runner does not apply this draft.

The initial fixture omitted the removal author of a removed block. Correcting
the fixture satisfied the existing removal-record constraint; production rules
were unchanged. No product defect or TDD cycle is claimed.

## Calculation and block checkpoint — draft 0075

The new internal `venue_review_cells(venue_id, start, end)` overload reads venue
buffer durations and produces every touched 15-minute cell. Exact event timestamps
are retained; a partially touched cell is occupied conservatively. Buffer-only
cells are labelled separately. The older two-argument calculation remains for
callers that will be migrated in the next portion; it must not remain an active
booking path in the finished integration.

Block validation now uses the new catalogue, normalises duplicates and rejects
invalid/null inputs. Existing preview, saved-block, notification and re-block
behaviour is reused. Flag cell ordering now follows chronological quarter-hour
codes. Three grouped calculation/block cases passed, together with preservation
and replay checks. A draft SQL alias syntax error was corrected before this pass.

Still pending: booking/hold writes, approval and review-version integration,
arrangement rechecks, opening-hour validation, frontend consumers, full regression
checks and deployment. No commit or shared database change made at this checkpoint.

## Atomic hold checkpoint — draft 0075

Added `hold_venue(event_id, venue_id, hold_days default 3)`: validates assignment and bookable status, locks venue then event, and saves hold and venue-specific cells atomically. Conflicts roll back the operation. Existing three-calendar-day default and one-active-hold-per-event index remain unchanged. Selected-venue expired holds are cleaned up and active closure definitions checked before insertion.

AC-047.2.9–10 passed with the six preceding conversion/calculation/block cases. No defect surfaced in this run. Expiry cleanup, closure refusal and concurrency need explicit verification next. Frontend wiring, approval, other consumers and full regression remain pending. Draft is not ready for deployment or merge.

## Hold boundary verification — 19 October 2026

AC-047.2.11–13 now verify selected-venue expiry at the exact boundary, a setup-only
closure hidden beneath an expiring hold, atomic rollback on block refusal, and
two simultaneous overlapping hold requests. All passed with the earlier eight
cases. The concurrency loser is rejected with SQLSTATE 23505 and leaves no partial
booking; the winner retains all occupied cells. No implementation change was
needed and no defect was found by these checks.

Evidence: `docs/test-evidence/us47/hold-boundaries-database.log`. This is still a
focused draft-migration run, not full application regression. Approval and review
version integration are next; frontend integration and deployment remain pending.

## Approval integration checkpoint — draft 0075

Updated approval from 0045 and structured review from 0056 to use the venue-aware
15-minute calculation. Structured organiser requirements remain in the response.
The review version now includes venue data, so changing durations or other venue
settings invalidates an open review. Booking state is reread after acquiring locks.
Existing safeguards against unexpected saved cells, blocked periods and conflicting
claims remain; mismatched converted reservations are refused without mutation.

AC-047.2.14–16 passed alongside preceding focused cases (14 grouped cases total).
Evidence: `docs/test-evidence/us47/approval-database.log`. No defect surfaced in
this run. Approval concurrency, incomplete-timing review behaviour, remaining
callers and frontend integration still need verification. Draft 0075 is not ready
for deployment or merge; old two-argument callers remain elsewhere.

## Review regression and fix — 19 October 2026

AC-047.2.17 exposes a regression for an administratively created booking linked to incomplete draft timing: the new strict helper causes get_venue_booking_review to raise instead of returning details with conflict checking unavailable. Normal approved events require complete timing; no normal-path impact is claimed. Failure preserved. Fixed locally after reporting: a materialised input query excludes incomplete, non-finite or unordered timing before the review invokes the strict calculation. Booking details remain readable with conflictCheckAvailable=false. Hold and approval validation is unchanged. The original failing assertion now passes; all 15 grouped cases in the focused runner passed. Approval concurrency and full application regression remain pending. Not deployed.

## Approval concurrency verification — 19 October 2026

Separate database sessions now cover overlapping approvals, approval versus hold
in both orderings, and a trusted event edit while approval waits for the event
lock. AC-047.2.18–20 passed, including final status and occupied-cell assertions.
The focused runner passed all 18 grouped cases AC-047.2.3–20. No production fix
was required; one event-edit fixture was corrected to respect browser-edit guards.

Evidence: `docs/test-evidence/us47/approval-concurrency-database.log`. This
supersedes earlier notes that approval concurrency was pending. Remaining work:
other availability/revalidation callers, frontend integration, full regression
and coordinated deployment. No commit, push or shared database change made.

## Per-venue revalidation checkpoint — 19 October 2026

Replaced the timing calculations in the current 0063 shared arrangement-review
function with the venue-aware overload. Each booking uses its own venue durations.
Existing reason codes, source tracking, equipment checks and notification writer
are retained. No historic migration was edited.

A real coordinator planning edit checks two venues with different durations.
AC-047.2.21–22 passed: setup-only conflict affects only the buffered venue,
changed reservation timing is identified, saved confirmed bookings/cells remain
unchanged and replaying the same source produces no duplicate flags or notification
rows. All 20 grouped cases AC-047.2.3–22 passed in the isolated runner, including
previous concurrency checks. Evidence: `docs/test-evidence/us47/revalidation-database.log`.

No new defect found. This does not complete settings-change reviews (AC-047.3),
remaining availability/UI consumers or full regression. No commit, push or shared
deployment performed. Draft 0075 is not ready to merge.

## Frontend calculation checkpoint — verification pending

Added `venueOccupiedSlots.ts` with an explicit venue-duration input and 15-minute
Singapore occupied cells. It expands exact event times and conservatively includes
every touched cell, matching the database rule. The legacy helper and callers are
not switched yet; no visible application behaviour has changed in this checkpoint.
Three grouped unit cases AC-047.2.23–25 are written. Test, typecheck and lint runs
stalled without results; verification is pending. No pass is claimed.

## Search buffer integration checkpoint — 19 October 2026

The earlier frontend helper verification is complete: Jaydon reported its three
tests, typecheck and lint passing after npm ci. The focused search run reproduced
those test passes.

Venue search now reads setup_minutes/turnaround_minutes and computes occupied
cells separately for each candidate. Availability read failures and missing event
timing return an error instead of a successful unfiltered list. Two new grouped
service tests and existing search/helper tests passed (14 tests across three files);
typecheck and lint passed. Evidence is under docs/test-evidence/us47/search-*.

This search now expects migration 0075's quarter-hour occupancy and must not be
shipped against the legacy catalogue. Manual filter options, suitability, timetable,
booking writes and other frontend consumers still require integration. No full
regression or browser pass is claimed. No commit, push or deployment performed.

## Search selector checkpoint — 19 October 2026

Manual search offers 96 labelled quarter-hour choices in Singapore time. Shared
quarter-hour catalogue/labels include 23:45–24:00 and the previous lunch gaps.
SlotCode temporarily includes both old and new codes while other consumers await
conversion; legacy booking helpers have not been silently switched. Search requires
0075 and is still not independently deployable.

AC-047.2.28–29 passed with focused regressions (50 tests across four files).
Typecheck and lint passed. Logs: docs/test-evidence/us47/search-selector-*.log.
No new defect found. Suitability, timetable, block selectors and booking write
integration remain pending, followed by full regression and browser checks.

## Suitability checkpoint — 19 October 2026

Suitability now checks each venue's own setup and turnaround period against
quarter-hour claims, retaining the exclusion of the same event's own bookings.
Cross-midnight buffers extend the queried dates; adjacent cells outside the occupied
period do not conflict. Invalid durations/timing fail closed, and missing timing
continues to show an unavailable assessment. Overnight times now have catalogue cells.

AC-047.2.30–31 and suitability regressions passed (37 tests across two files).
Typecheck and lint passed. The first run exposed an incorrect test expectation
(all rooms suitable despite capacity limits); typecheck also required an explicit
test-fixture map type. These were test-code corrections, not product defects.
Logs: docs/test-evidence/us47/suitability-*.log.

This remains part of the coordinated 0075 conversion, not independently deployable.
Timetable, block selectors and booking writes remain pending, followed by full
regression and browser checks. No commit, push or deployment performed.

## Timetable display checkpoint — 19 October 2026

The single-venue grid renders every slot supplied by the timetable instead of
three hard-coded rows. Both timetable grids have bounded scrolling, sticky date
headings and Singapore-time column labels. Availability-page wording now describes
15-minute slots. Claim states, setup/turnaround labels and selection highlighting
are preserved; claims and booking writes are not changed by this display update.

AC-047.2.32–33 and existing component/page regressions passed: 40 tests across
four files, plus typecheck and lint. No product defect found in this run.
Evidence: docs/test-evidence/us47/timetable-*.log. Browser verification remains
pending with the coordinated 0075 deployment. Maintenance-block selectors and
booking-write integration are still pending. No commit, push or deployment made.

## Maintenance-block picker checkpoint — 19 October 2026

The block picker now offers all 96 quarter-hour cells in a scrollable checkbox
grid, with Full day selecting all cells. Validation rejects legacy or malformed
codes, including mixed valid/invalid input, and orders/deduplicates valid cells.
Saved block descriptions combine consecutive quarters into time ranges while
preserving gaps in converted legacy blocks. Full day is displayed only for all
96 cells. Block preview/save RPC contracts and removal behaviour are unchanged.

Existing US12 test IDs/scenarios were retained with quarter-hour fixtures. Three
new grouped cases AC-047.2.34–36 cover picker boundaries/disabled state, invalid
codes, and preserved legacy gaps. All 56 focused tests across 11 files passed;
typecheck, lint and diff whitespace checks passed. No product defect found.
The passing form tests emitted React act(...) warnings, recorded in the test log;
these are test-synchronisation warnings and are not evidence of a product defect.
Logs: docs/test-evidence/us47/block-picker-*.log.

Booking writes/remaining consumers and full regression/browser verification are
still pending. This requires the coordinated 0075 deployment and is not ready
to ship separately. No commit, push or shared Supabase change performed.

## Booking preview checkpoint — 19 October 2026

Venue details now include setup/turnaround minutes for the timetable preview.
The preview uses occupiedVenueCells with these durations and highlights its
quarter-hour cells. Selecting an event navigates to the first occupied date,
including the previous day when setup crosses midnight. Invalid timing or
durations produce an explanation and disable holding; zero buffers add no cells.

AC-047.2.37–38 and venue-read regressions passed (10 tests, two files). Typecheck,
lint and diff checks passed. No product defect surfaced in this run. Evidence:
docs/test-evidence/us47/booking-preview-*.log.

IMPORTANT: the hold save path is still legacy and has not been switched to the
atomic hold_venue RPC yet. Preview and save integration is not complete; do not
deploy or merge this draft as a finished booking change. Full regression and
browser verification remain pending. No commit, push or deployment performed.

## Booking-integration final checkpoint — 19 October 2026

Updated the branch to main d28e890 without creating a commit, preserving all US47
working changes. The normal 0075 migration, production frontend consumers, atomic
hold service, quarter-hour venue operating-hour choices and CI gates are now in
place. No production caller remains on claimsForEvent's legacy one-slot buffers.

Verification: full frontend coverage passed (169 files / 1,495 tests), typecheck and
lint and production build passed. Build log: integration-build.log. The historical DB
regression suite and both populated-upgrade/fresh-order conversion suites passed,
including preservation, replay and concurrency. Each conversion suite ran 21 US47
grouped cases. The forced-break .2.23 test failed as intended and passed after exact
restoration. Detailed evidence and limitations are in test-evidence/us47/README.md.

No new product defect was found during this completion pass. Full-suite failures
were old fixture/expectation mismatches after the slot-model conversion; a new test
fixture needed nullable typing. Existing product defect .2.17 remains documented.

Ready for PR preparation/review subject to CI and the pending manual smoke checks
in us47-booking-time-deployment.md. Shared Supabase is untouched. No commits,
pushes or PRs performed. Evidence-sheet rows/manual results still need updating.
This completes the booking-integration code scope, not all US47 acceptance criteria:
Venue Staff duration settings and settings-change flags/notices remain next-slice work.

### Booking preview readability

The coordinator booking preview summarises event time, setup, turnaround and total venue occupancy in Singapore time. Individual quarter-hour cells are collapsed under “View occupied 15-minute slots”. When timing falls between quarter-hour boundaries, a separate reserved slot range shows the rounded occupancy. Zero buffers show “None”; dates remain explicit across midnight. Venue Staff own the duration settings; this preview does not edit them. AC-047.2.37–38 cover the summary, collapsed detail, zero buffers and partial-cell boundaries.

### Coordinator timetable usability fix — 21 October 2026

The single-venue calendar retains date columns but groups quarter-hour occupancy into readable ranges within three display sections (00:00–12:00, 12:00–18:00, 18:00–24:00). Different bookings, statuses, buffers, maintenance reasons, gaps and selected periods remain distinct. These are display sections, not legacy booking blocks. AC-047.2.32 covers grouping; manual retest is pending. No migration is required; 0098 remains reserved for Venue Staff settings.

The My bookings page also groups saved quarter-hour claims into reserved time ranges, separately by date and event/buffer role. It preserves gaps and uses saved occupancy rather than recalculating history from current venue settings. This is a display-only regression change; manual retest pending.

Venue Staff booking review now uses the same compact saved/requested time-range display. Conflict warnings remain visible, with individual conflicting slots retained in an expandable list for investigation. Manual retest pending.

### Venue Staff buffer settings — migration 0098

- Staff-only RPCs validate durations and protect stale edits. Direct browser updates
  remain blocked. Unchanged saves create no new history, reviews or notices.
- Saves lock the venue and atomically record settings, venue history, open arrangement
  reviews and notifications for overlapping live reservations. Existing booking and
  claim rows are preserved. Decreasing settings does not silently clear open reviews.
- A security-invoker occupancy view combines saved reservations with newly required
  buffers calculated from saved event cells. It preserves original reserved periods
  even when settings shrink, and preserves gaps. Search, suitability, availability,
  timetable, hold conflict checks, staff review, maintenance and event revalidation
  consume the effective occupancy where needed. History still reads saved claims.
- A claim trigger prevents subsequent holds/approvals from taking another booking's
  new buffer cells. Venue locking serialises these writes with settings changes.
- Each distinct conflicting settings save sends fresh `venue_buffer_review` notices
  through the existing notification helper to the assigned Coordinator and Venue
  Staff. There is no per-venue staff assignment in the current model, so all Venue
  Staff are recipients. In-app/email preferences are respected. Email is queued;
  delivery is not proven by these tests.
- Existing `venue_time_conflict` reviews and Coordinator resolution UI are reused.
  No review-reason constraint or equipment rules are changed.

A duplicate readability log was byte-identical to the original and removed.

### Automated-test defect

AC-047.1.3 initially failed because a PL/pgSQL message variable was incorrectly
qualified as a table reference when refreshing an existing notice. Saving settings
rolled back. The final implementation uses an unambiguous `v_detail` variable and
fresh notices through `send_notification`; the same settings-save case now passes.
Failure: `test-evidence/us47/AC-047.1.3-settings-save-failure.log`.
Record under Defects (Automated Testing); no shared database was affected.

### Deployment and manual verification

After PR approval, coordinate applying `0098_venue_buffer_settings.sql` with deploying
this frontend. It requires 0075 and the existing notification/venue review migrations.
The frontend reads the new occupancy view, so do not deploy it against a database
without 0098. Do not replay historical migrations after it.

Manual results for this settings portion are **pending**:

1. Venue Staff: Manage venues → Edit an active test venue. Check a new venue starts
   at 0/0. Save 15 setup and 30 turnaround, reload and confirm persistence. Try -15,
   16 and a blank value; each must be refused without losing saved settings.
2. Assigned Coordinator: create a future 10:00–11:00 event hold at that venue.
   Check the summary and calendar include 09:45–11:30 occupancy. Try another event
   overlapping only its setup/turnaround; it must be refused. Existing history
   must remain readable as ranges.
3. Use a separate test venue at 0/0 with two future reservations, 10:00–11:00 and
   11:30–12:30. Venue Staff save 15/30. Check both bookings remain and both show
   Needs review. Check assigned Coordinator and Venue Staff notifications.
4. Resolve one arrangement using the existing Coordinator flow. Change settings
   again to produce a conflict; check a fresh notice appears. Saving unchanged
   values must not produce another notice. Check notification preferences separately;
   an email outbox row is not evidence of delivered email.
5. Open settings in two tabs. Save one, then save stale values in the other: require
   reload. A Coordinator must not have access to this settings page/RPC. A retired
   venue must not offer timing edits.

Shared-sheet overview, automated defect and manual results need updating after
review. Automated runs remain recorded by GitHub Actions; do not duplicate those in
its Automated Test Case Runs tab. Commits, pushes, PR and deployment remain manual.

### Final local verification — 21 October 2026

Full frontend coverage: 170 files / 1,500 tests passed; typecheck, lint and production
build passed. Historical database regressions, populated upgrade and fresh install
all exited 0. Conversion runners include 0098 replay, settings cases and hold/approval
concurrency checks. These are local results; PR CI and manual settings checks remain
pending. Logs are indexed in `docs/test-evidence/us47/README.md`.
