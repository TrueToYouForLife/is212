# US2 — Submit an Event Request

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

## Existing cases (61 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-002.1.1 | 1 | Unit — Happy path | accepts a request with every optional field omitted | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L172) |
| AC-002.1.2 | 1 | Unit — Happy path | captures every optional field when the organiser supplies them | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L186) |
| AC-002.1.3 | 1 | Unit — Happy path | collapses whitespace-only optional fields to null rather than storing blanks | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L213) |
| AC-002.1.4 | 1 | Unit — Happy path | trims surrounding whitespace from the purpose before storing it | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L221) |
| AC-002.1.5 | 1 | Unit — Happy path / Boundary | optional details the organiser omitted are stored as null, not empty strings | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L118) |
| AC-002.1.6 | 1 | Component — Happy path | offers an input for every piece of preliminary information | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L221) |
| AC-002.1.7 | 1 | Unit — Happy path | ticking a box adds its code and unticking removes it | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L10) |
| AC-002.1.8 | 1 | Unit — Happy path | toggling returns a new list rather than editing the old one | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L17) |
| AC-002.1.9 | 1 | Unit — Happy path | two lists holding the same codes are the same requirement | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L24) |
| AC-002.1.10 | 1 | Unit — Happy path | stored codes are read back as labels | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L33) |
| AC-002.1.11 | 1 | Unit — Negative | an unknown code is shown as itself, never silently dropped | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L39) |
| AC-002.1.12 | 1 | Unit — Happy path | no requirement reads as nothing, not as a stray separator | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L46) |
| AC-002.1.13 | 1 | Unit — Happy path | each code list field draws from its own catalogue | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L52) |
| AC-002.1.14 | 1 | Unit — Happy path | the shared accessibility and facility codes are the venue ones | [frontend/src/features/events/__tests__/requirementCatalogue.test.ts](../../frontend/src/features/events/__tests__/requirementCatalogue.test.ts#L62) |
| AC-002.1.15 | 1 | Integration — Happy path | the accessibility and facility catalogues hold the shared codes | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L38) |
| AC-002.1.16 | 1 | Integration — Happy path | every equipment type has a slug code derived from its name | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L44) |
| AC-002.1.17 | 1 | Integration — Negative | an unknown accessibility code is refused | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L51) |
| AC-002.1.18 | 1 | Integration — Negative | one bad code refuses the whole list | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L61) |
| AC-002.1.19 | 1 | Integration — Negative | an unknown equipment code is refused | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L71) |
| AC-002.1.20 | 1 | Integration — Negative | an unknown layout is refused by the foreign key | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L81) |
| AC-002.1.21 | 1 | Integration — Negative | a blank code is refused | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L91) |
| AC-002.1.22 | 1 | Integration — Negative | valid codes are stored and a repeated code is collapsed, not refused | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L112) |
| AC-002.1.23 | 1 | Integration — Happy path / Boundary | a draft that asks for nothing holds empty lists and no layout | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L124) |
| AC-002.1.24 | 1 | Integration — Happy path | authenticated may select the requirement columns | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L131) |
| AC-002.1.25 | 1 | Integration — Happy path | an organiser can read every catalogue the request form offers | [backend/supabase/tests/structured_event_requirements.sql](../../backend/supabase/tests/structured_event_requirements.sql#L143) |
| AC-002.1.26 | 1 | Integration — Happy path / Regression | replaying the requirement migrations changes no stored requirement | [backend/supabase/tests/run_change_request_review.sh](../../backend/supabase/tests/run_change_request_review.sh#L331) |
| AC-002.2.1 | 2 | Unit — Negative | rejects submission when purpose is missing | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L21) |
| AC-002.2.2 | 2 | Unit — Negative | rejects submission when purpose is whitespace only | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L28) |
| AC-002.2.3 | 2 | Unit — Negative | rejects submission when the preferred start date and time is missing | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L35) |
| AC-002.2.4 | 2 | Unit — Negative | rejects submission when the preferred end date and time is missing | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L42) |
| AC-002.2.5 | 2 | Unit — Negative | rejects submission when expected attendance is missing | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L49) |
| AC-002.2.6 | 2 | Unit — Happy path | reports every missing required field at once, not just the first | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L58) |
| AC-002.2.7 | 2 | Unit — Negative / Boundary | rejects an expected attendance of 0 (lower boundary, invalid) | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L72) |
| AC-002.2.8 | 2 | Unit — Negative | rejects a negative expected attendance of -1 | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L81) |
| AC-002.2.9 | 2 | Unit — Happy path / Boundary | accepts an expected attendance of 1 (lower boundary, valid) | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L90) |
| AC-002.2.10 | 2 | Unit — Negative | rejects a non-numeric expected attendance | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L97) |
| AC-002.2.11 | 2 | Unit — Negative | rejects a fractional expected attendance | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L106) |
| AC-002.2.12 | 2 | Unit — Negative | rejects an end date and time before the start | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L115) |
| AC-002.2.13 | 2 | Unit — Negative / Boundary | rejects a zero-length event where end equals start (boundary) | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L125) |
| AC-002.2.14 | 2 | Unit — Negative | rejects a proposed start date in the past | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L135) |
| AC-002.2.15 | 2 | Unit — Negative | rejects an unparseable date | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L145) |
| AC-002.2.16 | 2 | Unit — Negative / Boundary | rejects a proposed start exactly equal to now (boundary) | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L152) |
| AC-002.2.17 | 2 | Unit — Happy path | accepts an end date one second after start (smallest valid duration) | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L162) |
| AC-002.2.18 | 2 | Unit — Negative | rejects the un-touched form default (same start/end, both dated in the past) | [frontend/src/features/events/__tests__/validation.test.ts](../../frontend/src/features/events/__tests__/validation.test.ts#L230) |
| AC-002.2.19 | 2 | Component — Happy path | does not submit when a required field is missing, and says which | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L257) |
| AC-002.3.1 | 3 | Component — Happy path | informs the organiser of a successful submission and its reference | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L266) |
| AC-002.3.2 | 3 | Component — Happy path | clears the form after a successful submission so the next request starts clean | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L277) |
| AC-002.4.1 | 4 | Unit — Negative | an invalid request is rejected with the failing rule, not a generic message | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L133) |
| AC-002.4.2 | 4 | Unit — Happy path | a submission without a signed-in user explains that sign-in is required | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L145) |
| AC-002.4.3 | 4 | Unit — Negative | a row-level-security refusal is reported as a permission problem | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L155) |
| AC-002.4.4 | 4 | Unit — Happy path | a database CHECK violation is reported without leaking the constraint name | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L163) |
| AC-002.4.5 | 4 | Unit — Happy path / Regression | a unique-reference collision is reported so the organiser can retry | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L175) |
| AC-002.4.6 | 4 | Unit — Happy path | a missing organiser profile is reported as a profile problem | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L186) |
| AC-002.4.7 | 4 | Unit — Negative | an unrecognised database error gives advice, not raw Postgres text | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L194) |
| AC-002.4.8 | 4 | Unit — Negative | never throws, even given a malformed payload | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L208) |
| AC-002.4.9 | 4 | Component — Negative | informs the organiser of a failed submission with the reason | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L290) |
| AC-002.5.1 | 5 | Unit — Happy path | a successful submission returns a unique reference in EVT-YYYY-NNNN form | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L216) |
| AC-002.5.2 | 5 | Unit — Happy path | a successful submission is stored with status "Submitted" | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L224) |
| AC-002.5.3 | 5 | Unit — Negative | the client sends status submitted but never a reference of its own | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L234) |
| AC-002.5.4 | 5 | Unit — Happy path / Regression | the request is filed against the signed-in organiser | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L243) |
| AC-002.5.5 | 5 | Unit — Negative | a saved row that came back without a reference is treated as a failure | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L251) |
