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

Next unused IDs: AC-048.1.2, .2.1, .3.8, .4.2, .5.2, .6.11.
Existing US20/US41 frontend compatibility cases retain their existing IDs.

## Manual checks — pending

Use separate seeded **Venue Staff** and **current assigned Coordinator** accounts.
Use future disposable events and venues with operating hours covering the full
occupied interval. Execute after deployment and repeat the complete UI workflow
when PR2 is available. None of these checks is recorded as passed yet.

| AC | Account and action | Expected result |
|---|---|---|
| 1/5 | Venue Staff blocks one original venue and retires another. Coordinator opens their affected bookings. | Both reasons are available; originals remain recorded. Final Needs replacement wording and search entry points require PR2. |
| 3/4 | Coordinator proposes a target for a flagged booking and reloads. | Proposal appears in staff review; original reservation and event details remain; target has no reservation yet. |
| 6 | Staff approves a target with 15-minute setup and 30-minute turnaround. | Target is confirmed with buffers; original cells release, or remain maintenance-blocked where appropriate. Event information is unchanged. |
| 6 | Approve an original with a blocked/retired review and a separate capacity/layout review. | Only blocked/retired reviews resolve; their audit records the signed-in staff member and replacement booking. Independent review stays open. |
| 6 | Staff rejects a proposal; Coordinator withdraws another. | Originals and open reviews remain; decision history persists. |
| 6 | After proposal, block the target's setup period or occupy it with another booking. Staff attempts approval. | Approval fails with no original/claim/review loss and no committed target booking. |
| 3/4 | Replace an upcoming Confirmed event's affected booking. Attempt ordinary unrelated booking approval separately. | Replacement succeeds without changing event status/details; ordinary approval is refused. |
| 3 | Change event details or reassign Coordinator after proposal; try an old decision. | Old decision is refused; current Coordinator can withdraw and submit fresh consent. |

## Defects and evidence sheet

No product defect demonstrated in PR1. Fixture corrections and expected conflict,
permission, stale and injected-failure outcomes are not automated defects.
Manual defects/results, shared sheet updates, CI and deployment remain pending.
At story closeout update Test Case Overview, Manual Testing and Defects (Automated
Testing), using Jaydon in required owner/tester fields. Do not populate Automated
Test Case Runs. See `docs/test-evidence/us48/README.md` for local logs.
