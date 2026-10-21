# US48 manual verification

Tester: Jaydon. Result reported: 21 October 2026.
Implementation: PR #127 (backend) and PR #128 (frontend and continuous blocks), merged.

Jaydon confirmed **“ok all pass”** after the nine-step manual checklist in the
project chat. This records that report, including its setup prerequisites, and
groups the behavioural results below. No manual defect was reported.

Accounts used by the checklist: Venue Staff and the current assigned Event
Coordinator, plus an unassigned Coordinator for the access check. Exact account,
event, booking and venue IDs were not supplied, so none are invented here.
The reported workflow uses 0099/0100 functionality; 0099 deployment was explicitly
confirmed earlier. No separate 0100 deployment timestamp or operator is recorded.
Email delivery was not part of the pass claim.

| Check | Story / AC | Scenario | Reported result |
|---|---|---|---|
| 1 | US12 / 2, 5, 6, 7, 9 | Continuous block timing and removal. Venue Staff: start date 21:00 to next date 08:00; exact endpoints, midnight, middle day, Full day, invalid bounds, preview invalidation and removal. | Pass — One continuous half-open period; adjacent cells remain available; invalid periods refuse preview; changing endpoints requires another preview; removing the block releases its cells. |
| 2 | US48 / 1, 5 | Affected booking and independent reason. Venue Staff blocks the original booking and reduces its layout capacity; assigned Coordinator reloads bookings and arrangement reviews. | Pass — Original booking remains with Needs replacement and the block reason; independent capacity review also exists; event information remains intact. |
| 3 | US48 / 2, 3, 4, 5 | Prefilled search and pending proposal. Assigned Coordinator opens Find replacement, checks event timing/requirements, selects an available venue, enters the proposal reason and submits. | Pass — Requirements are prefilled; pending history appears; original reservation/event remain; Needs replacement remains; proposal reserves no target cells. |
| 4 | US48 / 5, 6 | Withdrawal and rejection. Coordinator withdraws one proposal; submits another; Venue Staff rejects it with a decision note. | Pass — Both decisions remain in history; original reservation and open reviews remain; original still needs replacement. |
| 5 | US48 / 4, 5, 6 | Failed approval preserves original. After proposal, Venue Staff blocks only the target setup period and attempts approval. | Pass — Approval is refused; no confirmed replacement is created; original reservation and both original reviews remain unchanged. |
| 6 | US48 / 3, 4, 5, 6 | Successful replacement and buffer occupancy. After removing the target test block, Venue Staff approves a current proposal; Coordinator reloads bookings and history. | Pass — Target confirmed with 15-minute setup and 30-minute turnaround; original Released without Needs replacement; event details/status unchanged; released cells under the original active block remain blocked. |
| 7 | US48 / 6 | Selective review resolution and audit. After successful approval, compare the original block/capacity reviews and matching replacement decision audit. | Pass — Only eligible block review resolves; capacity review stays open; approving staff and replacement booking match the actual approved request. |
| 8 | US48 / 1, 3, 4, 5, 6 | Retired-venue replacement. Venue Staff retires a disposable original venue with a reason; Coordinator requests another venue; Venue Staff approves. | Pass — Retirement reason and Needs replacement appear before approval; afterwards the original is released, event preserved and retirement review resolved with staff/replacement attribution. |
| 9 | US48 / 3 | Access and stale consent. Unassigned Coordinator opens another event replacement URL; separately change relevant event requirements after a proposal and try the previously loaded staff approval. | Pass — Unassigned Coordinator cannot read/propose the replacement; stale requirements cannot be silently approved; fresh Coordinator consent is required. |

The setup step required future disposable events with confirmed original venue
bookings, a suitable replacement venue and its 15-minute setup/30-minute turnaround.
Example dates, attendance and times in the instructions are test guidance, not
recorded fixture values. The passing result covers the prescribed checks, not
unreported screenshots or individual database identifiers.

Coordinator reassignment, the special Confirmed-event eligibility exception,
ordinary unrelated approval refusal, legacy gap preservation, forced database
failure rollback and simultaneous requests remain supported by automated evidence.
They are not added here as independently reported manual scenarios.

Only the eight US48 groups belong in the Manual Testing submission (columns A–F).
The continuous-block support group stays in this report, outside the sheet submission. Pass/fail
is based on Jaydon's report. Defect/fix/date fields remain blank because no manual
defect was reported. The report date appears in the test text; it is not an invented
execution timestamp. Jaydon confirmed the evidence sheet is up to date.
Documentation merge and Jira transition remain with Jaydon.
