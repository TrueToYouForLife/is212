# US3 — View Event Request Status

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

## Existing cases (14 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-003.1.1 | 1 | Unit — Happy path | includes drafts when listing organiser requests | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L281) |
| AC-003.2.1 | 2 | Unit — Happy path | retrieves the current database status and shared reason on each read | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L289) |
| AC-003.2.2 | 2 | Component — Happy path / Regression | refreshes status periodically and on focus, stopping after unmount | [frontend/src/features/events/status/__tests__/useRequestResource.test.ts](../../frontend/src/features/events/status/__tests__/useRequestResource.test.ts#L7) |
| AC-003.2.3 | 2 | Component — Happy path / Regression | queues manual refresh while an older status read is pending | [frontend/src/features/events/status/__tests__/useRequestResource.test.ts](../../frontend/src/features/events/status/__tests__/useRequestResource.test.ts#L23) |
| AC-003.2.4 | 2 | Component — Negative / Regression | reports network failures and permits retry | [frontend/src/features/events/status/__tests__/useRequestResource.test.ts](../../frontend/src/features/events/status/__tests__/useRequestResource.test.ts#L59) |
| AC-003.3.1 | 3 | Component — Happy path | clearly labels every status, including incomplete drafts | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L27) |
| AC-003.3.2 | 3 | Component — Happy path | explains that approval is not confirmation | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L34) |
| AC-003.4.1 | 4 | Component — Negative | shows the rejection reason | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L43) |
| AC-003.4.2 | 4 | Component — Negative | missing legacy rejection reason has an explicit fallback | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L61) |
| AC-003.5.1 | 5 | Component — Happy path | identifies an outstanding return and clears it after review progresses | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L49) |
| AC-003.6.1 | 6 | Unit — Negative | forbidden and missing requests share the same response | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L309) |
| AC-003.6.2 | 6 | Unit — Negative | malformed IDs return unavailable without querying the database | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L320) |
| AC-003.6.3 | 6 | Component — Happy path | clears previously visible data if access is revoked | [frontend/src/features/events/status/__tests__/useRequestResource.test.ts](../../frontend/src/features/events/status/__tests__/useRequestResource.test.ts#L36) |
| AC-003.6.4 | 6 | Component — Happy path | ignores an old account response after the account changes | [frontend/src/features/events/status/__tests__/useRequestResource.test.ts](../../frontend/src/features/events/status/__tests__/useRequestResource.test.ts#L46) |
