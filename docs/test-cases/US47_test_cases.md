# US47 test cases

Owner: Jaydon. Updated: 19 October 2026. Code-first development.

These foundation cases cover database primitives, not the complete user-facing ACs.
File: `backend/supabase/tests/venue_buffer_foundation.sql`, except the replay check
in `backend/supabase/tests/run_change_request_review.sh`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.4.1 | Integration Test - Happy path | New venues default both durations to zero |
| AC-047.1.1 | Integration Test - Happy path / Negative / Boundary | Independent valid durations are stored; negative, non-multiple-of-15 and null values are refused |
| AC-047.2.1 | Integration Test - Happy path / Boundary | Customer example, zero buffers, cross-day periods and non-overlapping adjacent half-open ranges |
| AC-047.2.2 | Integration Test - Negative | Internal calculation refuses invalid event times and buffer durations |
| AC-047.1.2 | Integration Test - Negative / Regression | Browser cannot change inactive settings or execute the helper; ordinary venue edits remain available |
| AC-047.4.2 | Integration Test - Regression | Replaying 0074 preserves populated venue, booking and occupied-cell records |

The temporary browser-write restriction is a foundation safeguard, not the final
Venue Staff configuration behaviour. Update that case when the configuration flow
is enabled. Next unused IDs: AC-047.1.3, AC-047.2.3, AC-047.3.1, AC-047.4.3.

Verification: full disposable database suite passed, including all six foundation cases and existing concurrency checks. Evidence: [database log](../test-evidence/us47/foundation-database.log). No frontend changed;
no browser checks or shared-Supabase deployment claimed. Shared evidence sheet
has not yet been updated for this portion.

## Draft 0075 conversion cases — 19 October 2026

All three passed in the standalone disposable conversion runner. Fixtures include
confirmed, held and pending bookings, event dates differing from booked dates,
cross-day buffer occupancy, an overlapping active block and a removed block.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.3 | Integration Test - Happy path / Boundary / Regression | Exactly 96 slots; saved event/buffer/maintenance occupancy and all booking metadata preserved |
| AC-047.2.4 | Integration Test - Boundary / Regression | Active overlapping and removed blocks retain exact periods, gaps and metadata; removed blocks gain no claims; triggers restored |
| AC-047.2.5 | Integration Test - Regression | Repeating conversion preserves the catalogue, claims and block definitions |

Files: `venue_time_conversion_fixture.sql`, `venue_time_conversion_verify.sql`
and `run_venue_time_conversion.sh` under `backend/supabase/tests/`.
Next unused AC-047.2 ID: **AC-047.2.6**. No shared deployment or manual UI tests.
Draft migration is excluded from the normal migration runner until integration
is complete. These passes do not claim full AC-047.2 completion.

## Venue-aware calculations and blocks — 19 October 2026

File: `backend/supabase/tests/venue_time_calculations.sql`. Three grouped cases
passed in the standalone runner alongside the three conversion/replay cases.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.6 | Integration Test - Happy path / Boundary | Venue-specific 30/45-minute buffers, midnight crossing, zero buffers, lunch-time slots and conservative occupancy of partial cells |
| AC-047.2.7 | Integration Test - Negative | Legacy/invalid/null slot codes, empty selections and null dates refused; helper remains internal and unsigned block preview is refused |
| AC-047.2.8 | Integration Test - Happy path / Regression | Quarter-hour blocks normalise duplicate codes, flag overlapping holds without deleting them, reclaim released cells and preserve bookings when removed |

Next unused AC-047.2 ID: **AC-047.2.9**. Current tests do not establish that
approval, hold creation or the frontend use the new calculation yet.

## Atomic hold checkpoint — 19 October 2026

