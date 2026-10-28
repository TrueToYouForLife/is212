# US44 Approve / reject / request changes for safety review (SCRUM-249): test cases

Week 7 change 6. The Safety Officer's decision on an event awaiting its Operational Safety Check
(US43). Part of the safety review, so it stays hidden and refused until the safety review is
switched on (see the checklist in `US43_test_cases.md`).

| Slice | ACs | Status |
|---|---|---|
| 1. Recording the decision, telling the Coordinator (0111) | AC-044.1 to AC-044.6 | implemented; automated cases pass |

Test IDs follow `CLAUDE.md`: `AC-044.Y.Z`, Z unique across the story and increasing top to bottom
within each test file. Next free IDs: AC-044.1.5, AC-044.2.6, AC-044.3.4, AC-044.4.4, AC-044.5.6,
AC-044.6.6.

## Acceptance criteria

- AC-044.1 The Safety Officer records an assessment (no concern or concern, with a note) for each
  factor: attendance, venue capacity and layout, emergency access, accessibility, equipment
  placement, crowd movement and venue restrictions.
- AC-044.2 The Safety Officer records one decision: Approve, Request Changes or Reject. A comment
  is required for Request Changes and Reject.
- AC-044.3 Approve moves the event to In Preparation.
- AC-044.4 Request Changes or Reject moves the event to Safety Changes Requested, naming the
  arrangements to revisit (venue, equipment or both); the event cannot proceed until a new review
  approves it.
- AC-044.5 The assigned Coordinator is notified of the decision and comments.
- AC-044.6 Only Safety Officers can record a decision, and each decision is recorded with who made
  it and when.

## Design decisions

| # | Decision | Why |
|---|---|---|
| D1 | `safety_review_decisions` (one row per decision: who, when, decision, comment, revisit) and `safety_review_assessments` (one row per factor). Read and written only through functions; RLS on, no direct grants. | AC-044.1, AC-044.6: every decision and its assessments are kept, never overwritten. |
| D2 | A note is required for every factor marked **concern**; optional for "no concern". (PO decision.) | Seven notes when nothing is wrong add friction without information. |
| D3 | Request Changes and Reject both move the event to Safety Changes Requested, as the AC says; which one it was is recorded and shown. Revising and resubmitting is US45. (PO decision.) | The Coordinator sees how serious it is; the workflow back is the same. |
| D4 | The revisit list is required for Request Changes and Reject (venue, equipment or both) and refused for Approve; stored once each, in a fixed order. (PO decision.) | AC-044.4. |
| D5 | The rules are enforced in the database (checks and constraints) and mirrored in the form, which says what is missing before sending. | The database is the control; the form saves a round trip. |
| D6 | `record_safety_review_decision()`: Safety Officers only, only while the safety review is switched on, only for an event awaiting review. The event moves through 0108's status rules (only a Safety Officer may move it out of review). | AC-044.3, AC-044.4, AC-044.6. |
| D7 | The assigned Coordinator is told through the US33 helper under a new type, "Safety review decisions": the decision, what to revisit, the comment and each concern. | AC-044.5, and Coordinators choose in-app and/or email like every other notice. |
| D8 | `get_safety_review_decisions()`: newest first, for the event's assigned Coordinator and Safety Officers only. | AC-044.5, AC-044.6. |
| D9 | The Safety Officer decides from the Safety reviews queue (US43 slice 2): **Review** opens the form; a decided event leaves the queue with a note of the outcome. The Coordinator sees a **Safety review** panel on the event page (behind `VITE_FEATURE_SAFETY_REVIEW`). | Where each of them already works. |

