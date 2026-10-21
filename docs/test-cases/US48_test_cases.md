# US48 test cases

Owner: Jaydon. Updated: 21 October 2026. Code-first development.

## PR1 backend cases

All 20 cases passed locally in the focused current-schema runner and both
quarter-hour upgrade/fresh-order regression gates. These are SQL integration tests
against disposable PostgreSQL with simulated Auth claims, real RLS and real database
functions. They do not establish browser, live Supabase Auth/API or email delivery.
Related assertions sharing an ID are one grouped test case.

Tested implementation: `backend/supabase/migrations/0099_affected_venue_replacement.sql`.
Location: `backend/supabase/tests/affected_venue_replacement.sql`, except replay in
both runners and concurrency in `affected_venue_replacement_races.sh`.

| ID | Type | Requirement-based scenario and expected result |
|---|---|---|
| AC-048.1.1 | Integration Test - Happy path / Boundary | Current Coordinator receives blocked/retired reasons; unaffected, expired, closed and past originals are excluded. |
| AC-048.3.1 | Integration Test - Negative / Boundary | Refuse duplicate/blank proposals, Coordinator approval and direct audit/private-helper access. |
| AC-048.3.2 | Integration Test - Negative | Unassigned Coordinator cannot read/propose another event replacement; organiser cannot use the internal workflow. |
| AC-048.3.3 | Integration Test - Negative / Boundary | Refuse expired holds, unaffected/closed/past events and same/retired targets. |
| AC-048.3.4 | Integration Test - Negative / Regression | Changed event consent or removed block invalidates approval even with a reloaded staff token; target edits invalidate a loaded decision. |
| AC-048.3.5 | Integration Test - Regression | After reassignment, previous Coordinator loses management; current Coordinator may withdraw the stale proposal and propose again. |
| AC-048.3.6 | Integration Test - Negative / Regression | Narrow Confirmed-event replacement support does not allow ordinary unrelated booking approval. |
| AC-048.3.7 | Integration Test - Boundary / Regression | Two simultaneous proposals produce exactly one pending request. |
| AC-048.4.1 | Integration Test - Happy path / Regression | Compare all saved event columns before/after successful replacements; every field and status stays unchanged. |
| AC-048.5.1 | Integration Test - Happy path | Pending proposal retains the original and no target claim, and remains in affectedBookings with needsReplacement true. UI wording is not covered yet. |
| AC-048.6.1 | Integration Test - Happy path / Regression | Approve blocked original with multiple independent reasons: seven target cells include four event and three buffer cells; old cells release/reblock; blocked/retired reviews resolve with actual staff/link audit; unrelated and already-resolved reviews remain intact. |
| AC-048.6.2 | Integration Test - Happy path / Boundary | Replace a retired booking, an upcoming Confirmed event's booking, a Pending approval original and a live Held original; resolve the retirement review with the replacement link. |
| AC-048.6.3 | Integration Test - Negative | Reject/withdraw requests, retain recorded decisions and Needs replacement eligibility; exact original snapshots are checked with .6.6. |
| AC-048.6.4 | Integration Test - Negative / Boundary | A target closure covering only setup refuses approval and rolls back the switch. |
| AC-048.6.5 | Integration Test - Negative / Boundary | A neighbour's derived turnaround overlapping only target setup refuses approval even without a saved ledger collision. |
| AC-048.6.6 | Integration Test - Negative / Regression | Inject failure in final review resolution; approval rolls back completely. Compare exact booking/claim/review snapshots after unsuccessful outcomes; no partial target or audit remains. |
| AC-048.6.7 | Integration Test - Regression | Ordinary cancellation retains existing generic review cleanup and does not invent replacement attribution. |
| AC-048.6.8 | Integration Test - Regression | Replay 0099 against populated data; event, booking, claim, proposal and both review stores remain identical. |
| AC-048.6.9 | Integration Test - Boundary / Regression | Concurrent approval/rejection has one winner, one confirmed replacement and a recorded staff resolution. |
| AC-048.6.10 | Integration Test - Boundary / Regression | Two events compete for the same replacement interval; one succeeds, the loser keeps its exact original reservation, pending proposal and open flag. |

PR1 allocated the IDs below; the next available IDs are listed after PR2.

## PR2 frontend cases

12 grouped new cases passed; full frontend verification: 1,512 tests / 172 files.
Component tests render real UI with mocked services; they are not live database or
browser end-to-end tests. The service unit test mocks Supabase. Existing US20 test
IDs retain their intent; .3.50/.3.56/.3.59 proposal assertions moved with the extracted
proposal form. Existing queue/booking role-loss checks use the new panel title.

