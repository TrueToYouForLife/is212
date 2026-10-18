# US42 View my event's confirmed arrangements (SCRUM-238)

Owner: Jaydon. Updated: 18 October 2026.
Code-first development, with tests after each logical portion. This is not a TDD record.

Feature behaviour, AC progress and dependencies: [US42 story documentation](../us42-confirmed-arrangements.md).

| Portion | Scope | Status |
|---|---|---|
| Slice 1: venue arrangements | AC-042.1 and venue-related AC-042.3 | Implemented; local automated checks and three manual scenarios passed; PR #103 merged with passing CI |
| Equipment arrangements | AC-042.2 and equipment-related AC-042.3 | Database read and frontend service implemented; four SQL, three service and two component cases passed; four manual equipment scenarios passed; equipment PR/CI pending |

Branch: `us42-venue-arrangements`. Migration: `0068_organiser_venue_arrangements.sql`.
Migration 0068 applied to shared Supabase on 18 October 2026.
US42 is not complete until equipment and remaining integration checks are finished.

## Acceptance criteria

- AC-042.1: The Organiser can see the venue, date and slots of each approved venue booking for their event.
- AC-042.2: The Organiser can see whether each requested equipment item is reserved, partially reserved or unavailable.
- AC-042.3: Internal information (staff notes, unit allocations, safety review comments and audit records) is not shown.

## Design and dependencies

- Reuse the existing request detail page, with the Venue arrangements panel below Request details.
- `get_organiser_venue_arrangements(uuid)` checks the authenticated organiser owns the event. It returns only booking ID, venue name and reserved slot details; existing staff table permissions are unchanged.
- Approved bookings have database status `confirmed`. Held, pending, rejected, cancelled and expired bookings are excluded.
- Dates and slots come from saved `venue_slot_claims`, not subsequently edited event dates. Event and buffer cells are distinguished; a confirmed booking without cells remains visible with an explicit unavailable message.
- The service validates the response and rejects extra fields. This complements, and does not replace, database access control.
- Dates/times display in Singapore time, including 24:00 as midnight at the end of the booked day. Existing refresh logic handles page refresh, focus and polling.
- US10 and US14 own booking/reservation behaviour. US31 owns access for colleagues within a client organisation; coordinate with Nicole before extending the current owner-only rule. Do not claim organisation-wide access is implemented here.

## Automated test cases

All ten cases below passed locally on 18 October 2026. PostgreSQL integration tests use the disposable database with real permissions; frontend tests use mocks and do not call shared Supabase.

| ID | Type | What is tested | File |
|---|---|---|---|
| AC-042.1.1 | Database integration — happy path / boundary | Only confirmed bookings; actual chronological event/buffer cells, multiple venues and midnight | `backend/supabase/tests/organiser_venue_arrangements.sql` |
| AC-042.1.2 | Database integration — boundary | No approved bookings returns an empty result; missing ledger cells do not invent dates | Same SQL file |
| AC-042.1.3 | Unit (service) — happy path / boundary | Correct event RPC, multiple venues, midnight, empty slots and empty result | `frontend/src/features/events/__tests__/organiserVenueArrangementService.test.ts` |
| AC-042.1.4 | Unit (service) — negative | Invalid IDs, permission/database errors, malformed responses and lost connections return a safe error | Same service test file |
| AC-042.1.5 | Unit (component) — happy path / boundary | Loading, venue names, Singapore dates, midnight, buffer labels and missing-slot message | `frontend/src/features/events/__tests__/OrganiserVenueArrangements.test.tsx` |
| AC-042.1.6 | Unit (component) — negative / recovery | Refresh failure removes stale results; retry, focus, parent refresh and event changes reload data | Same component test file |
| AC-042.3.1 | Database integration — negative | Exact response field allowlist; organiser cannot directly read staff booking/slot rows | `backend/supabase/tests/organiser_venue_arrangements.sql` |
| AC-042.3.2 | Database integration — negative | Unrelated organiser, coordinator, anonymous/signed-out caller and invalid event IDs are refused | Same SQL file |
| AC-042.3.3 | Unit (service) — negative | Unexpected internal fields at booking or slot level are rejected | `frontend/src/features/events/__tests__/organiserVenueArrangementService.test.ts` |
| AC-042.3.4 | UI integration (mocked) — happy path / negative | Shared request page mounts venue and equipment panels only for the owning organiser | `frontend/src/features/events/__tests__/OrganiserVenueArrangementsPage.test.tsx` |

Next unused IDs: **AC-042.1.7**, **AC-042.2.7**, **AC-042.3.8**.
Grouped scenarios share a case ID; ten cases does not mean ten individual assertions.

## Manual checks

Tested by: Jaydon. Date: 18 October 2026.
Browser checks performed against shared Supabase after applying 0068.

| Record | AC | Scenario and expected result | Result |
|---|---|---|---|
| US42-M01 | AC-042.1 | Coordinator books a venue, Venue Staff approves, and owning organiser opens the event: venue arrangement appears | Pass |
| US42-M02 | AC-042.1 | Pending bookings stay hidden; an event without approved bookings shows the empty message | Pass |
| US42-M03 | AC-042.3 | A different organiser cannot access the event's arrangements, including via its URL | Pass |

