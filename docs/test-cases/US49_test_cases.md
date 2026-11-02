# US49 — Multiple venues per event

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

Related implementation notes: [us49-slice1.md](../us49-slice1.md), [us49-slice2.md](../us49-slice2.md), [us49-slice3.md](../us49-slice3.md).

## Existing cases (68 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-049.1.1 | 1 | Integration — Happy path / Boundary | one event can hold two different venues simultaneously | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L22) |
| AC-049.1.2 | 1 | Integration — Negative / Regression | refused third bookings preserve the two existing bookings | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L34) |
| AC-049.1.3 | 1 | Integration — Negative | Venue Staff cannot create coordinator holds | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L42) |
| AC-049.2.1 | 2 | Integration — Happy path / Regression | each space retains its own layout and attendance instead of whole-event attendance | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L25) |
| AC-049.2.2 | 2 | Integration — Negative | unavailable layouts and nonpositive attendance cannot create bookings | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L30) |
| AC-049.2.3 | 2 | Integration — Negative | browser writes cannot rewrite the checked requirements | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L36) |
| AC-049.2.4 | 2 | Integration — Happy path | Venue Staff review the attendance for this booking | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L40) |
| AC-049.2.5 | 2 | Integration — Happy path / Regression | replay preserves all legacy and new booking requirements | [backend/supabase/tests/run_venue_time_conversion.sh](../../backend/supabase/tests/run_venue_time_conversion.sh#L108) |
| AC-049.2.6 | 2 | Integration — Negative | direct browser inserts cannot bypass checked requirements | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L77) |
| AC-049.2.7 | 2 | Integration — Happy path / Regression | adding requirement columns preserves existing pending replacement consent versions | [backend/supabase/tests/run_venue_time_conversion.sh](../../backend/supabase/tests/run_venue_time_conversion.sh#L100) |
| AC-049.2.30 | 2 | Component — Happy path | layout and people can be recorded independently for a space | [frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx](../../frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx#L13) |
| AC-049.2.31 | 2 | Unit — Negative | blank layout and nonpositive or fractional attendance are invalid | [frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx](../../frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx#L24) |
| AC-049.2.32 | 2 | Unit — Happy path | explicit space requirements reach the checked booking RPC | [frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L19) |
| AC-049.2.33 | 2 | Unit — Negative | invalid space requirements do not send a booking request | [frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L29) |
| AC-049.3.1 | 3 | Integration — Negative | capacity is checked independently and one person above capacity is refused | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L27) |
| AC-049.3.2 | 3 | Integration — Negative | another event cannot occupy an existing space reservation | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L32) |
| AC-049.3.3 | 3 | Integration — Happy path | each booking reserves its own setup and turnaround | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L47) |
| AC-049.3.4 | 3 | Integration — Negative | missing event facilities refuse a space before reservation | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L53) |
| AC-049.3.5 | 3 | Integration — Happy path | approving a suitable space does not use event-wide attendance or decide another booking | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L62) |
| AC-049.3.6 | 3 | Integration — Happy path / Regression | reduced layout capacity is checked again at approval | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L66) |
| AC-049.3.7 | 3 | Integration — Happy path | venue edit review uses the affected booking attendance | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L71) |
| AC-049.3.8 | 3 | Integration — Negative | legacy hold API cannot bypass suitability checks | [backend/supabase/tests/multi_venue_requirements.sql](../../backend/supabase/tests/multi_venue_requirements.sql#L75) |
| AC-049.3.30 | 3 | Component — Negative | layout load failure is visible and disables requirements input | [frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx](../../frontend/src/features/venues/__tests__/BookingSpaceFields.test.tsx#L19) |
| AC-049.3.31 | 3 | Unit — Happy path | unsuitable spaces return the server explanation without claiming success | [frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L24) |
| AC-049.4.1 | 4 | Integration — Happy path / Regression | approving one booking leaves its sibling record unchanged | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L22) |
| AC-049.4.2 | 4 | Integration — Negative / Regression | rejection preserves approved sibling records and their occupied slots | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L36) |
| AC-049.4.3 | 4 | Integration — Negative | rejecting one booking releases only its own occupied cells | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L38) |
| AC-049.5.1 | 5 | Integration — Happy path | assigned coordinator sees both bookings for the event | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L14) |
| AC-049.5.2 | 5 | Integration — Negative | staff cannot use the coordinator-only event summary | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L19) |
| AC-049.5.3 | 5 | Integration — Negative | rejection stays visible with reason and suggested alternative | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L44) |
| AC-049.5.4 | 5 | Integration — Happy path / Regression | reassignment immediately removes the former coordinator summary access | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L60) |
| AC-049.5.30 | 5 | Component — Negative | every booking status is visible with per-space requirements and rejection details | [frontend/src/features/events/__tests__/EventVenueBookings.test.tsx](../../frontend/src/features/events/__tests__/EventVenueBookings.test.tsx#L12) |
| AC-049.5.31 | 5 | Component — Happy path / Negative / Regression | failed refresh removes stale status and successful retry shows the decision | [frontend/src/features/events/__tests__/EventVenueBookings.test.tsx](../../frontend/src/features/events/__tests__/EventVenueBookings.test.tsx#L23) |
| AC-049.5.32 | 5 | Component — Happy path / Boundary | empty event, legacy requirements and event change do not reuse old bookings | [frontend/src/features/events/__tests__/EventVenueBookings.test.tsx](../../frontend/src/features/events/__tests__/EventVenueBookings.test.tsx#L35) |
| AC-049.5.33 | 5 | Unit — Happy path / Boundary | event summary calls the checked RPC and accepts an empty list | [frontend/src/features/events/__tests__/eventVenueBookingsService.test.ts](../../frontend/src/features/events/__tests__/eventVenueBookingsService.test.ts#L5) |
| AC-049.5.34 | 5 | Unit — Negative / Boundary | denied, malformed, null and network responses never become an empty success | [frontend/src/features/events/__tests__/eventVenueBookingsService.test.ts](../../frontend/src/features/events/__tests__/eventVenueBookingsService.test.ts#L10) |
| AC-049.6.1 | 6 | Integration — Happy path | one approved and one pending venue remain incomplete | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L12) |
| AC-049.6.2 | 6 | Integration — Happy path | no bookings is incomplete rather than vacuously approved | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L16) |
| AC-049.6.3 | 6 | Integration — Happy path | all required bookings approved is complete | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L25) |
| AC-049.6.4 | 6 | Integration — Happy path | adding a live hold makes previously complete venues outstanding | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L28) |
| AC-049.6.5 | 6 | Integration — Negative | rejection remains outstanding even when other venues are approved | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L41) |
| AC-049.6.6 | 6 | Integration — Happy path | explicitly cancelled requirement no longer blocks readiness but remains visible | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L52) |
| AC-049.6.7 | 6 | Integration — Happy path | venue completion does not mark another arrangement complete | [backend/supabase/tests/multi_venue_readiness.sql](../../backend/supabase/tests/multi_venue_readiness.sql#L54) |
| AC-049.7.1 | 7 | Integration — Negative | blank cancellation reason is refused | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L15) |
| AC-049.7.2 | 7 | Integration — Negative | stale consent cannot cancel a booking | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L17) |
| AC-049.7.3 | 7 | Integration — Negative | direct browser cancellation cannot bypass the checked action | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L19) |
| AC-049.7.4 | 7 | Integration — Negative | Venue Staff cannot perform the assigned Coordinator action | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L22) |
| AC-049.7.5 | 7 | Integration — Happy path | approved booking cancellation frees event, setup and turnaround claims | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L32) |
| AC-049.7.6 | 7 | Integration — Negative | rejected booking can be cancelled without erasing the rejection history | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L81) |
| AC-049.7.7 | 7 | Integration — Negative | downstream notification failure refuses cancellation | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L48) |
| AC-049.7.8 | 7 | Integration — Negative | cancelling rejected requirement clears readiness when remaining bookings are approved | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L77) |
| AC-049.7.9 | 7 | Integration — Negative / Boundary | concurrent approval cannot overwrite cancellation or recreate claims | [backend/supabase/tests/individual_venue_cancellation_races.sh](../../backend/supabase/tests/individual_venue_cancellation_races.sh#L40) |
| AC-049.7.30 | 7 | Component — Happy path | cancellation requires a reason and uses the displayed version for the selected booking | [frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx](../../frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx#L12) |
| AC-049.7.31 | 7 | Component — Negative / Regression | failure preserves the reason and requires reload before retrying with fresh consent | [frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx](../../frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx#L22) |
| AC-049.7.32 | 7 | Component — Negative | failed context read offers reload without exposing a cancellation action | [frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx](../../frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx#L42) |
| AC-049.7.33 | 7 | Unit — Happy path / Boundary | blank reason performs no request and valid reason sends exact booking and consent version | [frontend/src/features/venues/__tests__/venueCancellationService.test.ts](../../frontend/src/features/venues/__tests__/venueCancellationService.test.ts#L5) |
| AC-049.7.34 | 7 | Unit — Negative | malformed, refused and network results fail closed | [frontend/src/features/venues/__tests__/venueCancellationService.test.ts](../../frontend/src/features/venues/__tests__/venueCancellationService.test.ts#L13) |
| AC-049.7.35 | 7 | Component — Negative / Regression | a pending request uses reasoned cancellation and cannot be submitted again | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L264) |
| AC-049.7.36 | 7 | Component — Negative / Regression | a rejected request retains its note and offers explicit cancellation | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L278) |
| AC-049.8.1 | 8 | Integration — Happy path / Regression | cancelling one space preserves sibling bookings and reservations | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L36) |
| AC-049.8.2 | 8 | Integration — Happy path / Regression | cancelling every booking leaves all event columns unchanged | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L67) |
| AC-049.8.3 | 8 | Integration — Negative / Regression | failed transaction restores booking, claims and audit completely | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L54) |
| AC-049.9.1 | 9 | Integration — Happy path | cancellation records trimmed reason, actual actor and server time | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L27) |
| AC-049.9.2 | 9 | Integration — Negative / Boundary / Regression | retry cannot duplicate a cancellation | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L29) |
| AC-049.9.3 | 9 | Integration — Happy path | Venue Staff receive in-app and queued email cancellation notices through the shared helper | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L40) |
| AC-049.9.4 | 9 | Integration — Happy path / Boundary | each successful cancellation has exactly one immutable audit record | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L83) |
| AC-049.9.5 | 9 | Integration — Happy path | staff channel preferences suppress future cancellation notices | [backend/supabase/tests/individual_venue_cancellation.sql](../../backend/supabase/tests/individual_venue_cancellation.sql#L64) |
| AC-049.9.30 | 9 | Component — Happy path | recorded cancellation shows its actor, reason and Singapore time | [frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx](../../frontend/src/features/venues/__tests__/VenueCancellationPanel.test.tsx#L36) |
