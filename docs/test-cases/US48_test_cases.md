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
| AC-048.5.1 | Integration Test - Happy path | Pending proposal retains the original and no target claim, and remains in affectedBookings with needsReplacement true. UI wording is covered separately by component case .5.2. |
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

11 grouped frontend cases directly cover US48 requirements, alongside 20 backend
cases. The US48 submission contains these 31 cases. Final frontend verification
remains 1,516 tests / 173 files, including shared regression coverage.
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
| AC-048.3.8 | Component Test - Happy path / Negative / Boundary | Selecting a venue preserves original booking/version; blank note refuses submission, pending send/reload are disabled, one request succeeds with original-preservation feedback. |
| AC-048.3.9 | Component Test - Negative / Regression | Failed proposal keeps the note, does not auto-refresh consent, locks retry and requires explicit reload before a fresh version can be submitted. |
| AC-048.5.2 | Component Test - Happy path / Regression | Badge stays through pending/rejected/withdrawn requests; approval reload shows Released original, replacement history and no Needs replacement badge. |

Locations: `MyVenueBookingsReplacement.test.tsx` (.1.2–3/.5.2),
`venueReplacementService.test.ts` (.1.4), `VenueReplacementSearchPage.test.tsx`
(.2.1–5/.3.8–9), under `frontend/src/features/venues/__tests__/`.

The existing ID AC-048.2.6 was allocated to the venue-block form refinement.
That scenario checks blocking controls, not US48 replacement search. Its existing
code/log ID is retained for history, but it is excluded from the US48 AC table and
sheet submission. Do not reuse it or relabel dependency tests as replacement ACs.

Next unused IDs after the safety-stage follow-up: AC-048.1.6, .2.7, .3.15, .4.3, .5.4, .6.20.
Existing US20/US41 frontend compatibility cases retain their existing IDs.

## Manual checks — Jaydon-reported pass, 21 October 2026

Jaydon confirmed all checks passed after the project-chat checklist. Future disposable
fixtures and separate Venue Staff/assigned Coordinator accounts were the prerequisites;
an unassigned Coordinator was used for the access scenario. No manual defect was reported.
The detailed record is [manual results](../test-evidence/us48/manual-results.md).
The report date is recorded; individual execution times and fixture IDs were not supplied.

| Checklist group | Story / AC | Scenario | Reported result |
|---|---|---|---|
| 2 | US48 / 1, 5 | Affected booking and independent reason. Venue Staff blocks the original booking and reduces its layout capacity; assigned Coordinator reloads bookings and arrangement reviews. | Pass — Original booking remains with Needs replacement and the block reason; independent capacity review also exists; event information remains intact. |
| 3 | US48 / 2, 3, 4, 5 | Prefilled search and pending proposal. Assigned Coordinator opens Find replacement, checks event timing/requirements, selects an available venue, enters the proposal reason and submits. | Pass — Requirements are prefilled; pending history appears; original reservation/event remain; Needs replacement remains; proposal reserves no target cells. |
| 4 | US48 / 5, 6 | Withdrawal and rejection. Coordinator withdraws one proposal; submits another; Venue Staff rejects it with a decision note. | Pass — Both decisions remain in history; original reservation and open reviews remain; original still needs replacement. |
| 5 | US48 / 4, 5, 6 | Failed approval preserves original. After proposal, Venue Staff blocks only the target setup period and attempts approval. | Pass — Approval is refused; no confirmed replacement is created; original reservation and both original reviews remain unchanged. |
| 6 | US48 / 3, 4, 5, 6 | Successful replacement and buffer occupancy. After removing the target test block, Venue Staff approves a current proposal; Coordinator reloads bookings and history. | Pass — Target confirmed with 15-minute setup and 30-minute turnaround; original Released without Needs replacement; event details/status unchanged; released cells under the original active block remain blocked. |
| 7 | US48 / 6 | Selective review resolution and audit. After successful approval, compare the original block/capacity reviews and matching replacement decision audit. | Pass — Only eligible block review resolves; capacity review stays open; approving staff and replacement booking match the actual approved request. |
| 8 | US48 / 1, 3, 4, 5, 6 | Retired-venue replacement. Venue Staff retires a disposable original venue with a reason; Coordinator requests another venue; Venue Staff approves. | Pass — Retirement reason and Needs replacement appear before approval; afterwards the original is released, event preserved and retirement review resolved with staff/replacement attribution. |
| 9 | US48 / 3 | Access and stale consent. Unassigned Coordinator opens another event replacement URL; separately change relevant event requirements after a proposal and try the previously loaded staff approval. | Pass — Unassigned Coordinator cannot read/propose the replacement; stale requirements cannot be silently approved; fresh Coordinator consent is required. |