File: `backend/supabase/tests/venue_time_holds.sql`. Both grouped cases passed alongside the six conversion/calculation/block cases.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.9 | Integration Test - Happy path | Assigned Coordinator creates a hold with venue-specific buffers, requester and existing three-day expiry default |
| AC-047.2.10 | Integration Test - Negative / Regression | Overlap, unassigned event and zero expiry rejected without partial bookings or changed existing cells |

Next unused ID: **AC-047.2.11**. Expiry cleanup, closure refusal and concurrency still require explicit verification.

## Hold boundaries and concurrency — 19 October 2026

Files: `backend/supabase/tests/venue_time_holds.sql` and `venue_time_hold_races.sh`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.11 | Integration Test - Boundary / Regression | A hold expiring exactly now releases its cells for a new hold while preserving the expired booking record |
| AC-047.2.12 | Integration Test - Negative / Regression | A closure touching only setup time blocks a new hold, even when hidden under expiring booking cells; refused operation rolls cleanup back |
| AC-047.2.13 | Integration Test - Negative / Concurrency | Two concurrent overlapping holds produce one winner with all 13 cells; losing request leaves no booking |

All passed with AC-047.2.3–10 in the isolated runner (11 grouped cases total).
The concurrency loser intentionally produces SQLSTATE 23505; this is expected
negative-test output, not a defect. Next unused ID: **AC-047.2.14**.

## Approval integration — 19 October 2026

File: `backend/supabase/tests/venue_time_approval.sql`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.14 | Integration Test - Happy path / Regression | Review retains structured requirements and version; approval reserves 8 event cells plus 5 venue-specific buffer cells |
| AC-047.2.15 | Integration Test - Negative / Regression | Venue settings invalidate a previously loaded review; conflicting approval leaves the request pending with no partial cells |
| AC-047.2.16 | Integration Test - Negative / Regression | Converted reservation with mismatched event dates is refused without deleting or shortening saved occupancy |

All passed with preceding cases: 14 grouped cases in the isolated runner.
Next unused ID: **AC-047.2.17**. Approval concurrency, incomplete timing reads,
and wider consumer integration remain to verify; no full regression pass claimed.

## Incomplete timing review regression — 19 October 2026

- AC-047.2.17 — Integration Test - Negative / Regression.
- Administrative fixture: a pending booking linked to a draft with incomplete timing. This is not created by the normal hold workflow.
- Expected: staff can read details, requestedCells is empty and conflictCheckAvailable is false.
- Actual: review raises `A finite event start before its end is required` through venue_occupied_period.
- Status: fixed locally and retest passed on 19 October 2026. Review now validates timing before invoking the strict calculator; the original failing assertion is unchanged. Earlier fixture attempts were rejected by core-field and lifecycle constraints; those were test-setup mistakes, not product defects.
- Next unused ID: AC-047.2.18. Approval concurrency checks remain pending.

## Approval concurrency — 19 October 2026

File: `backend/supabase/tests/venue_time_approval_races.sh`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.18 | Integration Test - Negative / Concurrency | Two overlapping approvals produce one confirmed booking with 13 cells; loser remains pending with no cells |
| AC-047.2.19 | Integration Test - Negative / Concurrency | Approval versus hold tested in both orderings; winner retains 13 cells and losing operation leaves no partial reservation |
| AC-047.2.20 | Integration Test - Negative / Concurrency | Concurrent trusted event update invalidates an approval waiting for the event lock; request stays pending without cells |

All passed alongside earlier cases: 18 grouped cases (AC-047.2.3–20). SQLSTATE
23505/40001 errors are expected rejections, followed by saved-state assertions.
Initial event-edit fixture incorrectly used a direct browser edit, which the
existing guard refused. Corrected to a trusted database update simulating the
write from an approved change request; the change-request workflow itself is not
exercised here. This was a fixture correction, not a product defect.
Next unused ID: **AC-047.2.21**.

## Per-venue arrangement revalidation — 19 October 2026

