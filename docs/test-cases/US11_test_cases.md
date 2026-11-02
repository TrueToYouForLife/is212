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
| AC-011.1.1 | 1 | Component — Happy path | holding sends the event and venue, and no slots, because the event decides them | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L162) |
| AC-011.1.2 | 1 | Component — Happy path / Boundary | a successful hold confirms, says when it expires, and reloads the calendar | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L169) |
| AC-011.1.3 | 1 | Component — Happy path | with no event chosen there is nothing to hold | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L189) |
| AC-011.5.14 | 5 | Component — Happy path | draws one column per date and one row per display section | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L52) |
| AC-011.5.15 | 5 | Component — Happy path | a held slot reads as "Tentatively held", its buffer says so too | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L58) |
| AC-011.5.16 | 5 | Component — Happy path | a free slot reads as available | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L63) |
| AC-011.5.17 | 5 | Component — Happy path | each cell is announced with its date, slot and state | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L67) |
| AC-011.5.18 | 5 | Component — Happy path | an occupied cell shows whose event holds it | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L71) |
| AC-011.5.19 | 5 | Component — Happy path | draws the venue’s calendar for the coming week | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L148) |
| AC-011.5.20 | 5 | Component — Negative | a calendar that cannot be loaded says so rather than showing a free week | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L194) |
| AC-011.6.12 | 6 | Component — Happy path / Boundary | a live hold says how long is left before it expires | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L228) |
| AC-011.6.13 | 6 | Component — Negative | a hold whose time has run out says so and cannot be submitted | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L233) |
| AC-011.7.2 | 7 | Component — Happy path | submitting a live hold sends it for review and reloads the list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L241) |
| AC-011.8.9 | 8 | Component — Happy path | releasing a hold frees it and reloads the list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L249) |
| AC-011.8.10 | 8 | Component — Negative | a refused release says why instead of failing silently | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L257) |
