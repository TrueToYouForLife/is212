# US41 — Flag arrangements affected by a significant change

## Arrangement-review API loading fix — 3 November 2026

Explicitly select the original booking relationship after US48 added a replacement
booking FK. The old query reproduces HTTP 300/PGRST201 in a disposable API; the fixed
query and unchanged access restrictions pass. Three HTTP integration cases bring US41
to 25 source IDs. Four browser read-only groups also passed; no resolution writes or
US48 safety-stage workflow are claimed. [Results and limits](../test-evidence/us41/loading-fix/README.md).

## Behavioural runner restoration — 2 November 2026

The ten existing SQL cases in `arrangement_revalidation.sql` and
`arrangement_layout_capacity.sql` now run through `run_arrangement_revalidation.sh`
before the final replay in both existing CI database entry points. Focused current
schema, historical, quarter-hour upgrade and fresh-order gates passed. US41 remains
22 source IDs (eleven SQL, eleven frontend); no new test IDs were added here.

Fixtures use canonical requirement codes/arrays and each gate's real slot calculator.
Legacy bookings retain null per-booking overrides so these cases test event-level
fallback, not additional US49 override scenarios. AC-041.1.4 now also compares exact
event/request/revalidation/flag/notice/outbox snapshots after a forced notice failure.
Three deliberate function faults were detected by unchanged assertions, then rolled
back; the final unmodified suite passed. No product defect was found. One snapshot
key mistake and an initial probe stopped by slot protection were test setup issues.

[Results, failure evidence and limits](../test-evidence/us41/regression/README.md).
No migration, application change, new frontend run or manual pass is claimed.
The sections below retain the earlier review/replay checkpoints and their limits.

## Replay verification follow-up — 2 November 2026

AC-041.1.3 is now implemented and passed after both 0052 and 0053 replay in the
focused current-schema, historical, quarter-hour upgrade and fresh-order gates.
This brings the source inventory to 22 IDs: eleven frontend and eleven SQL.
Only the new replay case is newly verified here; the ten older SQL IDs in
`arrangement_revalidation.sql` and `arrangement_layout_capacity.sql` are not wired
into current runners. Their source mappings remain below without a new pass claim.

Four deliberate data-change probes confirmed that the comparison detects differences;
each rolled back and the final comparison passed. No product defect, frontend run,
manual pass, migration or shared deployment is claimed. Evidence and runner limits:
[populated replay verification](../test-evidence/us41/replay/README.md).

## Prior documentation accuracy review — 2 November 2026

All 21 existing source IDs remain mapped. Successful preservation checks and valid
rejections are classified separately from refused writes. AC-041.1.3 is still missing:
the replay snapshots are not compared. That test/runner change is the next bounded
portion; no pass is claimed here. Notification assertions establish records, not delivery.

[Review findings and limits](../jaydon-test-documentation-review.md).

Owner: Jaydon. Catalogue checked: 3 November 2026.

## Scope and evidence

This catalogue maps existing test-source IDs to their AC numbers, assertions and files.
Descriptions follow the current test titles/assertion labels; parameter rows keep their
existing IDs. Counts are unique source IDs, not a count of runtime executions or a new
coverage measurement. Shared cross-story assertions may appear in both relevant catalogues.

Pass claims are limited to the dated verification sections, not all mapped source IDs.
No new manual acceptance, deployed migrations or email delivery is claimed. Unit tests exercise pure logic or mock
external services; component tests render UI with their source's mocks; SQL/shell
integration tests use the disposable database/API runners. Existing evidence and historical
checkpoints remain in their original documents. Manual results are valid only where an
actual execution/report is recorded.

The earlier fixture's unused snapshots do not establish a replay pass. The new
self-contained replay fixture, comparison and runner now implement AC-041.1.3;
the broader behavioural runner gap remains separate, as described above.

Related implementation notes: [us41-arrangement-revalidation.md](../us41-arrangement-revalidation.md).

