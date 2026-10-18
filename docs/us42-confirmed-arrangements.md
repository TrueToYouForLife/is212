# US42 — View my event's confirmed arrangements

Owner: Jaydon

Story: SCRUM-238. Updated: 18 October 2026.

Status: venue portion implemented and locally verified; PR review and CI pending.
Migration 0068 applied to shared Supabase. Equipment arrangements remain outstanding;
the whole story is not ready to mark Done.

## Acceptance criteria review

- **AC-042.1 — Approved venue bookings:** implemented. The owning organiser sees
  each confirmed venue booking with its venue name, reserved dates and slots.
  Local automated tests and the manual booking-to-approval flow passed.
- **AC-042.2 — Equipment reservation status:** not implemented in this slice.
  Reserved, partially reserved and unavailable equipment will be added separately.
- **AC-042.3 — Internal information excluded:** implemented and tested for the
  venue response. Staff notes, reviewer identities and audit records are not returned.
  Equipment unit allocations and equipment-related privacy checks remain part of
  the next portion. Do not treat the whole criterion as complete yet.

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
- **US14:** existing equipment reservation data will supply AC-042.2. This slice
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

Next unused test IDs: **AC-042.1.7**, **AC-042.2.1**, **AC-042.3.5**.

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
- Prepare the venue PR, obtain review and passing CI, then merge through the team process.
- Add equipment statuses and their privacy checks in the next short-lived branch.
- Coordinate the US31 access boundary and perform final whole-story verification.
- Shared Test Case Overview now contains ten venue cases, and Manual Testing contains three passed checks dated 18 October 2026. Keep these aligned as equipment is added; record genuine defects only if discovered. Automated CI execution evidence stays in GitHub Actions, not the spreadsheet's Automated Test Case Runs tab.
- Mark US42 Done only after all ACs and the team's Definition of Done are satisfied.