File: `backend/supabase/tests/venue_time_revalidation.sql`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.21 | Integration Test - Happy path / Negative | Real planning-edit RPC checks two venues independently; setup-only block flags the buffered venue, not the zero-buffer venue; changed reserved periods are flagged for both |
| AC-047.2.22 | Integration Test - Regression | Rechecking the same source preserves both confirmed bookings and all their cells; three flags and current-coordinator notification rows appear exactly once |

Both passed with earlier cases (20 grouped cases AC-047.2.3–22). No defect found
in this checkpoint. Next unused ID: **AC-047.2.23**. Notification assertions cover
database records, not delivery. Full application regression remains pending.

## Frontend occupied-period helper — verification pending

File: `frontend/src/features/venues/__tests__/venueOccupiedSlots.test.ts`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.23 | Unit Test - Happy path / Regression | Customer example with 30/45-minute buffers versus zero buffers; event timestamps unchanged |
| AC-047.2.24 | Unit Test - Boundary | Singapore midnight crossing, partial cells, lunch-time availability and half-open adjacent periods |
| AC-047.2.25 | Unit Test - Negative | Invalid dates, reversed/empty periods and invalid durations are refused rather than returned as free availability |

These cases are written but not yet verified. Local checks stalled without results;
no pass or product defect is inferred. Next unused ID: AC-047.2.26.

## Search buffer integration — 19 October 2026

AC-047.2.23–25 verification is now complete: Jaydon reported all three tests,
typecheck and lint passing after reinstalling dependencies. They also passed in
the subsequent focused search run.

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.26 | Unit Test - Happy path / Negative | Search reads venue durations and excludes only the buffered venue when an occupied cell overlaps setup |
| AC-047.2.27 | Unit Test - Negative | Failed occupancy read and incomplete event timing return an error rather than available venues |

File: `frontend/src/features/venues/__tests__/venueSearchBuffers.test.ts`.
14 tests across three files passed; typecheck and lint passed. Next ID: AC-047.2.28.

## Search time selector — 19 October 2026

| ID | Type | What is tested |
|---|---|---|
| AC-047.2.28 | Component Test - Happy path / Boundary | Selector offers 96 quarter-hours plus Any slot, labels midnight/end-of-day correctly, removes legacy choices and emits T1200 |
| AC-047.2.29 | Unit Test - Happy path / Regression | Manual quarter-hour search resolves the slot interval and applies each venue's buffers |

50 tests passed across VenueFilters, venueSearchBuffers, venueSearchService and
legacy slots tests. Typecheck and lint passed. Next ID: AC-047.2.30.

## Suitability integration

- AC-047.2.30 — Service unit test: happy path, negative and boundary. Conflicts
  in a venue's setup/turnaround period make it unavailable; zero-buffer venues
  stay available for the same surrounding claims. Own holds and adjacent cells
  do not cause conflicts.
- AC-047.2.31 — Service unit test: negative and boundary. Invalid durations and
  reversed timing fail closed; a midnight setup buffer checks the previous date
  and detects its maintenance claim.
- File: frontend/src/features/venues/__tests__/suitabilityService.test.ts
- Result: both passed, with existing suitability regressions (37 total tests).
- Evidence: docs/test-evidence/us47/suitability-tests.log
- Existing AC-018.4.11 now verifies overnight quarter-hour availability; the
  legacy overnight catalogue gap no longer exists. Other AC-018 IDs retained.

## Quarter-hour timetable display

- AC-047.2.32 — Component test: happy path and boundary. Single-venue grid shows
  three time sections across date columns, grouping adjacent identical occupancy.
  Checks midnight, section boundaries, booking separation, free gaps, buffer wording,
  selected ranges, next-day availability and an empty timetable.
- AC-047.2.33 — Component test: happy path and boundary. All-venue grid shows
  96 rows per venue, maintenance reasons, held slots and setup/turnaround, without
  showing another venue's claims in a free venue; venue navigation is retained.
