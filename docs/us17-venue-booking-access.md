# US17 AC1 x venue booking — no new holds for unassigned events (0049)

Owner: Jeremiah. Jira: SCRUM-250, a subtask of SCRUM-61 (US17), related to SCRUM-160.
Migration: `0049_venue_booking_assigned_coordinator.sql`. Apply after 0048.

## Problem

AC-017.1 puts unassigned events in the Lead's queue, and only the assigned coordinator should
manage an event. 0036 recreated `bookings_insert_coordinator` with
`e.coordinator_id = auth.uid() or e.coordinator_id is null`, so any coordinator could place a
new hold for an unassigned event through the API. The app's `holdVenue()` already refused
this; the database did not.

0047 (SCRUM-160) moved the update and slot-claim policies onto the current assignment but left
this insert policy unchanged.

## Change

0049 recreates `bookings_insert_coordinator` with `is_assigned_event_coordinator(event_id)`
(from 0024) in place of the `is null` clause. Everything else in the policy is unchanged:
`requested_by = auth.uid()`, status `held`, event `approved` or `planning`.

Not changed: 0047's legacy path. A booking that already exists for an unassigned event can
still be managed by the coordinator who placed it. No frontend change: `holdVenue()` already
checks the assignment.

## Tests

| ID | Checks | Type | Scenario |
| --- | --- | --- | --- |
| AC-017.1.12 | a coordinator cannot hold a venue for an approved event with no coordinator | integration (SQL, real RLS) | conflict |

In `venue_blocks.sql`, the unassigned-event booking B8 is now created by the test
administrator, because no coordinator can create it since 0049. AC-012.8.3 still checks how
its flag is routed, and its later cancellation by coordinator 4 still works through 0047's
legacy path.

Forced break: with 0049 removed, the runner fails at AC-017.1.12.

SQL tests have no coverage tool; the policy is covered by the case above. No frontend code
changed, so frontend coverage is unaffected.

Next ID: AC-017.1.13.

## Known gaps, not fixed here

- `claims_delete_coordinator` has no status check (0018, kept by 0047), so the coordinator can
  free a confirmed or pending booking's slots without cancelling it. Needs a product decision
  on whether coordinators may cancel confirmed bookings; AC-012.9.11 relies on the current
  behaviour.
- `holdVenue()` deletes the booking row when claiming slots fails, but `venue_bookings` has no
  delete policy, so the clean-up silently does nothing.
