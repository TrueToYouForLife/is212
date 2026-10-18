# US42 — View my event's confirmed arrangements

Owner: Jaydon

Story: SCRUM-238. Updated: 18 October 2026.

Status: venue portion merged in PR #103 after passing CI. Equipment database read,
service and UI implemented; equipment manual checks passed, with PR review and CI pending.
Migration 0068 applied to shared Supabase; equipment requires migration 0071;
the whole story is not ready to mark Done.

## Acceptance criteria review

- **AC-042.1 — Approved venue bookings:** implemented. The owning organiser sees
  each confirmed venue booking with its venue name, reserved dates and slots.
  Local automated tests and the manual booking-to-approval flow passed.
- **AC-042.2 — Equipment reservation status:** implemented locally through 0071, the validated service and organiser panel.
  Reserved, partially reserved, unavailable and pending review display with quantities.
- **AC-042.3 — Internal information excluded:** implemented and tested locally for venue and equipment responses. Staff notes,
  reviewer identities, unit allocations and audit records are not returned.
  Equipment browser status, refresh and privacy checks passed.

## First increment: venue arrangements

Branch: `us42-venue-arrangements`.
Migration: `0068_organiser_venue_arrangements.sql`.

The organiser opens **My requests → event → Venue arrangements**, below Request
details. Each approved booking appears separately, including multiple bookings
for the same event. Dates and times are shown in Singapore time. Event slots and
setup/turnaround buffer slots are labelled separately; 24:00 is explicitly shown
as midnight at the end of the booked day.

The database read function `get_organiser_venue_arrangements(uuid)` checks both
organiser role and ownership of the event. It returns only booking ID, venue name
and the saved slot date/code/start/end/kind. Anonymous callers cannot execute it;
unrelated organisers and other roles are refused. Existing staff-table policies
are unchanged, so this does not grant organisers direct access to booking records.

Approved bookings use database status `confirmed`. Holds, pending approvals,
rejected, cancelled and expired bookings are excluded. Slot details come from
`venue_slot_claims`, not the event's proposed dates: a later event-date change does
not falsely imply the reservation moved. A confirmed booking without saved cells
remains visible with a message to contact the coordinator.

The frontend service validates the response before passing it to the panel.
Unexpected fields or malformed data produce a safe error rather than a partial
or misleading successful result. Database permissions remain the access-control
boundary; client validation is additional protection against response changes.

## Refresh and failure behaviour

Reads reuse `useRequestResource`: initial load, focus refresh, 30-second polling,
and explicit refresh. The page's Refresh status action also refreshes arrangements.
Changing events or accounts clears the previous panel's data. Loading, no approved
bookings, unavailable slot details and read failure have distinct messages.
A failed refresh removes stale results and offers Try again.

## Dependencies and scope limits

- **US10:** existing Venue Staff approval owns booking decisions. US42 only reads
  the resulting confirmed bookings; it does not approve or change reservations.
- **US14:** existing equipment reservation data supplies AC-042.2. US42
  does not change requirements, allocations or reservation statuses.
- **US31:** organisation-wide access belongs to the organisation-access story.
  The current function permits only the event's owning organiser. Align the read
  boundary with US31 before claiming the full dependency is satisfied.
- Read the existing slot catalogue and saved ledger cells. This slice does not
  implement a new booking time model, notification delivery or internal review UI.

## Automated cases and verification

Code-first development: implementation followed by focused tests, not TDD cycles.
Ten new cases cover the venue portion: four PostgreSQL integration cases and six
frontend service/component/page cases. Related scenarios are grouped without
equating each assertion to a separate test case.

Detailed AC mapping, test types and file locations:
[US42 test cases](test-cases/US42_test_cases.md).
Saved output: [US42 verification evidence](test-evidence/us42/README.md).

Verification on 18 October 2026:

- Complete disposable database suite passed, including the four new US42 cases
  and existing regression/concurrency checks. Shared Supabase was not used by this runner.
