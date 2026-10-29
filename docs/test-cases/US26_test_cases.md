# US26 Confirm an event (SCRUM-71): test cases

| Slice | ACs | Status |
|---|---|---|
| 1. Confirm only when ready (0117) | AC-026.1, AC-026.2, AC-026.3 | implemented; automated cases pass |

Test IDs follow `CLAUDE.md`: `AC-026.Y.Z`, Z unique across the story and increasing top to bottom
within each test file. Next free IDs: AC-026.1.7, AC-026.2.3, AC-026.3.2.

## Acceptance criteria

- AC-026.1 Event Coordinators can confirm an event when every arrangement essential for that event
  is complete.
- AC-026.2 Events that are confirmed will have a "Confirmed" status visible to relevant users.
- AC-026.3 Events that are confirmed will prevent other users from booking the same venue at the
  same timeslot.

## Design decisions

| # | Decision | Why |
|---|---|---|
| D1 | "Every essential arrangement complete" is the readiness card's rule (US5, with US49's venue rule from 0107, shared through 0108's `event_readiness_lines()`): every line complete except registration setup, which only opens once the event is confirmed. `event_ready_to_confirm()` applies it. | One rule for the card, the safety review (US43) and confirming. |
| D2 | The check is in the status rules (`enforce_event_status_transition()`), so every change to Confirmed goes through it, not only the Confirm button. Refused with SQLSTATE 55000. (PO decision, option A.) | The database is the control; nothing can confirm an unready event. |
| D8 | 0117 recreates `enforce_event_status_transition()` from **0115** (US37's merge fix: 0108's safety stages with 0096's clarification case put back), adding only the readiness check, so it is now the last word on the function and carries all three. US26 was first built as 0113, before 0115 merged; 0115 replaces the same function, so on a fresh install it would have removed US26's check. US26 was renumbered to run after 0115 everywhere; 0113 is unused. | The lesson from 0080 and 0115: a migration that replaces a shared function must start from its latest version and come after it. |
| D3 | It works with the safety review switch either way: switched off, Planning -> Confirmed as before, now only once ready; switched on, In Preparation -> Confirmed only, and the card's Safety review line is complete only once the Safety Officer has approved (US44). | US43's switch keeps today's flow until the team turns the safety review on. |
| D4 | Changes made with no signed-in user (SQL editor, fixtures) are not checked, as for every status rule; no existing test needed changing. | Same as 0006 and 0108. |
| D5 | The runners re-apply 0108 and 0115 in places (0115 after 0066's replay, after 0108's replay and after 0096's replay; 0108 in US43's block and after 0107 in the venue-time runner), which resets the status rules; 0117 is re-applied after each. In the venue-time runner that also restores 0115's clarification case, which 0108's re-apply there drops. | Otherwise later tests would run without US26's check. |
| D6 | The Confirm button is unchanged; when the database refuses, the Coordinator is told "This event is not ready to be confirmed: every essential arrangement on its Readiness card must be complete." | AC-026.1, using the existing review actions (US4). |
| D7 | AC-026.2 and AC-026.3 were already met (the Confirmed label and Organiser text; the approved venue booking's claims). US26 tests them. | Regression protection. |

## Automated test cases

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-026.1.1 | an event is not confirmed while its venue awaits Venue Staff, its programme is missing, essential equipment is unavailable or no venue is booked | integration (SQL) | failure | confirm_event.sql |
| AC-026.1.2 | once every essential arrangement is complete the Coordinator confirms it; registration setup does not hold it back | integration (SQL) | normal | confirm_event.sql |
| AC-026.1.3 | an Organiser or Venue Staff cannot confirm an event, even a ready one | integration (SQL) | conflict | confirm_event.sql |
| AC-026.1.4 | with the safety review on, Planning cannot be confirmed; In Preparation can, once every essential arrangement is complete | integration (SQL) | boundary | confirm_event.sql |
| AC-026.2.1 | the Organiser and the assigned Coordinator see the event as Confirmed | integration (SQL) | normal | confirm_event.sql |
| AC-026.3.1 | once an event is confirmed, another Coordinator cannot book its venue at the same time; another time is still free | integration (SQL) | conflict | confirm_event_booking.sql |
| AC-026.1.5 | when the database refuses because the event is not ready, the Coordinator is told exactly that | unit (service) | failure | confirmEventService.test.ts |
| AC-026.1.6 | pressing Confirm on an event that is not ready says why, and nothing changes | unit | failure | confirmEvent.test.tsx |
| AC-026.2.2 | the badge reads Confirmed, and the Organiser is told the event will go ahead | unit | normal | confirmEvent.test.tsx |

## Manual test cases (shared Supabase, after 0117 is applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | As a Coordinator, open an event in Planning whose venue booking is still pending; press Confirm event. | "This event is not ready to be confirmed…"; still Planning. |
| M2 | Once Venue Staff approve the booking and the programme is written, press Confirm event again. | The event is Confirmed; the Organiser sees "Your event has been confirmed and is ready to proceed." |
| M3 | As another Coordinator, try to hold the same venue at the same time for a different event. | Refused; the time is taken. |

## Coverage and forced break

The new refusal in `eventReviewService.ts` (`55000`) is covered both ways; the file's remaining
uncovered branches predate US26. SQL has no coverage tool; 0117 is covered case by case above.

Forced break: in `0117_us26_confirm_when_ready.sql`, the readiness check was switched off (`if new.status
= 'confirmed' and not public.event_ready_to_confirm(new.id) then` changed to `if false then`).
AC-026.1.1 failed; the file was then restored. Log: `docs/test-evidence/us26/AC-026.1.1-forced-break.log`.