- File: frontend/src/features/venues/__tests__/quarterHourTimetables.test.tsx
- Result: passed; 40 tests across four files including existing regressions.
- Evidence: docs/test-evidence/us47/timetable-tests.log
- Existing legacy-catalogue component tests remain as compatibility regressions;
  AC-047.2.32–33 explicitly verify the new 15-minute model.

## Maintenance-block quarter-hour selection

- AC-047.2.34 — Component test: happy path and boundary. Picker displays 96
  slots plus Full day; verifies midnight, lunch, last slot, deselection, disabled
  controls and error display. Existing AC-012.2.26 verifies Full day selects all
  96 cells and clears them when unticked.
  File: frontend/src/features/venues/__tests__/SlotPicker.test.tsx
- AC-047.2.35 — Unit test: negative and boundary. Legacy/invalid codes mixed
  with valid cells are rejected; valid midnight/lunch/end-of-day cells are sorted
  and deduplicated.
  File: frontend/src/features/venues/__tests__/venueBlockValidation.test.ts
- AC-047.2.36 — Component test: happy path and boundary. Converted legacy
  coverage displays three accurate ranges, preserving gaps rather than saying
  Full day. Existing AC-012.9.18 covers true 96-cell Full day display.
  File: frontend/src/features/venues/__tests__/VenueBlockList.test.tsx
- Result: passed, with block service/form/page regressions (56 tests, 11 files).
- Evidence: docs/test-evidence/us47/block-picker-tests.log
- Passing form tests emitted React act(...) warnings; no product failure observed.

## Booking preview with venue durations

- AC-047.2.37 — Component test: happy path and boundary. Event preview includes
  30-minute setup and 15-minute turnaround around a midnight event, labels event
  and buffer cells, excludes the adjacent end cell and navigates to setup's date.
- AC-047.2.38 — Component test: happy path and negative. Zero buffers add only
  event cells; invalid durations show an error and disable the hold action.
- File: frontend/src/features/venues/__tests__/VenueTimetablePreview.test.tsx
- Result: passed, with venue-read regressions (10 tests across two files).
- Evidence: docs/test-evidence/us47/booking-preview-tests.log
- Save-path integration is pending; these tests do not establish correct booking writes.

## Atomic save and remaining integration

- AC-047.2.39 — Service unit test, happy path: one atomic hold RPC with server
  default or explicit hold duration; no browser booking/claim writes.
- AC-047.2.40 — Service unit test, negative: assignment, lifecycle, missing timing,
  invalid venue duration and signed-out user prevent a write.
- AC-047.2.41 — Service unit test, negative: conflict/permission refusals remain
  failures; lost or malformed save replies instruct checking bookings before retrying.
- AC-047.2.42 — Service unit test, boundary: all 96 catalogue cells survive the read,
  including the final 24:00 end boundary.
- AC-047.2.43 — Service unit test, negative/boundary: diagnostics report only the
  venue-specific occupied cells; failure to read details does not erase a refusal.
- File: frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts
- AC-047.2.44 — Database integration test, happy path/negative/boundary: full-day
  and quarter-hour venue operating times are accepted; misaligned/empty periods
  are refused without changing the saved valid hours.
- File: backend/supabase/tests/venue_time_operating_hours.sql

### Coverage changes from the old hold service tests

The old browser-insert/cleanup implementation no longer exists. Tests asserting
its individual inserts, manual rollback and one whole-slot buffers were replaced,
not claimed as still passing. Their replacement coverage is:

- Hold creation/requester/expiry: SQL .2.9; frontend .2.39.
- Permissions/status/missing timing: SQL .2.10 and frontend .2.40–41.
- Occupied cells, buffers, gaps and boundaries: SQL .2.6–7; frontend .2.23–25.
- Atomic refusal, expiry cleanup and races: SQL .2.10–13, .2.18–20.
- Conflict messages/read failures: frontend .2.41 and .2.43.
- Catalogue reads: frontend .2.42.
- Submit/release/list and assignment regressions remain in venueBookingService.test.ts
  and venueBookingAssignment.test.ts. Existing affected UI/US12/US46 test IDs remain;
  their fixtures/assertions now use the quarter-hour contract.