- Full frontend suite: **139 files and 1,293 tests passed**.
- Production build, including TypeScript, and lint passed. The large-bundle warning remains.
- AC-042.1.4 caught a deliberate service fault that returned an empty successful result on a database read error. After restoring the original service byte-for-byte, the unchanged service file passed all three tests. Both logs are saved in the evidence folder.
- This is code-first test-effectiveness evidence, not a product defect or TDD cycle. Coverage percentages have not been measured yet.

Next unused test IDs: **AC-042.1.7**, **AC-042.2.7**, **AC-042.3.8**.

## Manual checks — passed

Tested by: Jaydon. Date: 18 October 2026.
Environment: local development UI connected to shared Supabase after applying 0068.

1. Coordinator books a venue, Venue Staff approves, and the owning organiser sees
   the venue arrangement — Pass.
2. Pending bookings stay hidden; an event without approved bookings shows the
   empty message — Pass.
3. Another organiser cannot access the event's arrangements, including through
   its URL — Pass.

Multiple venues, midnight and missing ledger cells have automated coverage;
no additional manual pass is recorded for those scenarios.

## Issues encountered

The initial SQL fixture created both a held and pending booking for one event,
violating the existing one-active-hold constraint. Moving the held booking to
the second fixture event corrected the test setup. Production rules were unchanged;
the subsequent full database suite passed.

Local frontend checks initially stalled or timed out reading module files.
After reinstalling dependencies with `npm ci`, tests, typecheck, lint and build
passed. The original timeout cause was not established. Neither issue is recorded
as a demonstrated product defect, a forced break or a TDD red/green cycle.

## Remaining work

- Complete the coverage review and reassess test-effectiveness evidence when equipment is added.
- Venue PR #103 merged after passing CI; equipment branch is `us42-equipment-arrangements`.
- Obtain equipment PR review and passing CI; manual equipment statuses, refresh and privacy checks passed.
- Coordinate the US31 access boundary and perform final whole-story verification.
- Shared Test Case Overview contains 19 cases (ten venue/page cases and nine equipment cases), and Manual Testing contains seven passed checks dated 18 October 2026. Keep these aligned; record genuine defects only if discovered. Automated CI execution evidence stays in GitHub Actions, not the spreadsheet's Automated Test Case Runs tab.
- Mark US42 Done only after all ACs and the team's Definition of Done are satisfied.

## Equipment database checkpoint — migration 0071

`get_organiser_equipment_arrangements(uuid)` checks organiser role and event
ownership, matching the venue read. It returns requirement ID, equipment name,
requested/reserved quantities and the existing requirement status. Pending review
is preserved and has zero reserved; the current booking-line link supplies the
reserved quantity, excluding historical lines and suggested alternatives.
Technical notes, allocation identities, staff details and audit data are excluded.
Existing reservation writes and staff-table policies are unchanged.

Four new SQL cases passed with the full database suite on 18 October 2026, using
real reservation calls for the outcomes. Evidence is in `test-evidence/us42/database-equipment.log`.
The frontend service now validates the permitted fields, statuses and integer quantities, rejects extra internal fields, and keeps errors distinct from empty results. Three focused service tests passed. The organiser panel is integrated below venue arrangements with refresh, empty/error states, quantities and all four status labels. Two component cases cover display and recovery; existing AC-042.3.4 now checks both panels and all staff roles.

Latest equipment integration verification: full frontend suite **143 files / 1,318 tests passed**;
production build/typecheck and lint passed. Saved logs are in `docs/test-evidence/us42/`.
The earlier venue-only counts above remain historical. Equipment manual checks passed on
18 October 2026: all four status labels and quantities, refresh after reservation changes,
unrelated-organiser denial and exclusion of internal information. Tested by: Jaydon.
Shared evidence sheet updated with the nine equipment cases, extended AC-042.3.4 and
four manual equipment records. No new product defect was observed.
