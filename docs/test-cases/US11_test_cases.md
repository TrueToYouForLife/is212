# US11 — Place Tentative Hold on Venue

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

## Existing cases (15 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-011.1.1 | 1 | Component — Happy path | holding sends the event and venue, and no slots, because the event decides them | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L187) |
| AC-011.1.2 | 1 | Component — Happy path / Boundary | a successful hold confirms, says when it expires, and reloads the calendar | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L194) |
| AC-011.1.3 | 1 | Component — Happy path | with no event chosen there is nothing to hold | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L214) |
| AC-011.5.14 | 5 | Component — Happy path | draws one column per date and one row per display section | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L52) |
| AC-011.5.15 | 5 | Component — Happy path | a held slot reads as "Tentatively held", its buffer says so too | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L58) |
| AC-011.5.16 | 5 | Component — Happy path | a free slot reads as available | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L63) |
| AC-011.5.17 | 5 | Component — Happy path | each cell is announced with its date, slot and state | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L67) |
| AC-011.5.18 | 5 | Component — Happy path | an occupied cell shows whose event holds it | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L71) |
| AC-011.5.19 | 5 | Component — Happy path | draws the venue’s calendar for the coming week | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L173) |
| AC-011.5.20 | 5 | Component — Negative | a calendar that cannot be loaded says so rather than showing a free week | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L219) |
| AC-011.6.12 | 6 | Component — Happy path / Boundary | a live hold says how long is left before it expires | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L260) |
| AC-011.6.13 | 6 | Component — Negative | a hold whose time has run out says so and cannot be submitted | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L265) |
| AC-011.7.2 | 7 | Component — Happy path | submitting a live hold sends it for review and reloads the list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L273) |
| AC-011.8.9 | 8 | Component — Happy path | releasing a hold frees it and reloads the list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L281) |
| AC-011.8.10 | 8 | Component — Negative | a refused release says why instead of failing silently | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L289) |


## Coverage follow-up ? 4 November 2026

The following existing regression tests now have individual AC IDs, including parameter cases. This change labels tests; it does not add production behaviour or claim manual acceptance.

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-011.8.11 | 8 | Unit ? Negative / Regression | a failure releasing slot claims is reported after cancellation, not as success | [venueBookingService.test.ts](../../frontend/src/features/venues/__tests__/venueBookingService.test.ts#L22) |
| AC-011.1.4 | 1 | Unit ? Negative / Regression | failed and empty slot catalogue reads return no bookable slots | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L39) |
| AC-011.1.5 | 1 | Unit ? Negative / Regression | Missing venue refusal preserves its meaning | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L10) |
| AC-011.1.6 | 1 | Unit ? Negative / Regression | Unexpected server refusal preserves its meaning | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L11) |
| AC-011.1.7 | 1 | Unit ? Negative / Regression | Existing hold refusal preserves its meaning | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L12) |
| AC-011.1.8 | 1 | Unit ? Negative / Regression | Unbookable venue refusal preserves its meaning | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L13) |
| AC-011.1.9 | 1 | Unit ? Negative / Regression | Unbookable event refusal preserves its meaning | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L14) |
| AC-011.1.10 | 1 | Unit ? Negative / Regression | Invalid timing refusal preserves its meaning | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L15) |
| AC-011.1.11 | 1 | Unit ? Negative / Regression | Missing event or venue prevents a hold | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L30) |
| AC-011.1.12 | 1 | Unit ? Negative / Regression | Failed event or venue read prevents a hold | [venueHoldAtomic.test.ts](../../frontend/src/features/venues/__tests__/venueHoldAtomic.test.ts#L30) |