### Forced-break evidence

AC-047.2.23: temporarily moving setup forward rather than backward caused the
unchanged test to fail. Exact implementation restored and the helper tests passed.
Logs: docs/test-evidence/us47/AC-047.2.23-forced-break.log and
AC-047.2.23-restored-pass.log. Deliberate mutation, not a discovered defect.

## Coordinator timetable usability defect — 21 October 2026

- Related test: AC-047.2.32; manual UI/usability check against AC-047.2.
- Discovered by: Jaydon. The timetable displayed up to 96 rows and was difficult to scan.
- Cause: presentation directly mirrored quarter-hour storage intervals.
- Fix: date columns with three display sections and consecutive occupancy grouped into time-range cards. Booking IDs, statuses, buffers, maintenance reasons, free gaps and selection boundaries remain separate.
- No database or booking behaviour changes. The separate all-venue availability grid is unchanged.
- Automated evidence: docs/test-evidence/us47/timetable-readability-tests.log.
- Manual retest: pending; do not close the defect until verified in the browser.

## Venue Staff settings and preservation — 21 October 2026

Migration: `backend/supabase/migrations/0098_venue_buffer_settings.sql`.
Database cases: `backend/supabase/tests/venue_buffer_settings.sql` and conversion runner.
Frontend cases: `frontend/src/features/venues/__tests__/VenueBufferSettings.test.tsx`.

| Test code | Type of test | Coverage |
|---|---|---|
| AC-047.4.3 | Integration Test - Happy path | New venue has independent zero defaults. |
| AC-047.1.3 | Integration Test - Happy path / Boundary | Save independent durations; detect overlap between buffers in a previously free gap. |
| AC-047.1.4 | Integration Test - Negative / Boundary | Refuse unauthorised, direct, invalid and stale edits; unchanged save is a no-op. |
| AC-047.1.5 | Component Test - Happy path | Load zero defaults, save independent durations and show review feedback. |
| AC-047.1.6 | Component Test - Negative / Boundary | Refuse blank, negative, fractional and non-15 values; recover stale saves by reloading. |
| AC-047.1.7 | Component Test - Negative | Malformed loads and network failures never show false success. |
| AC-047.3.1 | Integration Test - Happy path / Regression | Preserve bookings/claims, flag both conflicting holds and notify Coordinator and staff. |
| AC-047.3.2 | Integration Test - Boundary | Repeated changes notify again; channel preferences respected; emails queued. |
| AC-047.3.3 | Integration Test - Regression | Decreasing to zero preserves reservations and open reviews. |
| AC-047.3.4 | Integration Test - Regression | Migration replay preserves populated booking and claim rows. |
| AC-047.2.45 | Integration Test - Happy path | Effective availability includes newly required setup. |
| AC-047.2.46 | Integration Test - Negative | A later hold cannot use an existing booking's new buffer; refused write rolls back. |
| AC-047.2.47 | Integration Test - Boundary | Maintenance overlapping only new setup flags the existing booking. |

These are grouped cases covering multiple related assertions; a row with multiple
categories includes separate success/refusal scenarios, not one outcome that is
simultaneously successful and unsuccessful.

Defect associated with AC-047.1.3: settings save rolled back with a missing FROM-clause
error caused by an incorrectly qualified PL/pgSQL message variable. Fixed by using
`v_detail` and the shared notification helper for fresh notices. Original failure
log retained; restored save case passes. Record in Defects (Automated Testing).

Manual settings verification remains pending. Steps are in `docs/us47-venue-buffers.md`.
Previous timetable readability checks passed according to the user's confirmation;
that does not imply this new settings flow has been manually verified.