## Automated test cases

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-044.1.1 | a decision is refused if a factor is missing or repeated, or a concern has no note; nothing is recorded | integration (SQL) | failure | safety_review_decisions.sql |
| AC-044.1.2 | every factor's assessment is recorded with the decision; "no concern" needs no note | integration (SQL) | normal | safety_review_decisions.sql |
| AC-044.2.1 | Request Changes and Reject need a comment, and there is no other kind of decision | integration (SQL) | failure | safety_review_decisions.sql |
| AC-044.2.2 | Request Changes and Reject name venue, equipment or both to revisit; Approve names nothing | integration (SQL) | boundary | safety_review_decisions.sql |
| AC-044.3.1 | an approval moves the event to In Preparation | integration (SQL) | normal | safety_review_decisions.sql |
| AC-044.4.1 | Request Changes and Reject both move the event to Safety Changes Requested, recording which, and what to revisit | integration (SQL) | normal | safety_review_decisions.sql |
| AC-044.4.2 | an event sent back cannot move on: its Coordinator cannot prepare or confirm it, and it cannot be approved until sent for review again | integration (SQL) | conflict | safety_review_decisions.sql |
| AC-044.5.1 | the Coordinator is told each decision with its comment, what to revisit and the concerns, in the app and by email | integration (SQL) | normal | safety_review_decisions.sql |
| AC-044.5.2 | a Coordinator who turned these emails off is told in the app only | integration (SQL) | boundary | safety_review_decisions.sql |
| AC-044.6.1 | a Coordinator, Organiser or Lead cannot record a decision | integration (SQL) | conflict | safety_review_decisions.sql |
| AC-044.6.2 | each decision records who made it and when; its assigned Coordinator and Safety Officers can read it, other people cannot | integration (SQL) | normal | safety_review_decisions.sql |
| AC-044.6.3 | while the safety review is switched off, no decision can be recorded | integration (SQL) | boundary | safety_review_decisions.sql |
| AC-044.1.3 | each of the seven factors needs concern or no concern, and every concern needs a note | unit | boundary | safetyDecision.test.ts |
| AC-044.2.3 | a decision is required; Request changes and Reject need a comment and something to revisit | unit | boundary | safetyDecision.test.ts |
| AC-044.2.4 | one call carries the decision, the trimmed comment, what to revisit and all seven factors; an approval sends nothing to revisit | unit (service) | normal | safetyDecisionService.test.ts |
| AC-044.6.4 | each refusal says why; a rule the database rejects is shown as it explains it | unit (service) | failure | safetyDecisionService.test.ts |
| AC-044.5.3 | the decisions are read for the event and named for the app; refusals and odd answers say so | unit (service) | failure | safetyDecisionService.test.ts |
| AC-044.1.4 | the form lists the seven factors, and nothing is sent until each is answered and every concern described | unit | failure | SafetyReviewDecisionForm.test.tsx |
| AC-044.2.5 | the comment is required and what to revisit is offered for Request changes and Reject, not for Approve | unit | normal | SafetyReviewDecisionForm.test.tsx |
| AC-044.3.2 | an approval with every factor answered is recorded and reported | unit | normal | SafetyReviewDecisionForm.test.tsx |
| AC-044.4.3 | a change request carries its concerns, comment and what to revisit | unit | normal | SafetyReviewDecisionForm.test.tsx |
| AC-044.6.5 | while saving the button waits; a refusal is shown and nothing is reported as decided | unit | failure | SafetyReviewDecisionForm.test.tsx |
| AC-044.3.3 | Review opens the decision form; once decided the event leaves the queue with a note of the outcome | unit | normal | SafetyReviewQueueDecision.test.tsx |
| AC-044.5.4 | the latest decision shows who decided and when, what to revisit, the comment and each concern; earlier ones follow | unit | normal | SafetyReviewDecisionsPanel.test.tsx |
| AC-044.5.5 | before any decision the panel shows nothing; a failed load says why; a late answer after leaving is ignored | unit | failure | SafetyReviewDecisionsPanel.test.tsx |

US33's AC-033.1.1 (same ID) now also lists "Safety review decisions" among a Coordinator's
notification types.

## Manual test cases (shared Supabase, once the safety review is switched on)

| ID | Steps | Expected |
|---|---|---|
| M1 | As the Safety Officer, open Safety reviews, press Review on an event, choose Approve without answering the factors. | The form lists every factor still to answer; nothing is saved. |
| M2 | Answer every factor (one concern, with a note), choose Request changes, add a comment, tick Venue, record. | The event leaves the queue with "changes requested"; it is now Safety Changes Requested. |
| M3 | As its Coordinator, open the event and Notifications. | The Safety review panel shows the decision, comment, "Revisit: venue" and the concern; a "Safety review changes requested" notice is listed. |
| M4 | As the Coordinator, try to confirm the event. | Not offered; only cancelling is. |

## Coverage and forced break

`safetyDecision.ts`, `safetyDecisionService.ts`, `SafetyReviewDecisionForm.tsx`,
`SafetyReviewDecisionsPanel.tsx` and `SafetyReviewQueuePage.tsx` are at 100% statements and
branches. SQL has no coverage tool; 0111 is covered case by case above.

Forced break: in `0111_us44_safety_review_decisions.sql`, the Coordinator's notice was switched off
(`if e.coordinator_id is not null then` changed to `if false then`). AC-044.5.1 failed; the file
was then restored. Log: `docs/test-evidence/us44/AC-044.5.1-forced-break.log`.
