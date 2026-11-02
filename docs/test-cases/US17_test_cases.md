# US17 — Assign / reassign an Event Coordinator

## Documentation accuracy review — 2 November 2026

The 53 source IDs remain mapped to their actual unit, component and database tests.
Mocked frontend handover checks are separate from SQL permission enforcement. Coordinator
name lookup returns no names for disallowed staff or oversized batches; the visitor case
expects a permission error. Earlier TDD/rollout notes retain their historical dates.

[Review findings and limits](../jaydon-test-documentation-review.md).

Owner: Jaydon. Catalogue checked: 2 November 2026.

## Scope and evidence

This catalogue maps existing test-source IDs to their AC numbers, assertions and files.
Descriptions follow the current test titles/assertion labels; parameter rows keep their
existing IDs. Counts are unique source IDs, not a count of runtime executions or a new
coverage measurement. Shared cross-story assertions may appear in both relevant catalogues.

This is a documentation update. It does not claim fresh automated passes, manual
acceptance, deployed migrations or email delivery. Unit tests exercise pure logic or mock
external services; component tests render UI with their source's mocks; SQL/shell
integration tests use the disposable database runners. Existing evidence and historical
checkpoints remain in their original documents. Manual results are valid only where an
actual execution/report is recorded.

Related implementation notes: [us17-assignment.md](../us17-assignment.md), [us17-venue-booking-access.md](../us17-venue-booking-access.md).

