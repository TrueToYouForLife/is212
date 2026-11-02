# US8 — Search and filter venues

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

Related implementation notes: [us8-merge-runbook.md](../us8-merge-runbook.md), [us8-structured-requirements.md](../us8-structured-requirements.md).

## Existing cases (34 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-008.1.1 | 1 | Unit — Negative | a signed-out caller is refused before any query runs | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L73) |
| AC-008.2.1 | 2 | Unit — Happy path | "Main Hall" is found by "main hall" | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L20) |
| AC-008.2.2 | 2 | Unit — Happy path | "Main Hall" is found by "MAIN HALL" | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L21) |
| AC-008.2.3 | 2 | Unit — Happy path | "Main Hall" is found by "  main   hall  " | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L22) |
| AC-008.2.4 | 2 | Unit — Happy path | "Level 2" is found by "level 2." | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L23) |
| AC-008.2.5 | 2 | Unit — Happy path | "Hall A" is found by "halla" | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L24) |
| AC-008.2.6 | 2 | Unit — Happy path | a filter made only of spaces or punctuation matches everything | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L29) |
| AC-008.2.7 | 2 | Unit — Happy path | "name or location" matches when either one does | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L36) |
| AC-008.2.8 | 2 | Unit — Happy path | an accented character matches its unaccented spelling | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L42) |
| AC-008.2.9 | 2 | Unit — Happy path | reduction keeps letters and digits only | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L46) |
| AC-008.2.10 | 2 | Unit — Happy path | a keyword with different case and a full stop still finds the venue | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L82) |
| AC-008.2.11 | 2 | Unit — Happy path | the keyword matches the location as well as the name | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L93) |
| AC-008.2.12 | 2 | Unit — Happy path | a keyword of only punctuation does not hide every venue | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L104) |
| AC-008.2.13 | 2 | Unit — Happy path | text filters are not sent to the database as ilike patterns | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L112) |
| AC-008.3.1 | 3 | Component — Happy path | the event's layout, accessibility and facilities become the filters | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L51) |
| AC-008.3.2 | 3 | Component — Happy path | the event's date and slot filters are cleared, since the event sets them | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L68) |
| AC-008.3.3 | 3 | Component — Happy path | the applied requirements are copied, not shared with the event | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L76) |
| AC-008.3.4 | 3 | Component — Happy path | going back to a manual search only clears the event | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L87) |
| AC-008.3.5 | 3 | Component — Happy path | the coordinator is told the requirements were applied and can be widened | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L100) |
| AC-008.3.6 | 3 | Component — Happy path | equipment is shown as reserved separately, not applied as a filter | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L106) |
| AC-008.3.7 | 3 | Component — Happy path | every layout in the catalogue is offered, plus "any layout" | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L116) |
| AC-008.3.8 | 3 | Component — Happy path | choosing a layout sets its code, not its label | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L125) |
| AC-008.3.9 | 3 | Component — Happy path | a layout the catalogue no longer lists stays selectable | [frontend/src/features/venues/__tests__/VenueFilters.test.tsx](../../frontend/src/features/venues/__tests__/VenueFilters.test.tsx#L131) |
| AC-008.3.10 | 3 | Unit — Happy path | the catalogue code u_shape matches the stored value U-shape | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L55) |
| AC-008.3.11 | 3 | Unit — Happy path | the catalogue code hall matches the stored value Hall | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L56) |
| AC-008.3.12 | 3 | Unit — Happy path | the catalogue code theatre matches the stored value theatre | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L57) |
| AC-008.3.13 | 3 | Unit — Happy path | a layout code matches a venue that spells it differently | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L123) |
| AC-008.3.14 | 3 | Unit — Happy path | capacity and accessibility are still narrowed by the database | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L136) |
| AC-008.3.15 | 3 | Unit — Happy path | the requirement columns are read and mapped to code lists | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L147) |
| AC-008.3.16 | 3 | Unit — Happy path / Boundary | a row written before the columns had defaults reads as empty lists | [frontend/src/features/venues/__tests__/venueSearchService.test.ts](../../frontend/src/features/venues/__tests__/venueSearchService.test.ts#L177) |
| AC-008.4.1 | 4 | Unit — Happy path | a term that is genuinely absent still does not match | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L66) |
| AC-008.4.2 | 4 | Unit — Happy path | a missing value matches nothing except a blank term | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L70) |
| AC-008.4.3 | 4 | Unit — Happy path | different layouts still do not match | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L76) |
| AC-008.4.4 | 4 | Unit — Negative | a missing code never matches, not even another missing one | [frontend/src/features/venues/__tests__/searchTextMatch.test.ts](../../frontend/src/features/venues/__tests__/searchTextMatch.test.ts#L80) |
