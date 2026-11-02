# US36 — View coordinator assignments

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

Related implementation notes: [us36-active-events.md](../us36-active-events.md).

## Existing cases (5 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-036.1.1 | 1 | Component — Happy path | overview shows all active events once with coordinator status and Singapore dates, excluding inactive events | [frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx#L35) |
| AC-036.2.1 | 2 | Component — Happy path / Regression | filters combine coordinator and status, handle unassigned and no matches, reset and refresh without changing workloads | [frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx#L66) |
| AC-036.3.1 | 3 | Component — Negative / Boundary | workload summary includes zero assignments and recovers from a failed count read | [frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx#L139) |
| AC-036.4.1 | 4 | Component — Happy path / Regression | Lead can open an event and reassign it with refreshed assignment and workload totals | [frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx#L151) |
| AC-036.5.1 | 5 | Component — Happy path | only Coordinator Lead sees the overview and requests coordinator workloads | [frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx#L175) |
