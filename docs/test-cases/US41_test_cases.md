# US41 — Flag arrangements affected by a significant change

## Documentation accuracy review — 2 November 2026

All 21 existing source IDs remain mapped. Successful preservation checks and valid
rejections are classified separately from refused writes. AC-041.1.3 is still missing:
the replay snapshots are not compared. That test/runner change is the next bounded
portion; no pass is claimed here. Notification assertions establish records, not delivery.

[Review findings and limits](../jaydon-test-documentation-review.md).

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

**Separate follow-up:** `AC-041.1.3` is described as replay preservation in
[the implementation notes](../us41-arrangement-revalidation.md), but no test with that
ID exists in current test sources. The fixture takes replay snapshots without a matching
comparison. It is not counted below, not a pass, and remains in the next verification
portion; this documentation change does not add or remove the test.

Related implementation notes: [us41-arrangement-revalidation.md](../us41-arrangement-revalidation.md).

## Existing cases (21 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-041.1.1 | 1 | Integration — Happy path / Regression | requirement changes create independent review reasons and preserve earlier reasons | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L90) |
| AC-041.1.2 | 1 | Integration — Happy path / Regression | Successful approval and flag resolution leave the fixture booking, slot and allocation snapshots unchanged; this is a regression assertion, not a proof about every possible approval. | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L130) |
| AC-041.1.4 | 1 | Integration — Negative / Regression | failed notification rolls back approved values, request decision, flags and queue | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L155) |
| AC-041.1.5 | 1 | Unit — Happy path / Regression | reads open and resolved flags for the selected event and preserves arrangement identity and reasons | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L13) |
| AC-041.1.6 | 1 | Unit — Negative / Boundary | invalid IDs, database errors, malformed responses and lost connections do not look like an empty review list | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L28) |
| AC-041.1.7 | 1 | Component — Happy path / Regression | groups all reasons by arrangement, identifies venue and equipment and refreshes after review | [frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx](../../frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx#L10) |
| AC-041.1.8 | 1 | Component — Negative / Boundary / Regression | loading, failed read, retry and changed event do not show stale reasons or a false empty state | [frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx](../../frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx#L30) |
| AC-041.1.9 | 1 | Component — Happy path / Regression | only the assigned coordinator sees arrangement reviews and page refresh reloads them | [frontend/src/features/events/__tests__/ChangeRequestReviewPage.test.tsx](../../frontend/src/features/events/__tests__/ChangeRequestReviewPage.test.tsx#L46) |
| AC-041.1.10 | 1 | Unit — Happy path | event detail fetches and maps current assignment for arrangement-review visibility | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L344) |
| AC-041.1.11 | 1 | Unit — Happy path / Negative | list counts distinct arrangements per event and returns errors rather than false zero counts | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L40) |
| AC-041.1.12 | 1 | Component — Negative / Regression | request badges are assigned-only, preserve status, refresh and report failed counts | [frontend/src/features/events/__tests__/ArrangementReviewIndicators.test.tsx](../../frontend/src/features/events/__tests__/ArrangementReviewIndicators.test.tsx#L14) |
| AC-041.2.1 | 2 | Integration — Happy path | date changes check each venue and reserved unit; free new slots require review without a false conflict | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L83) |
| AC-041.3.1 | 3 | Integration — Happy path / Boundary | attendance exactly at layout capacity remains suitable | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L70) |
| AC-041.3.2 | 3 | Integration — Happy path | increased attendance flags only the undersized venue with its layout capacity | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L75) |
| AC-041.3.3 | 3 | Integration — Happy path | successive approvals use the current layout, with later coordinator saves respected | [backend/supabase/tests/arrangement_layout_capacity.sql](../../backend/supabase/tests/arrangement_layout_capacity.sql#L17) |
| AC-041.4.1 | 4 | Integration — Happy path | each reason has one notice addressed to the assigned coordinator with arrangement reference | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L94) |
| AC-041.5.1 | 5 | Integration — Happy path / Regression | ordinary approval, rejected significant changes and unapproved proposals produce no flags | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L67) |
| AC-041.6.1 | 6 | Integration — Negative | only assigned coordinator resolves with a recorded explanation; history cannot be overwritten | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L121) |
| AC-041.6.2 | 6 | Unit — Happy path / Negative / Boundary | resolution validates input, calls the protected RPC and handles refused, stale or uncertain writes | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L56) |
| AC-041.6.3 | 6 | Component — Happy path / Regression | resolves individual reasons using both methods, keeps other reasons open and displays retained history | [frontend/src/features/events/__tests__/ArrangementResolution.test.tsx](../../frontend/src/features/events/__tests__/ArrangementResolution.test.tsx#L14) |
| AC-041.6.4 | 6 | Component — Negative / Boundary / Regression | requires explanation, blocks duplicate submits and preserves input on errors without claiming success | [frontend/src/features/events/__tests__/ArrangementResolution.test.tsx](../../frontend/src/features/events/__tests__/ArrangementResolution.test.tsx#L47) |