## Existing cases (25 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-041.1.1 | 1 | Integration — Happy path / Regression | requirement changes create independent review reasons and preserve earlier reasons | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L92) |
| AC-041.1.2 | 1 | Integration — Happy path / Regression | Successful approval and flag resolution leave the fixture booking, slot and allocation snapshots unchanged; this is a regression assertion, not a proof about every possible approval. | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L132) |
| AC-041.1.3 | 1 | Integration — Regression / Boundary | Replay 0052 and 0053 against populated open/independent reasons and both resolution methods; compare every flag/notification field in both directions, retaining attribution/history and refusing additions or deletions. | [arrangement_review_replay.sql](../../backend/supabase/tests/arrangement_review_replay.sql#L1), [fixture](../../backend/supabase/tests/arrangement_review_replay_fixture.sql), [runner](../../backend/supabase/tests/run_arrangement_review_replay.sh) |
| AC-041.1.4 | 1 | Integration — Negative / Regression | Notification-write failure rolls back exact events, requests, revalidations, review flags, notices and outbox snapshots | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L172) |
| AC-041.1.5 | 1 | Unit — Happy path / Regression | Reads open/resolved flags with the explicit original-booking FK and preserves arrangement identity and reasons | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L13) |
| AC-041.1.6 | 1 | Unit — Negative / Boundary | invalid IDs, database errors, malformed responses and lost connections do not look like an empty review list | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L29) |
| AC-041.1.7 | 1 | Component — Happy path / Regression | groups all reasons by arrangement, identifies venue and equipment and refreshes after review | [frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx](../../frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx#L10) |
| AC-041.1.8 | 1 | Component — Negative / Boundary / Regression | loading, failed read, retry and changed event do not show stale reasons or a false empty state | [frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx](../../frontend/src/features/events/__tests__/ArrangementReviewPanel.test.tsx#L30) |
| AC-041.1.9 | 1 | Component — Happy path / Regression | only the assigned coordinator sees arrangement reviews and page refresh reloads them | [frontend/src/features/events/__tests__/ChangeRequestReviewPage.test.tsx](../../frontend/src/features/events/__tests__/ChangeRequestReviewPage.test.tsx#L46) |
| AC-041.1.10 | 1 | Unit — Happy path | event detail fetches and maps current assignment for arrangement-review visibility | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L344) |
| AC-041.1.11 | 1 | Unit — Happy path / Negative | list counts distinct arrangements per event and returns errors rather than false zero counts | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L41) |
| AC-041.1.12 | 1 | Component — Negative / Regression | request badges are assigned-only, preserve status, refresh and report failed counts | [frontend/src/features/events/__tests__/ArrangementReviewIndicators.test.tsx](../../frontend/src/features/events/__tests__/ArrangementReviewIndicators.test.tsx#L14) |
| AC-041.1.13 | 1 | Integration — Happy path / Regression | API reads open venue reasons, resolved original-venue history and equipment without following the replacement FK | [backend/supabase/tests/arrangement_review_api.mjs](../../backend/supabase/tests/arrangement_review_api.mjs#L52) |
| AC-041.1.14 | 1 | Integration — Boundary / Regression | API returns a real empty list for an assigned event without reviews | [backend/supabase/tests/arrangement_review_api.mjs](../../backend/supabase/tests/arrangement_review_api.mjs#L55) |
| AC-041.1.15 | 1 | Integration — Negative / Regression | Unassigned Coordinator, Venue Staff, Organiser and anonymous cannot read protected reviews | [backend/supabase/tests/arrangement_review_api.mjs](../../backend/supabase/tests/arrangement_review_api.mjs#L61) |
| AC-041.2.1 | 2 | Integration — Happy path | date changes check each venue and reserved unit; free new slots require review without a false conflict | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L85) |
| AC-041.3.1 | 3 | Integration — Happy path / Boundary | attendance exactly at layout capacity remains suitable | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L72) |
| AC-041.3.2 | 3 | Integration — Happy path | increased attendance flags only the undersized venue with its layout capacity | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L77) |
| AC-041.3.3 | 3 | Integration — Happy path | successive approvals use the current layout, with later coordinator saves respected | [backend/supabase/tests/arrangement_layout_capacity.sql](../../backend/supabase/tests/arrangement_layout_capacity.sql#L17) |
| AC-041.4.1 | 4 | Integration — Happy path | each reason has one notice addressed to the assigned coordinator with arrangement reference | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L96) |
| AC-041.5.1 | 5 | Integration — Happy path / Regression | ordinary approval, rejected significant changes and unapproved proposals produce no flags | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L69) |
| AC-041.6.1 | 6 | Integration — Negative | only assigned coordinator resolves with a recorded explanation; history cannot be overwritten | [backend/supabase/tests/arrangement_revalidation.sql](../../backend/supabase/tests/arrangement_revalidation.sql#L123) |
| AC-041.6.2 | 6 | Unit — Happy path / Negative / Boundary | resolution validates input, calls the protected RPC and handles refused, stale or uncertain writes | [frontend/src/features/events/__tests__/arrangementReviewService.test.ts](../../frontend/src/features/events/__tests__/arrangementReviewService.test.ts#L57) |
| AC-041.6.3 | 6 | Component — Happy path / Regression | resolves individual reasons using both methods, keeps other reasons open and displays retained history | [frontend/src/features/events/__tests__/ArrangementResolution.test.tsx](../../frontend/src/features/events/__tests__/ArrangementResolution.test.tsx#L14) |
| AC-041.6.4 | 6 | Component — Negative / Boundary / Regression | requires explanation, blocks duplicate submits and preserves input on errors without claiming success | [frontend/src/features/events/__tests__/ArrangementResolution.test.tsx](../../frontend/src/features/events/__tests__/ArrangementResolution.test.tsx#L47) |
