# US1 — Save Draft Event Request

## Coverage follow-up — 4 November 2026

US1 now has 86 source IDs. This portion strengthens the existing unnamed-draft and
retry assertions and adds AC-001.4.35–37: invalid date input at the form-conversion
boundary, independent restored requirement arrays, and a pending list response from
the previous account. These are two unit cases and one component case; no application
code, database objects or permissions changed.

The full frontend run passed 1,701 tests across 211 files. `draftFormValues.ts` reaches
100% on all four measures; `MyDraftsPage.tsx` reaches 100% branches/functions but retains
its defensive exception line. Four defensive fallbacks remain across the five assigned
US1 files. They are explained with their current contracts in the
[coverage evidence](../test-evidence/us1/draft-coverage/README.md); no synthetic root-level
schema error, null-success collection response or forced service rejection was used
to increase coverage. No manual pass or live database verification is claimed.

## Documentation accuracy review — 2 November 2026

The 83 IDs describe mocked service/pure unit tests and rendered component tests. They
do not independently establish live database permissions. AC-001.5.2–3 exercise create/save
response handling, despite their AC5 allocation; the unavailable existing-draft update
branch is covered by AC-001.4.1. No new manual or automated pass is recorded.

[Review findings and limits](../jaydon-test-documentation-review.md).

Owner: Jaydon. Catalogue checked: 4 November 2026; the review above is historical.

## Scope and evidence

This catalogue maps existing test-source IDs to their AC numbers, assertions and files.
Descriptions follow the current test titles/assertion labels; parameter rows keep their
existing IDs. Counts are unique source IDs, not a count of runtime executions or a new
coverage measurement. Shared cross-story assertions may appear in both relevant catalogues.

The original catalogue was a documentation update; new execution results are recorded
only in dated follow-ups above. Catalogue rows alone do not claim manual acceptance,
deployed migrations or email delivery. Unit tests exercise pure logic or mock
external services; component tests render UI with their source's mocks; SQL/shell
integration tests use the disposable database runners. Existing evidence and historical
checkpoints remain in their original documents. Manual results are valid only where an
actual execution/report is recorded.