| ID | Type | Requirement-based scenario and expected result |
|---|---|---|
| AC-048.1.2 | Component Test - Happy path | Booking shows blocked and retired reasons, Needs replacement and the correct original-booking link; one shared context load. |
| AC-048.1.3 | Component Test - Negative | Review-load failure is explicit, never false empty eligibility; manual reload restores indicators. |
| AC-048.1.4 | Unit Test - Negative / Regression | Service validates reason/event/affected fields; missing 0099 contract or malformed source fails closed. |
| AC-048.2.1 | Component Test - Happy path | Search receives event ID/full interval, attendance, layout and accessibility/facilities; dates display in Singapore and event selection is fixed. |
| AC-048.2.2 | Component Test - Boundary | Filtering/reset keep the original event; a layout missing from the catalogue remains selected rather than silently dropped. |
| AC-048.2.3 | Component Test - Negative / Boundary | Empty results, unavailable search and missing time options show no stale candidates; disabled search does not falsely remain Searching after load failure. |
| AC-048.2.4 | Component Test - Negative | Wrong role, invalid URL, unavailable source or pending proposal cannot start replacement search. |
| AC-048.2.5 | Component Test - Regression | A late old search cannot replace results from explicitly reloaded event consent. |
| AC-048.2.6 | Component Test - Boundary / Negative / Regression | Venue-block start/end fields retain the exact continuous overnight interval; equal/reversed same-day bounds refuse preview, changed times invalidate confirmation, 24:00 works and Full day sets midnight to end of day. |
| AC-048.3.8 | Component Test - Happy path / Negative / Boundary | Selecting a venue preserves original booking/version; blank note refuses submission, pending send/reload are disabled, one request succeeds with original-preservation feedback. |
| AC-048.3.9 | Component Test - Negative / Regression | Failed proposal keeps the note, does not auto-refresh consent, locks retry and requires explicit reload before a fresh version can be submitted. |
| AC-048.5.2 | Component Test - Happy path / Regression | Badge stays through pending/rejected/withdrawn requests; approval reload shows Released original, replacement history and no Needs replacement badge. |

Locations: `MyVenueBookingsReplacement.test.tsx` (.1.2–3/.5.2),
`venueReplacementService.test.ts` (.1.4), `VenueReplacementSearchPage.test.tsx`
(.2.1–5/.3.8–9), `VenueBlockForm.test.tsx` (.2.6), under `frontend/src/features/venues/__tests__/`.

Next unused IDs: AC-048.1.5, .2.7, .3.10, .4.2, .5.3, .6.11.
Existing US20/US41 frontend compatibility cases retain their existing IDs.

## Manual checks — pending

Use separate seeded **Venue Staff** and **current assigned Coordinator** accounts.
Use future disposable events and venues with operating hours covering the full
occupied interval. Execute after deployment and repeat the complete UI workflow
with PR2 running against a database with 0099 and 0100. None of these checks is recorded as passed yet.

| AC | Account and action | Expected result |
|---|---|---|
| 1/5 | Venue Staff blocks one original venue and retires another. Coordinator opens their affected bookings. | Both reasons are available; originals remain recorded. Both originals show Needs replacement and a Find replacement link. |
| 2/3/4 | Coordinator uses Find replacement, checks the prefilled full Singapore interval, attendance/layout and requirements, selects a target, supplies a reason and submits. Then reloads bookings. | Proposal appears in staff review; original reservation and event details remain; target has no reservation yet. |
| 6 | Staff approves a target with 15-minute setup and 30-minute turnaround. | Target is confirmed with buffers; original cells release, or remain maintenance-blocked where appropriate. Event information is unchanged. |
| 6 | Approve an original with a blocked/retired review and a separate capacity/layout review. | Only blocked/retired reviews resolve; their audit records the signed-in staff member and replacement booking. Independent review stays open. |
| 6 | Staff rejects a proposal; Coordinator withdraws another. | Originals and open reviews remain; decision history persists. |
| 6 | After proposal, block the target's setup period or occupy it with another booking. Staff attempts approval. | Approval fails with no original/claim/review loss and no committed target booking. |
| 3/4 | Replace an upcoming Confirmed event's affected booking. Attempt ordinary unrelated booking approval separately. | Replacement succeeds without changing event status/details; ordinary approval is refused. |
| 3 | Change event details or reassign Coordinator after proposal; try an old decision. | Old decision is refused; current Coordinator can withdraw and submit fresh consent. |

Additional continuous-block checks (Venue Staff, pending):

