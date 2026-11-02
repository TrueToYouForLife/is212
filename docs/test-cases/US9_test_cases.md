# US9 — Submit Venue Booking Request

Catalogue checked: 2 November 2026.

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

Historical labels refer to the original hold/booking rules. US49's multiple-booking
requirements and US47's quarter-hour buffers are documented under their own IDs; this
catalogue does not reinstate the old one-hold-per-event or AM/PM/Night rules. In particular,
a source ID here is not proof that every current Jira AC has a separate implementation.

## Existing cases (93 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-009.1.1 | 1 | Unit — Happy path | approved is bookable; planning is bookable | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L12) |
| AC-009.1.2 | 1 | Unit — Negative | Every non-bookable event status in the parameter table is refused by hold rules. | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L16) |
| AC-009.1.3 | 1 | Unit — Happy path | a missing status (null) is not bookable; a missing status (undefined) is not bookable; a missing status () is not bookable | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L20) |
| AC-009.1.4 | 1 | Unit — Happy path / Boundary | the bookable list is exactly approved and planning | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L23) |
| AC-009.1.5 | 1 | Unit — Negative | an active hold is held or pending_approval only, never confirmed | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L29) |
| AC-009.1.15 | 1 | Unit — Happy path | returns one venue, normalising a null accessibility, facility or location | [frontend/src/features/venues/__tests__/venueTimetableService.test.ts](../../frontend/src/features/venues/__tests__/venueTimetableService.test.ts#L28) |
| AC-009.1.16 | 1 | Unit — Happy path / Boundary | a venue that does not exist is reported, not returned as empty | [frontend/src/features/venues/__tests__/venueTimetableService.test.ts](../../frontend/src/features/venues/__tests__/venueTimetableService.test.ts#L36) |
| AC-009.1.17 | 1 | Unit — Negative | a failed lookup is reported and logged | [frontend/src/features/venues/__tests__/venueTimetableService.test.ts](../../frontend/src/features/venues/__tests__/venueTimetableService.test.ts#L40) |
| AC-009.1.18 | 1 | Unit — Happy path | a signed-out user reads nothing, and nothing is queried | [frontend/src/features/venues/__tests__/venueTimetableService.test.ts](../../frontend/src/features/venues/__tests__/venueTimetableService.test.ts#L45) |
| AC-009.1.19 | 1 | Component — Happy path | shows the venue’s characteristics, with facility counts spelled out | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L107) |
| AC-009.1.20 | 1 | Component — Happy path | offers a way through to the timetable | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L115) |
| AC-009.1.21 | 1 | Component — Happy path | the event being searched for is carried through to the timetable | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L120) |
| AC-009.1.22 | 1 | Component — Happy path | a venue under maintenance is flagged before a coordinator plans around it | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L125) |
| AC-009.1.23 | 1 | Component — Negative | a venue that cannot be loaded shows why, with a way back | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L130) |
| AC-009.1.24 | 1 | Component — Negative | a non-coordinator sees nothing and the venue is never fetched | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L136) |
| AC-009.1.25 | 1 | Component — Negative | a non-coordinator cannot reach the booking controls | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L200) |
| AC-009.2.1 | 2 | Unit — Happy path | a morning event consumes 09:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L19) |
| AC-009.2.2 | 2 | Unit — Happy path | an afternoon event consumes 14:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L20) |
| AC-009.2.3 | 2 | Unit — Happy path | an evening event consumes 20:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L21) |
| AC-009.2.4 | 2 | Unit — Happy path | consecutive AM+PM consumes 09:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L22) |
| AC-009.2.5 | 2 | Unit — Happy path | consecutive PM+Night consumes 14:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L23) |
| AC-009.2.6 | 2 | Unit — Happy path / Boundary | a full day consumes 08:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L24) |
| AC-009.2.7 | 2 | Unit — Happy path | part of AM and part of PM consumes 11:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L25) |
| AC-009.2.8 | 2 | Unit — Happy path / Boundary | an event ending exactly at noon consumes 07:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L26) |
| AC-009.2.9 | 2 | Unit — Happy path / Boundary | an event starting exactly at 1pm consumes 13:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L27) |
| AC-009.2.10 | 2 | Unit — Happy path | an event running across days consumes every slot it touches | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L32) |
| AC-009.2.11 | 2 | Unit — Happy path | an event falling between slots consumes nothing | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L38) |
| AC-009.2.12 | 2 | Unit — Happy path | slots are returned in time order even when defined out of order | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L42) |
| AC-009.2.13 | 2 | Unit — Happy path | a date and slot code become that slot’s real start and end instants | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L103) |
| AC-009.2.14 | 2 | Unit — Negative | an unknown slot code is rejected rather than silently skipped | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L108) |
| AC-009.2.15 | 2 | Unit — Happy path / Boundary | datesFrom walks consecutive days across a month boundary | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L111) |
| AC-009.2.23 | 2 | Component — Happy path | an event outside every slot says so instead of listing nothing | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L24) |
| AC-009.2.24 | 2 | Component — Happy path | choosing an event highlights the slots it would take, including setup and turnaround | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L153) |
| AC-009.4.1 | 4 | Unit — Happy path | a live hold of the coordinator’s own moves to pending_approval | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L37) |
| AC-009.4.2 | 4 | Unit — Negative / Boundary | a hold that expired, was released, or belongs to someone else is refused | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L52) |
| AC-009.4.3 | 4 | Unit — Negative | a signed-out user cannot submit, and nothing is queried | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L56) |
| AC-009.4.4 | 4 | Unit — Negative | an RLS refusal is reported | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L61) |
| AC-009.5.1 | 5 | Unit — Happy path | after NIGHT comes the next day’s AM | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L52) |
| AC-009.5.2 | 5 | Unit — Happy path | before AM comes the previous day’s NIGHT | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L55) |
| AC-009.5.3 | 5 | Unit — Happy path / Boundary | adjacency crosses a month boundary | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L58) |
| AC-009.5.4 | 5 | Unit — Happy path / Boundary | adjacency crosses a year boundary | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L61) |
| AC-009.5.5 | 5 | Unit — Happy path | within a day, adjacency is simply the neighbouring slot | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L64) |
| AC-009.5.6 | 5 | Unit — Happy path | a AM booking also holds 09:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L72) |
| AC-009.5.7 | 5 | Unit — Happy path | a PM booking also holds 14:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L73) |
| AC-009.5.8 | 5 | Unit — Happy path | a Night booking also holds 20:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L74) |
| AC-009.5.9 | 5 | Unit — Happy path | a AM+PM booking also holds 09:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L75) |
| AC-009.5.10 | 5 | Unit — Happy path / Boundary | a a full day booking also holds 08:00 | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L76) |
| AC-009.5.11 | 5 | Unit — Happy path | a multi-slot booking gets no buffer between its own slots | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L81) |
| AC-009.5.12 | 5 | Unit — Happy path | a multi-day booking is buffered only at its outer ends | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L90) |
| AC-009.5.13 | 5 | Unit — Happy path | an event outside every slot claims nothing at all, not even buffers | [frontend/src/features/venues/__tests__/slots.test.ts](../../frontend/src/features/venues/__tests__/slots.test.ts#L95) |
| AC-009.5.16 | 5 | Component — Happy path | shows each slot and marks which are setup or turnaround | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L17) |
| AC-009.5.17 | 5 | Component — Happy path | the cells a pending selection would take are ringed | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L75) |
| AC-009.7.1 | 7 | Unit — Happy path | a event clash is explained as “already booked” | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L65) |
| AC-009.7.2 | 7 | Unit — Happy path | a buffer clash is explained as “the setup or turnaround slot of another booking” | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L66) |
| AC-009.7.3 | 7 | Unit — Happy path | a maintenance clash is explained as “blocked by Venue Staff” | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L67) |
| AC-009.7.4 | 7 | Unit — Happy path | several clashes are listed together | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L74) |
| AC-009.7.5 | 7 | Unit — Happy path | no clashes produces no text to append | [frontend/src/features/venues/__tests__/holdRules.test.ts](../../frontend/src/features/venues/__tests__/holdRules.test.ts#L83) |
| AC-009.7.11 | 7 | Component — Negative | a refused hold shows which slot clashes and why | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L178) |
| AC-009.8.1 | 8 | Unit — Happy path | submitting a request writes no notification itself, leaving the trigger to do it | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L171) |
| AC-009.8.2 | 8 | Unit — Negative | the submission sends only the status, so it cannot name its own recipient | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L182) |
| AC-009.8.3 | 8 | Unit — Negative | a refused submission touches nothing, so no notification can be orphaned | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L194) |
| AC-009.8.4 | 8 | Integration — Happy path | holding a venue notifies nobody — a hold is not yet a request to review | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L63) |
| AC-009.8.5 | 8 | Integration — Happy path | submitting a request notifies every Venue Staff member, one row each | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L73) |
| AC-009.8.6 | 8 | Integration — Happy path | the notification carries the booking's venue and starts unread | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L82) |
| AC-009.8.7 | 8 | Integration — Happy path | no one outside Venue Staff is made a recipient | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L89) |
| AC-009.8.8 | 8 | Integration — Happy path | a request inserted directly as pending_approval is notified too, not only an update | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L101) |
| AC-009.8.9 | 8 | Integration — Happy path | a status change other than pending_approval notifies nobody | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L110) |
| AC-009.8.10 | 8 | Integration — Happy path | re-saving a request already under review creates no second notification | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L124) |
| AC-009.8.11 | 8 | Integration — Negative / Boundary | the unique index refuses a duplicate notification for the same recipient | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L131) |
| AC-009.8.12 | 8 | Integration — Happy path | a Venue Staff member reads the notification addressed to them | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L140) |
| AC-009.8.13 | 8 | Integration — Negative | one Venue Staff member cannot read another's notifications | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L145) |
| AC-009.8.14 | 8 | Integration — Negative | a coordinator cannot read Venue Staff notifications | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L150) |
| AC-009.8.15 | 8 | Integration — Negative | a signed-in Venue Staff member cannot insert a notification | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L160) |
| AC-009.8.16 | 8 | Integration — Negative | a notification cannot be deleted from the browser, only marked read | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L166) |
| AC-009.8.17 | 8 | Integration — Happy path | a Venue Staff member can mark their own notification read | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L177) |
| AC-009.8.18 | 8 | Integration — Happy path | deleting a booking removes its notifications | [backend/supabase/tests/venue_booking_request_notifications.sql](../../backend/supabase/tests/venue_booking_request_notifications.sql#L188) |
| AC-009.9.1 | 9 | Unit — Happy path | lists the coordinator’s own bookings with venue, event, status and slots | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L112) |
| AC-009.9.2 | 9 | Unit — Happy path | only this coordinator’s bookings are requested, newest first | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L124) |
| AC-009.9.3 | 9 | Unit — Negative | a rejected request shows the Venue Staff note | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L131) |
| AC-009.9.4 | 9 | Unit — Negative / Boundary | a failed load is reported, never shown as an empty list, and is logged | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L142) |
| AC-009.9.5 | 9 | Unit — Negative | an assigned booking whose venue cannot be read still appears | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L147) |
| AC-009.9.6 | 9 | Unit — Happy path | a signed-out user sees nothing, and nothing is queried | [frontend/src/features/venues/__tests__/venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L153) |
| AC-009.9.7 | 9 | Component — Happy path | held reads as “Tentatively held” | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L32) |
| AC-009.9.8 | 9 | Component — Happy path | pending_approval reads as “Awaiting Venue Staff” | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L33) |
| AC-009.9.9 | 9 | Component — Happy path | confirmed reads as “Confirmed” | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L34) |
| AC-009.9.10 | 9 | Component — Negative | rejected reads as “Rejected” | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L35) |
| AC-009.9.11 | 9 | Component — Happy path | cancelled reads as “Released” | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L36) |
| AC-009.9.12 | 9 | Component — Happy path / Boundary | expired reads as “Expired” | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L37) |
| AC-009.9.13 | 9 | Component — Happy path | lists each request with its venue, event, status and slots | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L220) |
| AC-009.9.14 | 9 | Component — Negative / Regression | a pending request uses reasoned cancellation and cannot be submitted again | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L264) |
| AC-009.9.15 | 9 | Component — Negative / Regression | a rejected request retains its note and offers explicit cancellation | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L278) |
| AC-009.9.16 | 9 | Component — Negative | having held nothing yet reads as an invitation, not an error | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L288) |
| AC-009.9.17 | 9 | Component — Negative / Boundary | a failed load is reported, never shown as an empty list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L292) |