## Existing cases (86 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-001.1.1 | 1 | Unit — Happy path | maps every supplied field to the existing database column | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L39) |
| AC-001.1.2 | 1 | Unit — Negative | rejects invalid details before contacting Supabase | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L61) |
| AC-001.1.3 | 1 | Unit — Negative | Refuses saving when there is no signed-in user; no draft insert is attempted. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L71) |
| AC-001.1.4 | 1 | Unit — Negative | Refuses saving when session validation reports an expired session. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L72) |
| AC-001.1.5 | 1 | Unit — Negative | Maps database permission error 42501 to the safe permission message. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L82) |
| AC-001.1.6 | 1 | Unit — Negative | Maps database foreign-key error 23503 to the unknown-organiser message. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L83) |
| AC-001.1.7 | 1 | Unit — Negative | Maps database constraint error 23514 to the invalid-details message. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L84) |
| AC-001.1.8 | 1 | Unit — Negative | Maps an unknown database error to the safe save-failed message. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L85) |
| AC-001.1.9 | 1 | Unit — Negative | handles an authentication network exception | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L91) |
| AC-001.1.10 | 1 | Unit — Negative / Regression | handles a lost save response without retrying the insert | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L97) |
| AC-001.1.11 | 1 | Component — Negative / Regression | shows save errors and preserves entered values | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L92) |
| AC-001.1.12 | 1 | Component — Negative / Regression | an unexpected save exception restores the controls without losing input | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L103) |
| AC-001.2.1 | 2 | Unit — Happy path / Boundary | Accepts an empty draft and normalises omitted fields. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L6) |
| AC-001.2.2 | 2 | Unit — Happy path / Boundary | Trims supplied text and normalises whitespace-only optional inputs as missing. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L16) |
| AC-001.2.3 | 2 | Unit — Happy path | permits only proposedStart to be filled | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L26) |
| AC-001.2.4 | 2 | Unit — Happy path | permits only proposedEnd to be filled | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L27) |
| AC-001.2.5 | 2 | Unit — Negative | rejects invalid supplied proposedStart | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L37) |
| AC-001.2.6 | 2 | Unit — Negative | rejects invalid supplied proposedEnd | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L38) |
| AC-001.2.7 | 2 | Unit — Negative / Boundary | Rejects an end before the supplied start. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L48) |
| AC-001.2.8 | 2 | Unit — Negative / Boundary | Rejects an end exactly equal to the supplied start. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L49) |
| AC-001.2.9 | 2 | Unit — Negative / Boundary | Rejects zero attendance. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L58) |
| AC-001.2.10 | 2 | Unit — Negative / Boundary | Rejects negative attendance. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L59) |
| AC-001.2.11 | 2 | Unit — Negative / Boundary | Rejects fractional attendance. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L60) |
| AC-001.2.12 | 2 | Unit — Negative | Rejects non-numeric attendance text (`many`). | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L61) |
| AC-001.2.13 | 2 | Unit — Negative / Boundary | Rejects infinite attendance. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L62) |
| AC-001.2.14 | 2 | Unit — Negative / Boundary | Rejects NaN attendance. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L63) |
| AC-001.2.15 | 2 | Unit — Negative / Boundary | Rejects attendance above the PostgreSQL integer limit. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L64) |
| AC-001.2.16 | 2 | Unit — Happy path / Boundary | Accepts the minimum positive attendance, one. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L76) |
| AC-001.2.17 | 2 | Unit — Happy path | Accepts numeric attendance with surrounding whitespace and normalises it. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L77) |
| AC-001.2.18 | 2 | Unit — Happy path / Boundary | Accepts the PostgreSQL integer maximum attendance. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L78) |
| AC-001.2.19 | 2 | Unit — Negative | reports multiple invalid fields together | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L86) |
| AC-001.2.20 | 2 | Unit — Happy path / Negative / Boundary | Saving an old-date draft is allowed; submitting it still fails current submission rules. | [frontend/src/features/events/__tests__/draftValidation.test.ts](../../frontend/src/features/events/__tests__/draftValidation.test.ts#L93) |
| AC-001.2.21 | 2 | Unit — Happy path / Boundary | saves an empty request as draft for the signed-in owner (also AC-001.1, AC-001.5) | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L106) |
| AC-001.2.22 | 2 | Component — Negative | clears submission-required errors when saving an incomplete draft | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L115) |
| AC-001.3.1 | 3 | Component — Happy path / Boundary | Missing names use the trimmed purpose or Untitled draft; each link retains its draft ID and Draft label without saving/submitting (also AC-001.4). | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L79) |
| AC-001.3.2 | 3 | Component — Happy path / Boundary | saves an empty draft without submitting and displays Draft status (also AC-001.1, AC-001.2, AC-001.5) | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L127) |
| AC-001.4.1 | 4 | Unit — Negative / Regression | reports an unavailable draft without inserting a replacement (also AC-001.5) | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L125) |
| AC-001.4.2 | 4 | Unit — Negative | a blank existing ID cannot accidentally create a new draft | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L133) |
| AC-001.4.3 | 4 | Unit — Happy path | loads every saved field without writing or submitting (also AC-001.5) | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L45) |
| AC-001.4.4 | 4 | Unit — Happy path | loads an incomplete draft without applying submission validation (also AC-001.2) | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L70) |
| AC-001.4.5 | 4 | Unit — Negative | An absent draft row is unavailable and is not replaced with another record. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L85) |
| AC-001.4.6 | 4 | Unit — Negative | A submitted row is unavailable to the draft editor. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L86) |
| AC-001.4.7 | 4 | Unit — Negative | A draft belonging to another organiser is not returned. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L87) |
| AC-001.4.8 | 4 | Unit — Negative | A row with an unexpected draft ID is not returned. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L88) |
| AC-001.4.9 | 4 | Unit — Negative / Boundary | rejects an empty ID without contacting Supabase | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L96) |
| AC-001.4.10 | 4 | Unit — Negative | A signed-out caller cannot load a draft. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L103) |
| AC-001.4.11 | 4 | Unit — Negative | A session-validation error prevents loading a draft. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L104) |
| AC-001.4.12 | 4 | Unit — Negative | reports a database failure without exposing internal details | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L111) |
| AC-001.4.13 | 4 | Unit — Negative | handles a lost database connection | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L116) |
| AC-001.4.14 | 4 | Unit — Negative | handles an authentication exception without querying events | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L122) |
| AC-001.4.15 | 4 | Unit — Happy path | requests only owned drafts ordered by most recently saved (also AC-001.3) | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L128) |
| AC-001.4.16 | 4 | Unit — Negative | filters mismatched rows without exposing them (also AC-001.3) | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L137) |
| AC-001.4.17 | 4 | Unit — Boundary | An empty owned-draft list returns a successful empty result. | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L142) |
| AC-001.4.18 | 4 | Unit — Negative | signed-out users cannot query drafts | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L147) |
| AC-001.4.19 | 4 | Unit — Negative / Boundary | reports a failed query without pretending the list is empty | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L153) |
| AC-001.4.20 | 4 | Unit — Negative | handles connection exceptions | [frontend/src/features/events/__tests__/eventDraftQueryService.test.ts](../../frontend/src/features/events/__tests__/eventDraftQueryService.test.ts#L158) |
| AC-001.4.21 | 4 | Unit — Happy path / Boundary / Regression | restored dates preserve their instant and precision | [frontend/src/features/events/__tests__/draftFormValues.test.ts](../../frontend/src/features/events/__tests__/draftFormValues.test.ts#L5) |
| AC-001.4.22 | 4 | Unit — Happy path / Boundary | missing dates remain empty (also AC-001.2) | [frontend/src/features/events/__tests__/draftFormValues.test.ts](../../frontend/src/features/events/__tests__/draftFormValues.test.ts#L10) |
| AC-001.4.23 | 4 | Unit — Happy path / Regression | attendance is restored as form text | [frontend/src/features/events/__tests__/draftFormValues.test.ts](../../frontend/src/features/events/__tests__/draftFormValues.test.ts#L15) |
| AC-001.4.24 | 4 | Component — Happy path / Regression | opens a listed draft, restores fields and saves edits to the same ID (also AC-001.3, AC-001.5) | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L97) |
| AC-001.4.25 | 4 | Component — Happy path | an incomplete draft can reopen and save without required fields (also AC-001.2) | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L117) |
| AC-001.4.26 | 4 | Component — Happy path / Boundary | empty state offers a new request | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L128) |
| AC-001.4.27 | 4 | Component — Negative / Regression | A failed list can be retried; success removes the alert, shows the drafts, and never loads an editor, saves or submits. | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L135) |
| AC-001.4.28 | 4 | Component — Negative / Regression | An unavailable draft exposes no form; retry loads the same ID and restores its values, removing the alert without saving/submitting. | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L148) |
| AC-001.4.29 | 4 | Component — Negative | A signed-out visitor cannot load or edit the draft page. | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L162) |
| AC-001.4.30 | 4 | Component — Negative | A Coordinator cannot use the Organiser draft editor. | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L163) |
| AC-001.4.31 | 4 | Component — Boundary | Session loading does not fetch or expose editable draft data. | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L164) |
| AC-001.4.32 | 4 | Component — Boundary / Regression | navigating to another draft ignores an old pending response | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L171) |
| AC-001.4.33 | 4 | Component — Happy path / Regression | switching accounts clears the previous draft before loading again | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L182) |
| AC-001.4.34 | 4 | Component — Happy path | keeps entered values and reuses the saved ID on subsequent saves (also AC-001.5) | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L141) |
| AC-001.4.35 | 4 | Unit — Negative / Boundary | Invalid date strings become empty form inputs while name, purpose and attendance are preserved. This tests the conversion helper, not database acceptance of invalid timestamps. | [frontend/src/features/events/__tests__/draftFormValues.test.ts](../../frontend/src/features/events/__tests__/draftFormValues.test.ts#L22) |
| AC-001.4.36 | 4 | Unit — Happy path / Regression | Restored requirement lists retain their codes and belong to the form; editing them does not mutate the loaded draft. | [frontend/src/features/events/__tests__/draftFormValues.test.ts](../../frontend/src/features/events/__tests__/draftFormValues.test.ts#L32) |
| AC-001.4.37 | 4 | Component — Negative / Regression | After an account switch, the previous account's pending list response cannot replace or expose drafts in the new account's list; no save/submission occurs. | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L194) |
| AC-001.5.1 | 5 | Unit — Happy path | updates only the matching owned draft without changing workflow fields (also AC-001.4) | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L140) |
| AC-001.5.2 | 5 | Unit — Negative | A create/save reply with no row returns saveFailed; this case calls saveEventDraft without an existing ID and does not test the update path. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L156) |
| AC-001.5.3 | 5 | Unit — Negative | A create/save reply containing a submitted row returns saveFailed; this case does not test an update of an existing draft. | [frontend/src/features/events/__tests__/eventDraftService.test.ts](../../frontend/src/features/events/__tests__/eventDraftService.test.ts#L157) |
| AC-001.5.4 | 5 | Component — Boundary | disables editing and both actions while a save is pending | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L159) |
| AC-001.6.1 | 6 | Component — Happy path | direct draft URL can submit the existing request explicitly (also AC-001.4) | [frontend/src/features/events/__tests__/DraftPages.test.tsx](../../frontend/src/features/events/__tests__/DraftPages.test.tsx#L225) |
| AC-001.6.2 | 6 | Component — Happy path | explicit submission uses the saved ID and resets it after success | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L177) |
| AC-001.6.3 | 6 | Component — Negative | a saved incomplete draft still cannot be submitted | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L194) |
| AC-001.6.4 | 6 | Component — Negative / Regression | failed submission preserves the draft ID for further editing | [frontend/src/features/events/__tests__/EventRequestForm.test.tsx](../../frontend/src/features/events/__tests__/EventRequestForm.test.tsx#L204) |
| AC-001.6.5 | 6 | Unit — Happy path | submits the existing owned draft with its latest details in one update | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L74) |
| AC-001.6.6 | 6 | Unit — Negative | refuses a missing, inaccessible or already submitted draft without inserting | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L88) |
| AC-001.6.7 | 6 | Unit — Negative | Incomplete draft submission is refused before any database update. | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L96) |
| AC-001.6.8 | 6 | Unit — Negative | reports a database refusal during draft submission | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L102) |
| AC-001.6.9 | 6 | Unit — Negative | a blank draft ID cannot fall back to creating a second request | [frontend/src/features/events/__tests__/eventService.test.ts](../../frontend/src/features/events/__tests__/eventService.test.ts#L109) |