Midnight display, multiple venues and missing cells are covered automatically; no separate manual pass is claimed for them.

## Verification and evidence

Saved logs: [US42 test evidence](../test-evidence/us42/README.md).

- Full database suite passed, including four new US42 cases and existing concurrency checks.
- Full frontend suite: **139 files, 1,293 tests passed**, including six new US42 service/component/page cases.
- Production build (including TypeScript) and lint passed. Vite reports a large-bundle warning; the build succeeds.
- Venue PR #103 merged with passing CI; equipment GitHub Actions and PR review are pending. Automated CI runs remain recorded in GitHub Actions, not the spreadsheet's automated-run tab.
- Shared evidence sheet updated on 18 October 2026: 19 overview cases and seven manual passes, with Jaydon in the manual tester field. Existing AC-042.3.4 now covers both panels; Automated Test Case Runs remains unchanged.
- Forced-break check: AC-042.1.4 failed when a database read error deliberately returned an empty success. The exact original service was restored and all three unchanged service tests passed. Logs are linked in the evidence index. This is not a new test case, product defect or TDD cycle.
- No coverage percentage is claimed; coverage measurement remains pending.

## Issues encountered

- Test fixture correction: initial SQL data put a held and pending booking on one event, violating the existing one-active-hold constraint. Moved the held booking to the second fixture event; production rules were unchanged. The corrected complete suite passed. This was a test setup issue, not a demonstrated application defect.
- Local tooling: Vitest timed out reading module files and TypeScript stalled. After reinstalling dependencies with `npm ci`, service tests, typecheck and lint passed; the subsequent full frontend suite and build also passed. The exact original timeout cause was not established.

No genuine US42 product defect has been observed in these checks. Do not label either issue as a TDD red/green cycle or a deliberate forced break.

## Equipment database cases — 18 October 2026

Four additional code-first cases passed in the complete disposable DB suite. These
are not TDD cycles. Shared-sheet entries were added on 18 October 2026.
All four are in `backend/supabase/tests/organiser_equipment_arrangements.sql`.

| ID | Type | What is tested |
|---|---|---|
| AC-042.2.1 | Database integration — happy path / boundary | Real reservation calls produce full, partial and zero reservations; pending review stays separate; names and quantities are returned correctly |
| AC-042.2.2 | Database integration — boundary | Empty event returns no rows; changed requirement resets to pending with zero reserved instead of displaying its historical reservation |
| AC-042.3.5 | Database integration — negative | Exact response field allowlist and no direct organiser reads of requirements, booking lines or unit allocations |
| AC-042.3.6 | Database integration — negative | Unrelated organiser, staff, signed-out/anonymous callers and null/missing event IDs are refused |

## Equipment service cases — 18 October 2026

Three focused service tests passed locally. Mocks exercise the response boundary;
they do not call shared Supabase. File:
`frontend/src/features/events/__tests__/organiserEquipmentArrangementService.test.ts`.

| ID | Type | What is tested |
|---|---|---|
| AC-042.2.3 | Unit test — happy path / boundary | Correct event RPC; all four statuses and requested/reserved counts preserved; empty list accepted |
| AC-042.2.4 | Unit test — negative | Invalid IDs, database/network errors, malformed records and invalid quantities return an error, never a false empty result |
| AC-042.3.7 | Unit test — negative | Unexpected staff notes, allocation data, safety comments and audit fields are rejected |

The UI is integrated; equipment manual checks passed and shared-sheet updates are complete.

## Equipment panel cases — 18 October 2026

| ID | Type | What is tested |
|---|---|---|
| AC-042.2.5 | Unit test — happy path / boundary | Names, reserved/requested quantities and all four labels; pending review never appears unavailable |
| AC-042.2.6 | Unit test — negative / recovery | Refresh error clears old results; retry, focus, parent refresh and switching events reload safely |

File: `frontend/src/features/events/__tests__/OrganiserEquipmentArrangements.test.tsx`.
Existing AC-042.3.4 now covers both panels and additionally Technical Support and
Operations Manager roles; it remains one case rather than a duplicate test.
Total US42 cases: 19 (8 SQL, 11 frontend). Four equipment manual scenarios passed.

Latest equipment integration verification: full frontend suite **143 files / 1,318 tests passed**;
production build/typecheck and lint passed. Saved logs are in `docs/test-evidence/us42/`.
The earlier venue-only counts above remain historical. Equipment browser checks passed;
equipment PR review and CI remain pending.

## Equipment manual checks — 18 October 2026

Tested by: Jaydon. Browser checks reported passed.

| Record | AC | Scenario and expected result | Result |
|---|---|---|---|
| US42-M04 | AC-042.2 | Pending review before assessment; Reserved, Partially reserved and Unavailable after assessment, with correct requested/reserved quantities | Pass |
| US42-M05 | AC-042.2 | Refresh shows updated outcomes and quantities after Technical Support changes a reservation | Pass |
| US42-M06 | AC-042.3 | Another organiser cannot access equipment arrangements through the event URL | Pass |
| US42-M07 | AC-042.3 | Equipment panel excludes staff notes, unit allocations/asset tags, safety comments and audit details | Pass |

Empty/error states and changed-requirement historical reservations have automated coverage; no additional manual pass is claimed for those scenarios.