The submission contains these eight US48 groups; the separate continuous-block
support check remains in the manual-results record and is not submitted under another
story. Provide the eight US48 Manual Testing rows directly in chat for Jaydon
to enter; do not store spreadsheet-paste files in the repository.
Do not create spreadsheet Automated Test Case Runs: GitHub Actions owns those records.
Automated-only edge cases (including reassignment, Confirmed-event eligibility,
legacy gap preservation and races) retain their separate classifications above.

## Supporting regression coverage

The continuous-block and existing replacement/buffer tests remain in the repository
with their original IDs. They protect the shared functionality used by US48, but
are not included in Jaydon's US48 evidence-sheet submission or counted as additional
US48 acceptance criteria. No other story's sheet records are added or updated.
Historical implementation evidence remains under `docs/test-evidence/us48/`.

## Defects and evidence sheet

PR1 demonstrated no product defect. PR2 found/fixed AC-048.2.3: missing booking-time
options left the disabled filter button labelled Searching after loading ended.
The fix separates loading wording from disabled state; the unchanged behavioural
expectation then passed. Failure evidence is retained and Jaydon confirmed the
evidence sheet is up to date, including Defects (Automated Testing). Owner/discovered/fixed fields: Jaydon; date 21 October 2026.
Fixture/assertion mistakes and expected refusals are not product defects.
Manual passes are confirmed by Jaydon; no manual defect was reported. PR #128 is
merged with four checks passed. The sheet is updated per Jaydon; documentation
merge and Jira transition remain. A separate 0100 deployment timestamp/operator
was not supplied. Required sheet owner/tester fields use Jaydon. Do not populate Automated
Test Case Runs. See `docs/test-evidence/us48/README.md` for local logs.

## Safety-stage follow-up — 29 October 2026

Owner: Jaydon. Migration 0116; branch `us48-safety-stage-replacements`.
17 grouped PostgreSQL integration cases extend the original 31 US48 cases to 48.
Both Awaiting safety review and In preparation run through each applicable scenario;
six concurrent-session executions share three race IDs. Synthetic failure injection
is an expected rollback check, not a product defect. No new frontend cases are needed
for unchanged screen/RPC contracts. Current results: `docs/test-evidence/us48/safety-stages/README.md`.

| ID | Type | Requirement-based scenario and expected result |
| --- | --- | --- |
| AC-048.1.5 | Integration — Happy path / Negative | Both agreed stages list affected bookings; unagreed and terminal stages stay excluded. |
| AC-048.3.10 | Integration — Negative | Another Coordinator cannot list or propose a replacement for these bookings. |
| AC-048.3.11 | Integration — Negative / Regression | Event changes invalidate decision consent and proposal source; refreshing only the decision cannot bypass stale source consent. |
| AC-048.3.12 | Integration — Negative / Regression | Ordinary booking approval remains refused; only the checked replacement link enables approval in either stage. |
| AC-048.3.13 | Integration — Boundary / Regression | Concurrent proposals in each stage permit exactly one pending request. |
| AC-048.3.14 | Integration — Negative | Safety changes requested and terminal event stages do not gain proposal permission. |
| AC-048.4.2 | Integration — Happy path / Regression | Proposals preserve events/original reservations and reserve no target cells. |
| AC-048.5.3 | Integration — Negative / Regression | Rejected/withdrawn requests retain originals and open Needs replacement reasons in both stages. |
| AC-048.6.11 | Integration — Happy path / Regression | Approve blocked and retired sources in both stages; preserve per-booking requirements, event information/stage and stored safety history, atomically release original and claim buffered target. |
| AC-048.6.12 | Integration — Happy path / Regression | Only blocked/retired reviews resolve with real approving staff/replacement; independent reasons remain open. |
| AC-048.6.13 | Integration — Negative / Boundary | A target setup-only block refuses approval in either stage. |
| AC-048.6.14 | Integration — Negative / Regression | Exact snapshots after conflict refusal prove no partial release, review resolution, replacement or history writes. |
| AC-048.6.15 | Integration — Regression | Populated 0116 replay preserves event, reservation, review, safety history and consent. |
| AC-048.6.16 | Integration — Boundary / Regression | Concurrent approval/rejection in each stage has one winner and retained authenticated decision audit. |
| AC-048.6.17 | Integration — Boundary / Regression | Competing replacements cannot double-book a target; loser keeps original claims, pending proposal and open flag. |
| AC-048.6.18 | Integration — Negative / Regression | Inject a late review-resolution failure after target approval; the entire replacement fails. |
| AC-048.6.19 | Integration — Negative / Regression | Exact snapshots prove the late failure leaves no replacement side effects or lost original data. |

Sources: `venue_replacement_safety_stages.sql`, `venue_replacement_safety_races.sh`
and replay assertion in `run_venue_replacement_safety_stages.sh` under `backend/supabase/tests/`.
Manual results for these new stages remain pending; earlier manual passes do not cover them.