## Existing cases (53 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-017.1.1 | 1 | Unit — Happy path | recognises the signed-in Coordinator Lead profile | [frontend/src/features/auth/__tests__/coordinatorLeadProfile.test.ts](../../frontend/src/features/auth/__tests__/coordinatorLeadProfile.test.ts#L10) |
| AC-017.1.2 | 1 | Integration — Happy path | database accepts an administrator-assigned Coordinator Lead profile | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L15) |
| AC-017.1.3 | 1 | Integration — Negative | organiser cannot assign through the function | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L72) |
| AC-017.1.4 | 1 | Integration — Negative | organiser cannot assign through a direct update | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L75) |
| AC-017.1.5 | 1 | Integration — Negative | coordinator cannot self-assign through the function | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L78) |
| AC-017.1.6 | 1 | Integration — Negative | coordinator cannot self-assign through a direct update | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L81) |
| AC-017.1.7 | 1 | Integration — Negative | legacy Operations Manager cannot assign through the function | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L84) |
| AC-017.1.8 | 1 | Integration — Negative | legacy Operations Manager cannot assign through a direct update | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L87) |
| AC-017.1.9 | 1 | Integration — Happy path / Negative | The Lead can read an unassigned submitted event; another Organiser's draft stays private. | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L104) |
| AC-017.1.10 | 1 | Component — Happy path | The Lead sees and filters submitted unassigned requests with their basic details. | [frontend/src/features/events/__tests__/CoordinatorAssignmentQueue.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorAssignmentQueue.test.tsx#L19) |
| AC-017.1.12 | 1 | Integration — Negative | a coordinator cannot hold a venue for an approved event with no coordinator | [backend/supabase/tests/venue_booking_assignment.sql](../../backend/supabase/tests/venue_booking_assignment.sql#L97) |
| AC-017.2.1 | 2 | Integration — Happy path | Coordinator Lead assigns a submitted event to an Event Coordinator | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L113) |
| AC-017.2.2 | 2 | Integration — Negative | Lead cannot assign a draft | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L132) |
| AC-017.2.3 | 2 | Integration — Negative | Assignment without a selected Coordinator is refused; existing assignment remains unchanged. | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L135) |
| AC-017.2.4 | 2 | Integration — Negative | Lead cannot select an organiser as coordinator | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L139) |
| AC-017.2.5 | 2 | Integration — Negative | Lead cannot select a nonexistent coordinator | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L143) |
| AC-017.2.6 | 2 | Integration — Happy path | one coordinator can hold multiple submitted events | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L177) |
| AC-017.2.7 | 2 | Integration — Negative | Lead cannot assign a nonexistent event | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L181) |
| AC-017.2.8 | 2 | Integration — Happy path / Negative / Boundary | Only the Lead gets picker names and active assignment counts; idle Coordinators are included and other roles are refused. | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L341) |
| AC-017.2.9 | 2 | Component — Happy path / Negative | The Lead selects a Coordinator with workload shown and can retry a failed assignment. | [frontend/src/features/events/__tests__/CoordinatorAssignmentQueue.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorAssignmentQueue.test.tsx#L55) |
| AC-017.3.1 | 3 | Integration — Happy path / Regression | immediate active-event reassignment; completed/cancelled events remain unchanged | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L221) |
| AC-017.3.2 | 3 | Component — Happy path / Regression | Lead reassigns an active event with retry feedback and no controls for closed events | [frontend/src/features/events/__tests__/CoordinatorAssignmentQueue.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorAssignmentQueue.test.tsx#L112) |
| AC-017.4.1 | 4 | Integration — Happy path / Negative / Regression | Reassignment denies the previous Coordinator, permits the new Coordinator to approve and leaves the event intact after a denied action. | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L259) |
| AC-017.4.2 | 4 | Integration — Happy path / Negative / Regression | Venue management follows the current assignee; former/unrelated Coordinators are refused and requester/slots are preserved appropriately. | [backend/supabase/tests/coordinator_assignment_venue_access.sql](../../backend/supabase/tests/coordinator_assignment_venue_access.sql#L69) |
| AC-017.4.3 | 4 | Unit — Happy path / Negative / Regression | The new Coordinator lists, submits and releases an inherited booking; the previous Coordinator cannot. | [frontend/src/features/venues/__tests__/venueBookingAssignment.test.ts](../../frontend/src/features/venues/__tests__/venueBookingAssignment.test.ts#L11) |
| AC-017.4.4 | 4 | Integration — Happy path / Negative / Regression | Equipment booking/line management follows the current Coordinator while retaining requester attribution and reservations. | [backend/supabase/tests/coordinator_assignment_equipment_access.sql](../../backend/supabase/tests/coordinator_assignment_equipment_access.sql#L81) |
| AC-017.4.5 | 4 | Integration — Negative / Regression | Direct Coordinator decisions cannot overwrite requester identity or staff reservation quantities. | [backend/supabase/tests/coordinator_assignment_equipment_access.sql](../../backend/supabase/tests/coordinator_assignment_equipment_access.sql#L119) |
| AC-017.4.6 | 4 | Component — Happy path / Regression | coordinator sees assigned requests first and refresh moves reassigned requests between sections | [frontend/src/features/events/__tests__/CoordinatorRequestSections.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorRequestSections.test.tsx#L23) |
| AC-017.4.7 | 4 | Integration — Happy path | a Coordinator who is not the assigned one still sees the assigned Coordinator's name; so does a Coordinator Lead; and an Operations Manager | [backend/supabase/tests/event_coordinator_names.sql](../../backend/supabase/tests/event_coordinator_names.sql#L48) |
| AC-017.4.8 | 4 | Integration — Happy path | an Organiser is told the name for their own event, and not for another Organiser's | [backend/supabase/tests/event_coordinator_names.sql](../../backend/supabase/tests/event_coordinator_names.sql#L66) |
| AC-017.4.9 | 4 | Integration — Negative | Attendee, Venue Staff and Technical Support receive no Coordinator names. | [backend/supabase/tests/event_coordinator_names.sql](../../backend/supabase/tests/event_coordinator_names.sql#L73) |
| AC-017.4.10 | 4 | Integration — Negative | a visitor who is not signed in is refused | [backend/supabase/tests/event_coordinator_names.sql](../../backend/supabase/tests/event_coordinator_names.sql#L90) |
| AC-017.4.11 | 4 | Integration — Boundary | An unassigned event and a nonexistent event ID return no Coordinator name. | [backend/supabase/tests/event_coordinator_names.sql](../../backend/supabase/tests/event_coordinator_names.sql#L97) |
| AC-017.4.12 | 4 | Integration — Boundary | A batch of 501 IDs returns no names; a batch of exactly 500 remains permitted. | [backend/supabase/tests/event_coordinator_names.sql](../../backend/supabase/tests/event_coordinator_names.sql#L101) |
| AC-017.4.13 | 4 | Unit — Happy path | someone else's event names that Coordinator | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L12) |
| AC-017.4.14 | 4 | Unit — Happy path | the viewer's own event names them and says it is them | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L16) |
| AC-017.4.15 | 4 | Unit — Boundary | an event nobody is assigned to says so; only an explicit null means that | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L20) |
| AC-017.4.16 | 4 | Unit — Negative | if the name could not be loaded it says someone is assigned, without guessing who | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L25) |
| AC-017.4.17 | 4 | Unit — Happy path | maps each event to its Coordinator's name | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L32) |
| AC-017.4.18 | 4 | Unit — Boundary | no events means no request at all | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L42) |
| AC-017.4.19 | 4 | Unit — Happy path / Boundary | more than 500 events are asked for in chunks, within the database's limit | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L47) |
| AC-017.4.20 | 4 | Unit — Negative | a failed lookup says so without the raw error, so the cards fall back | [frontend/src/features/events/__tests__/coordinatorNames.test.ts](../../frontend/src/features/events/__tests__/coordinatorNames.test.ts#L55) |
| AC-017.4.21 | 4 | Component — Happy path | a card shows the label it is given, and nothing when it has none | [frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx](../../frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx#L33) |
| AC-017.4.22 | 4 | Component — Happy path | an Organiser's own requests show who coordinates each event | [frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx](../../frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx#L42) |
| AC-017.4.23 | 4 | Component — Happy path | an Operations Manager sees the names too | [frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx](../../frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx#L48) |
| AC-017.4.24 | 4 | Component — Negative | if the names cannot be loaded, the card still says someone is assigned | [frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx](../../frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx#L54) |
| AC-017.4.25 | 4 | Component — Happy path | a Coordinator Lead's view does not look names up; its cards already name them | [frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx](../../frontend/src/features/events/__tests__/RequestCoordinatorNames.test.tsx#L60) |
| AC-017.5.1 | 5 | Integration — Happy path | assignment records in-app notifications and queues email for the new coordinator and organiser | [backend/supabase/tests/coordinator_assignment_notifications.sql](../../backend/supabase/tests/coordinator_assignment_notifications.sql#L46) |
| AC-017.5.2 | 5 | Integration — Happy path / Negative / Regression | reassignment notifies replacement and organiser; no-op and failed attempts create nothing | [backend/supabase/tests/coordinator_assignment_notifications.sql](../../backend/supabase/tests/coordinator_assignment_notifications.sql#L88) |
| AC-017.5.3 | 5 | Integration — Negative | recipients read only their authorised notices; browser writes, settings changes and outbox reads are denied | [backend/supabase/tests/coordinator_assignment_notifications.sql](../../backend/supabase/tests/coordinator_assignment_notifications.sql#L157) |
| AC-017.5.4 | 5 | Integration — Happy path / Boundary | channel settings control future notices without changing previous records | [backend/supabase/tests/coordinator_assignment_notifications.sql](../../backend/supabase/tests/coordinator_assignment_notifications.sql#L219) |
| AC-017.5.5 | 5 | Integration — Happy path / Regression | replay preserves settings and records; subsequent assignments respect saved channels | [backend/supabase/tests/coordinator_assignment_notifications_replay.sql](../../backend/supabase/tests/coordinator_assignment_notifications_replay.sql#L16) |
| AC-017.6.1 | 6 | Integration — Happy path / Negative / Regression | assignment history retains who, from/to and when, excluding failed and unchanged assignments | [backend/supabase/tests/coordinator_assignment.sql](../../backend/supabase/tests/coordinator_assignment.sql#L296) |
