# US21 Cancel, postpone or reschedule an event (SCRUM-66): test cases

| Slice | ACs | Status |
|---|---|---|
| 1. Cancelling properly (0120) | AC-021.1 (cancel), AC-021.3 (cancel) | implemented; automated cases pass |
| 2. Reschedule, and postponement and new-date notices (0122) | AC-021.1 (reschedule), AC-021.2 (revised), AC-021.3 (postpone, reschedule), AC-021.4 | implemented; automated cases pass |

Test IDs follow `CLAUDE.md`: `AC-021.Y.Z`, Z unique across the story and increasing top to bottom
within each test file. Next free IDs: AC-021.1.13, AC-021.2.2, AC-021.3.4, AC-021.4.4.

Postponing itself (the status and the Coordinator's action) is US38's (0119): from Planning, In
Preparation or Confirmed. US21 adds rescheduling and the attendee notices.

## Acceptance criteria

- AC-021.1 Event Coordinators may cancel, postpone or reschedule an event at any stage.
- AC-021.2 (revised 1 Nov 2026, PO) For events that require a change in date/time: if a new
  date/time exists, the event is considered "rescheduled": it returns to Planning with the new date,
  and its existing venue bookings and equipment reservations are kept but flagged for review so the
  Coordinator can confirm or replace them. If there is no date/time decided, the event is
  "postponed": its bookings and reservations are kept and the event record is maintained until a
  new date is provided; the Coordinator may release individual bookings if needed.
  Previously: "If there is no date/time decided, current bookings are released but event records
  are maintained until a new date is provided." Revised to match team proposal #70 as implemented in
  US38 (0119: postponing changes no booking, reservation or allocation; 0121: an event leaving
  Confirmed returns to Planning with its arrangements flagged for review). Recorded in Jira.
- AC-021.3 Event Attendees will receive a notification when an event they registered for has been
  cancelled, postponed or rescheduled.
- AC-021.4 Event Attendees will be informed of the new date/time for rescheduled events.

## Slice 1 design decisions

| # | Decision | Why |
|---|---|---|
| D1 | Cancelling (from any stage the status rules allow) releases every pending or confirmed venue booking the way 0110 releases one: a `venue_booking_cancellations` row ("The event was cancelled.", who and when), status Cancelled, its slot claims deleted, and Venue Staff told under 0110's "Venue booking cancellations". Held bookings are still released by 0035, which runs after 0120's trigger. | Before 0120, confirmed bookings kept the venue's time taken after a cancellation. Reusing 0110's record and notice means Venue Staff see an event's cancellation exactly like an individual one. |
| D2 | Reserved equipment is released (allocation Cancelled). Items already checked out are left for the return inspection (US24), and their equipment booking stays open; one with nothing out is cancelled. | A cancellation cannot make equipment that is physically out disappear. |
| D3 | Registered attendees and those waiting for a place are told through the US33 helper, under a new attendee type "Cancelled, postponed or rescheduled events" (slice 2 reuses it). Withdrawn attendees are not. Registrations are kept. | AC-021.3; the event record, and so who registered, is kept. |
| D4 | It is a trigger on the event becoming Cancelled, so every way of cancelling does this. No change to the status rules. | One place, whatever cancels the event. |
| D5 | 0120 writes 0110's cancellation record, so both runners skip it in their first pass; the venue-time runner applies and tests it after 0110. | The main runner never applies 0110. |
| D6 | The Cancel confirmation now says what cancelling does. | The Coordinator knows before confirming. |

## Slice 2 design decisions

| # | Decision | Why |
|---|---|---|
| D7 | `reschedule_event()` (assigned Coordinator; from Approved, Planning, any safety stage, Confirmed or Postponed): the new start must be in the future, the end after it, and different from the current times. Each reschedule is kept in `event_reschedules` with the old date, who, when and the optional reason. | AC-021.1, AC-021.2: "event records are maintained". |
| D8 | The event returns to Planning (Approved and Planning keep their status) through the routes the status rules already have: US38's for Confirmed (as 0121 does), US45's for Awaiting Safety Review and In Preparation, the Coordinator's own for Safety Changes Requested and Postponed. No status function is replaced. | Re-planned with the new date; with the safety review on, it is reviewed again before confirming (US26, US45). Fewer shared changes. |
| D9 | Bookings and reservations are **kept**, and each live venue booking and equipment booking is flagged "Needs review" (US41's arrangement reviews, sourced from the reschedule; source and reason widened as 0105 does). (PO decision, path A.) | Team proposal #70 / US38 and 0121's pattern; the Coordinator confirms or replaces each. |
| D10 | Attendees registered or waiting for a place are told: on a reschedule, the new and old times (AC-021.4); on a postponement (US38's status), that a new date will follow. Slice 1's notification type is reused. Registrations are kept; anyone the new time does not suit can withdraw (US23). | AC-021.3, AC-021.4. |
| D11 | 0122 uses 0120's notification type, so both runners skip it in their first pass and the venue-time runner applies and tests it after 0120. | As for 0120. |
| D12 | The Coordinator's Decision card gains a Reschedule form (new start, new end, optional reason) for the statuses that can be rescheduled. | Where the Coordinator already decides on the event. |

## Automated test cases

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-021.1.1 | cancelling a confirmed event releases its confirmed and pending venue bookings, recorded as cancelled with the reason, and keeps the event record | integration (SQL) | normal | event_cancellation.sql |
| AC-021.1.2 | the venue's time is free again: another Coordinator can now hold it for the same time | integration (SQL) | conflict | event_cancellation.sql |
| AC-021.1.3 | Venue Staff are told about each booking the cancellation released | integration (SQL) | normal | event_cancellation.sql |
| AC-021.1.4 | reserved equipment is released; an item already checked out stays out for its return, and keeps its booking open | integration (SQL) | boundary | event_cancellation.sql |
| AC-021.1.5 | an event with nothing booked and nobody registered is simply cancelled | integration (SQL) | boundary | event_cancellation.sql |
| AC-021.3.1 | attendees registered or waiting for a place are told the event was cancelled; those who withdrew are not, and registrations are kept | integration (SQL) | normal | event_cancellation.sql |
| AC-021.3.2 | an attendee who turned these emails off is told in the app only | integration (SQL) | boundary | event_cancellation.sql |
| AC-021.1.6 | the Coordinator is told cancelling releases the bookings and reservations and tells attendees; declining changes nothing | component | normal | eventCancellation.test.tsx |
| AC-021.1.7 | the Coordinator reschedules a confirmed event: it takes the new date, returns to Planning, and the change is recorded with the old date | integration (SQL) | normal | event_reschedule.sql |
| AC-021.2.1 | its venue booking and equipment reservation are kept, each flagged for the Coordinator to confirm or replace at the new time | integration (SQL) | normal | event_reschedule.sql |
| AC-021.4.1 | attendees registered or waiting are told the new date and time (and the old one); those who withdrew are not, and registrations are kept | integration (SQL) | normal | event_reschedule.sql |
| AC-021.1.8 | an event in preparation or postponed is rescheduled back to Planning; an approved event keeps its status with the new date | integration (SQL) | boundary | event_reschedule.sql |
| AC-021.1.9 | only the assigned Coordinator reschedules, to a real future time that differs, and not a cancelled event; refusals record nothing | integration (SQL) | failure | event_reschedule.sql |
| AC-021.3.3 | when an event is postponed, its registered attendees are told a new date will follow, and their registrations are kept | integration (SQL) | normal | event_reschedule.sql |
| AC-021.1.10 | one call carries the new times and the trimmed reason; each refusal says why | unit (service) | failure | rescheduleService.test.ts |
| AC-021.1.11 | an event can be rescheduled at any stage before it is completed, cancelled or closed | unit | boundary | rescheduleService.test.ts |
| AC-021.1.12 | nothing is sent until both times are chosen and the end is after the start | component | failure | RescheduleEventForm.test.tsx |
| AC-021.4.2 | the chosen local times are sent as instants with the reason; afterwards the page refreshes and the form clears | component | normal | RescheduleEventForm.test.tsx |
| AC-021.4.3 | while saving the button waits; a refusal is shown and nothing is reported as rescheduled | component | failure | RescheduleEventForm.test.tsx |

## Manual test cases (shared Supabase, after 0120 is applied)

| ID | Steps | Expected | Result |
|---|---|---|---|
| M1 | As a Coordinator, cancel a confirmed event that has a confirmed venue booking, reserved equipment and registered attendees. | The confirmation says what will happen; the event is Cancelled. | Pass, Jeremiah (recorded 6 Nov 2026) |
| M2 | Open the venue's availability for that time. | Free again. | Pass, Jeremiah (recorded 6 Nov 2026) |
| M3 | As Venue Staff, and as a registered attendee, open Notifications. | "Venue booking cancelled: …" and "Event cancelled: …" respectively. | Pass, Jeremiah (recorded 6 Nov 2026) |
| M4 | As a Coordinator, open a confirmed event with registered attendees and use Reschedule with a later date. | The event is Planning with the new date; its bookings show "Needs review"; attendees get "Event rescheduled: …" with the new and old times. | Pass, Jeremiah (recorded 6 Nov 2026) |
| M5 | Postpone a planned event with registered attendees. | Attendees get "Event postponed: …"; its bookings are unchanged. | Pass, Jeremiah (recorded 6 Nov 2026) |

Record each result as Pass or Fail, with the date and who ran it (e.g. "Pass, 4 Nov 2026, Jeremiah"). The checks are listed in running order in `docs/manual-test-run-sheet.md`.

## Coverage and forced break

`ReviewActions.tsx`'s change is covered by AC-021.1.6; `rescheduleService.ts` and
`RescheduleEventForm.tsx` are at 100% statements and branches. SQL has no coverage tool; 0120 and
0122 are covered case by case above.

Forced break: in `0120_us21_cancel_event_releases.sql`, cancelling stopped releasing confirmed venue
bookings (`vb.status in ('pending_approval', 'confirmed')` changed to `vb.status in
('pending_approval')`). AC-021.1.1 failed; the file was then restored. Log:
`docs/test-evidence/us21/AC-021.1.1-forced-break.log`.

Forced break (slice 2): in `0122_us21_reschedule_and_postpone_notices.sql`, rescheduling stopped
flagging venue bookings (`where b.event_id = e.id` changed to `where false and b.event_id = e.id`).
AC-021.2.1 failed; the file was then restored. Log:
`docs/test-evidence/us21/AC-021.2.1-forced-break.log`.
