# US54 — View an event's registrations

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

## Existing cases (55 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-054.1.1 | 1 | Integration — Happy path | the Organiser sees every registration for their event | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L59) |
| AC-054.1.2 | 1 | Integration — Happy path | each row carries the attendee's name, email, registration date and status | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L68) |
| AC-054.1.3 | 1 | Integration — Negative | authenticated cannot read auth.users directly, so the projection is the only path | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L77) |
| AC-054.1.4 | 1 | Integration — Happy path | the projection withholds the attendee's personal answers | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L87) |
| AC-054.1.5 | 1 | Integration — Happy path / Boundary / Regression | replaying 0094 leaves the list answering exactly as before | [backend/supabase/tests/run_change_request_review.sh](../../backend/supabase/tests/run_change_request_review.sh#L437) |
| AC-054.1.6 | 1 | Unit — Happy path | each row is mapped with name, email, status and registration date | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L48) |
| AC-054.1.7 | 1 | Unit — Negative / Boundary | a read error is reported, not flattened into an empty roll call | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L69) |
| AC-054.1.8 | 1 | Unit — Negative | an id that cannot be a uuid is refused before any query runs | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L77) |
| AC-054.1.9 | 1 | Component — Happy path | the attendee’s name, email and registration date are shown | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L50) |
| AC-054.1.10 | 1 | Component — Negative / Boundary / Regression | a failed read offers a retry rather than an empty event | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L60) |
| AC-054.2.1 | 2 | Integration — Happy path | a withdrawn registration is returned and marked as withdrawn | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L95) |
| AC-054.2.2 | 2 | Integration — Happy path | the active count excludes withdrawn registrations | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L100) |
| AC-054.2.3 | 2 | Integration — Happy path | active registrations are listed before withdrawn ones | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L106) |
| AC-054.2.4 | 2 | Unit — Happy path | a withdrawn row is kept, marked, and left out of the active count | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L85) |
| AC-054.2.5 | 2 | Unit — Happy path / Boundary | an event everyone withdrew from counts zero without being empty | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L98) |
| AC-054.2.6 | 2 | Unit — Happy path / Regression | the order the database returned is preserved | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L110) |
| AC-054.2.7 | 2 | Component — Happy path | the count is of active registrations, with withdrawals listed separately | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L76) |
| AC-054.2.8 | 2 | Component — Happy path | a withdrawn attendee is still listed, and marked | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L87) |
| AC-054.2.9 | 2 | Component — Happy path / Boundary | an event everyone withdrew from reads zero, not empty | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L97) |
| AC-054.2.10 | 2 | Component — Happy path | an event nobody has registered for says so | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L107) |
| AC-054.3.1 | 3 | Integration — Happy path | the assigned Coordinator sees the same list as the Organiser | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L115) |
| AC-054.3.2 | 3 | Integration — Happy path | a Coordinator who is not the assignee sees nothing | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L124) |
| AC-054.4.1 | 4 | Integration / Component — Negative | an Organiser in the same client organisation cannot read the roll call | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L137)<br>[frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L11) |
| AC-054.4.2 | 4 | Integration — Happy path | nobody can change a registration from the browser, colleagues included | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L146) |
| AC-054.4.3 | 4 | Integration — Happy path | an Organiser in another client organisation sees nothing | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L153) |
| AC-054.4.4 | 4 | Integration — Negative | an Attendee registered for the event cannot see the other registrations | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L162) |
| AC-054.4.5 | 4 | Integration — Happy path | that Attendee can still see their own registration, as 0043 intends | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L167) |
| AC-054.4.6 | 4 | Integration — Happy path / Boundary | with nobody signed in the list is empty | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L175) |
| AC-054.4.7 | 4 | Unit — Happy path / Boundary | an event nobody has registered for is an empty success | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L123) |
| AC-054.4.8 | 4 | Unit — Happy path / Boundary | a caller who may not look is told so, not shown an empty event | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L131) |
| AC-054.4.9 | 4 | Unit — Happy path | a populated list costs one call, not two | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L139) |
| AC-054.4.10 | 4 | Unit — Negative | a failed permission check is a load failure, not a refusal | [frontend/src/features/events/__tests__/eventRegistrationsService.test.ts](../../frontend/src/features/events/__tests__/eventRegistrationsService.test.ts#L145) |
| AC-054.4.11 | 4 | Component — Happy path / Regression | someone who may not look is told so, with no retry offered | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L116) |
| AC-054.4.12 | 4 | Component — Happy path | the page asks the database rather than deciding access itself | [frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx](../../frontend/src/features/events/__tests__/EventRegistrationsPage.test.tsx#L126) |
| AC-054.4.13 | 4 | Component — Happy path | a colleague is shown the number and no route into the roll call | [frontend/src/features/events/__tests__/OrganisationEventDetailPage.test.tsx](../../frontend/src/features/events/__tests__/OrganisationEventDetailPage.test.tsx#L135) |
| AC-054.4.14 | 4 | Integration / Unit — Happy path | a colleague learns the number while the roll call stays shut to them | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L133)<br>[frontend/src/features/events/__tests__/registrationCountService.test.ts](../../frontend/src/features/events/__tests__/registrationCountService.test.ts#L9) |
| AC-054.4.15 | 4 | Integration — Happy path | the Organiser's count excludes the withdrawal their list still shows | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L197) |
| AC-054.4.16 | 4 | Integration — Happy path | the assigned Coordinator learns the number too | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L202) |
| AC-054.4.17 | 4 | Integration — Happy path | a Coordinator who is not the assignee learns nothing | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L207) |
| AC-054.4.18 | 4 | Integration — Happy path / Boundary | an Organiser in another client organisation is told nothing, as zero | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L214) |
| AC-054.4.19 | 4 | Integration — Happy path | a registered Attendee does not learn the headcount | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L220) |
| AC-054.4.20 | 4 | Integration — Happy path / Boundary | with nobody signed in the count is zero | [backend/supabase/tests/event_registration_visibility.sql](../../backend/supabase/tests/event_registration_visibility.sql#L226) |
| AC-054.4.21 | 4 | Component — Happy path | the owner is shown the route into the roll call instead | [frontend/src/features/events/__tests__/OrganisationEventDetailPage.test.tsx](../../frontend/src/features/events/__tests__/OrganisationEventDetailPage.test.tsx#L145) |
| AC-054.4.22 | 4 | Component — Happy path | the owner gets both the number and a route into the roll call | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L32) |
| AC-054.4.23 | 4 | Component — Happy path | the count is fetched for the owner too, not only for colleagues | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L44) |
| AC-054.4.24 | 4 | Component — Happy path | a colleague is shown the number and no route into the roll call | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L53) |
| AC-054.4.25 | 4 | Component — Happy path | one registration reads in the singular | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L62) |
| AC-054.4.26 | 4 | Component — Happy path / Boundary | an event nobody has registered for reads as zero | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L69) |
| AC-054.4.27 | 4 | Component — Happy path / Boundary | a count that could not be read says so, not zero | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L79) |
| AC-054.4.28 | 4 | Component — Happy path | a thrown read is reported the same way | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L89) |
| AC-054.4.29 | 4 | Component — Happy path | the count is asked for once, and only for the event shown | [frontend/src/features/events/__tests__/RegistrationsCard.test.tsx](../../frontend/src/features/events/__tests__/RegistrationsCard.test.tsx#L96) |
| AC-054.4.30 | 4 | Unit — Happy path | the count comes back from 0114, keyed on the event | [frontend/src/features/events/__tests__/registrationCountService.test.ts](../../frontend/src/features/events/__tests__/registrationCountService.test.ts#L21) |
| AC-054.4.31 | 4 | Unit — Happy path / Boundary | zero is a real answer, not a missing one | [frontend/src/features/events/__tests__/registrationCountService.test.ts](../../frontend/src/features/events/__tests__/registrationCountService.test.ts#L28) |
| AC-054.4.32 | 4 | Unit — Negative / Boundary | a failed call is reported, not flattened to zero | [frontend/src/features/events/__tests__/registrationCountService.test.ts](../../frontend/src/features/events/__tests__/registrationCountService.test.ts#L36) |
| AC-054.4.33 | 4 | Unit — Happy path / Boundary | a non-numeric answer is treated as zero rather than rendered | [frontend/src/features/events/__tests__/registrationCountService.test.ts](../../frontend/src/features/events/__tests__/registrationCountService.test.ts#L44) |
