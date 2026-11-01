# US21 Cancel, postpone or reschedule an event (SCRUM-66): test cases

| Slice | ACs | Status |
|---|---|---|
| 1. Cancelling properly (0120) | AC-021.1 (cancel), AC-021.3 (cancel) | implemented; automated cases pass |
| 2. Postpone and reschedule | AC-021.1 (postpone, reschedule), AC-021.2, AC-021.3 (postpone, reschedule), AC-021.4 | not started |

Test IDs follow `CLAUDE.md`: `AC-021.Y.Z`, Z unique across the story and increasing top to bottom
within each test file. Next free IDs: AC-021.1.7, AC-021.2.1, AC-021.3.3, AC-021.4.1.

## Acceptance criteria

- AC-021.1 Event Coordinators may cancel, postpone or reschedule an event at any stage.
- AC-021.2 For events that require a change in date/time: if a new date/time exists, the event is
  considered "rescheduled". If there is no date/time decided, current bookings are released but
  event records are maintained until a new date is provided.
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

## Slice 2 decisions still open (PO)

1. Postponed as a new status (clear, matches the AC; changes the shared status list) or Planning with no dates.
2. Rescheduling a booked event: release the old bookings and return it to Planning to rebook, or flag them for review as change requests do (US41).
3. Whether registrations survive a postponement or reschedule (suggested: yes, attendees told).

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
| AC-021.1.6 | the Coordinator is told cancelling releases the bookings and reservations and tells attendees; declining changes nothing | unit | normal | eventCancellation.test.tsx |

## Manual test cases (shared Supabase, after 0120 is applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | As a Coordinator, cancel a confirmed event that has a confirmed venue booking, reserved equipment and registered attendees. | The confirmation says what will happen; the event is Cancelled. |
| M2 | Open the venue's availability for that time. | Free again. |
| M3 | As Venue Staff, and as a registered attendee, open Notifications. | "Venue booking cancelled: …" and "Event cancelled: …" respectively. |

## Coverage and forced break

`ReviewActions.tsx`'s change is covered by AC-021.1.6. SQL has no coverage tool; 0120 is covered
case by case above.

Forced break: in `0120_us21_cancel_event_releases.sql`, cancelling stopped releasing confirmed venue
bookings (`vb.status in ('pending_approval', 'confirmed')` changed to `vb.status in
('pending_approval')`). AC-021.1.1 failed; the file was then restored. Log:
`docs/test-evidence/us21/AC-021.1.1-forced-break.log`.