1. Choose a future start date at 21:00 and the next date at 08:00. Preview/save.
   The list shows both endpoints in Singapore time. Calendar cells from 21:00
   through 07:45 are blocked; 20:45 before the start and 08:00 at the end stay free.
2. Use three dates: the middle day is fully blocked. Try 23:45 → next-day 00:00,
   and Full day (00:00–24:00). No cells after the exclusive endpoint are blocked.
3. Same-day equal/reversed times refuse preview. Changing either endpoint after
   preview hides Confirm block until previewed again. Existing overlapping blocks refuse save.
4. Check an older block with daily gaps: its displayed ranges and gaps stay intact.
5. Overlap two bookings with the continuous block, including only setup/turnaround
   for one. Originals/events stay intact, with review reasons. Replace one: only its
   eligible reviews resolve; its released cells inside the exact block remain blocked.
6. Remove the block: only its maintenance cells and open block reviews clear;
   other reservations/reviews stay. Email queueing is not proof of delivery.

## Shared US12 integration cases added with 0100

These belong to the blocking criteria and retain AC-012 IDs; they support US48's
blocked-booking flow. They are not additional US48 acceptance criteria.

| ID | Type | Scenario and expected result |
|---|---|---|
| AC-012.1.13 | Integration Test - Negative | Non-staff cannot preview/save periods; browser roles cannot execute private helpers. |
| AC-012.2.31 | Unit Test - Boundary / Negative | Quarter-hour alignment, overnight ordering, midnight, real dates and the 366 occupied-day limit. |
| AC-012.2.32 | Unit Test - Happy path / Boundary / Negative | Service preview/save send identical Singapore instants; 24:00 normalizes; invalid periods make no RPC call. |
| AC-012.2.33 | Integration Test - Negative / Boundary | Refuse null/infinite/misaligned/nonpositive/overlong periods and blank reasons. |
| AC-012.2.34 | Integration Test - Happy path / Boundary / Regression | Exact overnight/interior-day cells, exclusive midnight, adjacent periods and legacy gaps/mixed overlap. |
| AC-012.5.6 | Integration Test - Negative / Boundary | Reviews/approval/holds honor exact closure endpoints; inside requests fail and adjacent requests remain valid. |
| AC-012.7.15 | Integration Test - Happy path / Boundary | Preview returns only exact overlapping bookings and block cells. |
| AC-012.7.16 | Integration Test - Boundary / Regression | Newly required setup detects exact continuous-block conflicts; adjacent setup does not; saved claims remain. |
| AC-012.8.26 | Integration Test - Happy path / Regression | Flag only affected bookings without mutating events/reservations; replacement releases exact cells and selectively resolves its reviews. |
| AC-012.9.26 | Unit Test - Happy path / Regression | Service retains continuous timestamps and legacy gapped slots. |
| AC-012.9.27 | Integration Test - Happy path / Regression | Removing a period releases only its maintenance/reviews and preserves other bookings/blocks. |
| AC-012.9.28 | Integration Test - Negative / Regression | Real concurrent continuous/legacy requests share the venue lock; one complete winner and no losing block. |
| AC-012.9.29 | Component Test - Happy path / Regression | Both Singapore endpoints display; legacy daily ranges remain readable. |
| AC-012.10.7 | Integration Test - Regression | Populated 0100 upgrade preserves events, reservations, reviews, history and legacy coverage. |
| AC-012.10.8 | Integration Test - Regression | Replaying 0100 preserves populated legacy/continuous blocks and related state. |

SQL: `continuous_venue_blocks.sql`, `continuous_venue_block_races.sh` and current
runners. Frontend: `venueBlockValidation.test.ts`, `venueBlockService.period.test.ts`,
`VenueBlockList.test.tsx`. Existing US12/US47 component cases were adapted to the
new controls without adding duplicate happy-path tests.
Next US12 IDs: .1.14/.2.35/.3.8/.4.3/.5.7/.6.3/.7.17/.8.27/.9.30/.10.9.

## Defects and evidence sheet

PR1 demonstrated no product defect. PR2 found/fixed AC-048.2.3: missing booking-time
options left the disabled filter button labelled Searching after loading ended.
The fix separates loading wording from disabled state; the unchanged behavioural
expectation then passed. Preserve the failure log and record this in Defects
(Automated Testing). Owner/discovered/fixed fields: Jaydon; date 21 October 2026.
Fixture/assertion mistakes and expected refusals are not product defects.
Manual defects/results, shared sheet updates, CI and deployment remain pending.
At story closeout update Test Case Overview, Manual Testing and Defects (Automated
Testing), using Jaydon in required owner/tester fields. Do not populate Automated
Test Case Runs. See `docs/test-evidence/us48/README.md` for local logs.
