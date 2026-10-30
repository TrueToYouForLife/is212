# US45 Revise arrangements after a safety review (SCRUM-240): test cases

Week 7 change 6. What happens after the Safety Officer requests changes or rejects (US44), and when
arrangements change during or after the review. Part of the safety review, so it only matters once
the safety review is switched on (see the checklist in `US43_test_cases.md`).

| Slice | ACs | Status |
|---|---|---|
| 1. Revise, resubmit and send back (0118) | AC-045.1 to AC-045.6 | implemented; automated cases pass |

Test IDs follow `CLAUDE.md`: `AC-045.Y.Z`, Z unique across the story and increasing top to bottom
within each test file. Next free IDs: AC-045.1.2, AC-045.2.5, AC-045.3.2, AC-045.4.3, AC-045.5.2,
AC-045.6.5.

## Acceptance criteria

- AC-045.1 The Coordinator can see the Safety Officer's decision, comments and the arrangements named
  for revision.
- AC-045.2 The named venue and equipment arrangements are flagged "Needs review".
- AC-045.3 Changes to those arrangements go through the normal approval flows again (Venue Staff for
  venues, Technical Support Staff for equipment).
- AC-045.4 Once every flagged arrangement is resolved, the Coordinator can resubmit the event,
  returning it to Awaiting Safety Review.
- AC-045.5 Earlier safety reviews for the event remain viewable by the Coordinator and Safety Officers.
- AC-045.6 If a significant change is approved after safety approval, the event needs a new safety
  review before it can be confirmed.

## Design decisions (PO decisions 1 to 3)

| # | Decision | Why |
|---|---|---|
| D1 | **Revise in Planning.** "Revise arrangements" moves a Safety Changes Requested event back to Planning; it is sent for review again with the existing "Send for safety review". The unchecked Safety Changes Requested -> Awaiting Safety Review route is removed. | The customer's wording ("the event returns to the relevant earlier planning stage"), and every booking and equipment flow already works in Planning, so no other story's functions change. Revising in Safety Changes Requested would have meant widening about seven functions owned by four teammates in the final week. |
| D2 | **US41's "Needs review" flags.** Revising flags each live venue booking and/or equipment booking the latest decision named (reason `safety_review`, sourced from the decision, with its comment), automatically, whichever way the event is moved to Planning. They are resolved in the existing Arrangement reviews panel. The source and reason rules are widened the way 0105 does it, keeping every other story's sources and reasons. | The mechanism, panel and notices Coordinators already know; a separate safety checklist would duplicate them. |
| D3 | **Open reviews hold the event back.** With the safety review switched on, the readiness card shows "Arrangements needing review" while any arrangement review flag or venue block/retirement flag is open, linking to the Arrangement reviews section. Because readiness is one shared rule, this holds back both "Send for safety review" (US43) and confirming (US26). Switched off, nothing changes. | One rule for the card, sending and confirming. |
| D4 | **A change sends it back (AC-045.6).** A new arrangement review flag (change requests, planning updates, venue edits, equipment status, safety reviews) or venue block/retirement flag on an event Awaiting Safety Review **or** In Preparation sends it back to Planning, and its Coordinator is told it needs a new safety review. Nobody can move those events back by hand. | The Safety Officer reviews a snapshot; neither an approval nor a review in progress should rest on arrangements that have since changed. |
| D5 | Rebuilt from the latest of each shared function: `is_valid_status_transition()` and `event_readiness_lines()` from 0108, `enforce_event_status_transition()` from 0117 (carrying 0115, 0096 and US26). The runners re-apply 0118 after every 0117 re-apply. | Anything replacing these again must carry 0118, as 0115 and 0117 note. |

## Automated test cases

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-045.1.1 | the Coordinator sees the Safety Officer's decision, comment and the arrangements named for revision | integration (SQL) | normal | safety_review_revision.sql |
| AC-045.2.1 | "Revise arrangements" returns the event to Planning and flags each named venue and equipment arrangement "Needs review", with the comment | integration (SQL) | normal | safety_review_revision.sql |
| AC-045.2.2 | only the Coordinator revises; a sent-back event cannot skip revising, and nobody moves an event out of review by hand | integration (SQL) | conflict | safety_review_revision.sql |
| AC-045.3.1 | in Planning the changed arrangements wait for review and approval again; the event cannot be sent meanwhile | integration (SQL) | boundary | safety_review_revision.sql |
| AC-045.4.1 | once every flagged arrangement is resolved and approved, the Coordinator resubmits and the Safety Officers are told again | integration (SQL) | normal | safety_review_revision.sql |
| AC-045.5.1 | after a second review both decisions remain, newest first, for the Coordinator and the Safety Officer | integration (SQL) | normal | safety_review_revision.sql |
| AC-045.6.1 | a venue change after safety approval sends the event back to Planning, so it needs a new review before it can be confirmed, and its Coordinator is told | integration (SQL) | conflict | safety_review_revision.sql |
| AC-045.6.2 | a change while an event awaits review sends it back to Planning too (so off the Safety Officer's queue), and its Coordinator is told | integration (SQL) | conflict | safety_review_revision.sql |
| AC-045.6.3 | while the safety review is switched off, a change moves nothing | integration (SQL) | boundary | safety_review_revision.sql |
| AC-045.2.3 | a sent-back event offers "Revise arrangements" (back to Planning) and cancelling, not resubmitting directly | unit | normal | safetyRevision.test.tsx |
| AC-045.2.4 | pressing "Revise arrangements" moves the event to Planning | unit | normal | safetyRevision.test.tsx |
| AC-045.4.2 | the "Arrangements needing review" line links to the arrangement reviews on the page | unit | normal | safetyRevision.test.tsx |
| AC-045.6.4 | nobody is offered a button to move an event in review or preparation back to Planning | unit | conflict | safetyRevision.test.tsx |

US43's own tests that listed the old Safety Changes Requested -> Awaiting route (AC-043.1.9, and the
lifecycle table in `statusRules.test.ts`) now list the Planning route (same IDs).

## Manual test cases (shared Supabase, once the safety review is switched on)

| ID | Steps | Expected |
|---|---|---|
| M1 | As the Safety Officer, request changes to an event, naming Venue, with a comment. | The event is Safety Changes Requested; the Coordinator's Safety review panel shows it. |
| M2 | As its Coordinator, press "Revise arrangements". | The event is Planning; its venue booking shows "Needs review" with the comment; the Readiness card shows "Arrangements needing review". |
| M3 | Resolve the review, then "Send for safety review". | Sent; it is back in the Safety Officer's queue. |
| M4 | Approve it; then, as Venue Staff, block its venue on the event's date. | The event goes back to Planning; the Coordinator is told it needs a new safety review. |

## Coverage and forced break

`statusRules.ts` and `readinessLinks.ts` are at 100% statements and branches. SQL has no coverage
tool; 0118 is covered case by case above.

Forced break: in `0118_us45_revise_after_safety_review.sql`, revising stopped flagging the venue
arrangement (`if 'venue' = any (d.revisit) then` changed to `if false then`). AC-045.2.1 failed;
the file was then restored. Log: `docs/test-evidence/us45/AC-045.2.1-forced-break.log`.
