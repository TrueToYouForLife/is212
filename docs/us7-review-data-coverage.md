# US7 — review data coverage, 4 November 2026

Owner: Jaydon. Branch: `us7-review-data-coverage`; base: `13309ef` (US17 PR180 merged).

This portion strengthens US7's comparison data, readable proposed values and safe
save-error handling. It adds five unit cases and strengthens AC-007.3.1's complete
current-value mapping assertion. The query fixture now uses the structured requirement
arrays introduced by 0054 rather than historical text values; this is a fixture
correction, not a product defect. No application, database, migration, configuration
or coverage-exclusion changes are included.

## Cases

| Test ID | Classification | Requirement and useful assertion |
| --- | --- | --- |
| AC-007.3.8 | Unit — Happy path / Boundary | Requirement lists use labels; a cleared list is None, not Not provided. Explicit registration true/false remains Yes/No. Equipment codes remain visible without loaded labels. |
| AC-007.3.9 | Unit — Happy path / Boundary | Layout labels are used when available; unmatched/unloaded codes remain visible and null remains Not provided. |
| AC-007.3.10 | Unit — Happy path / Boundary / Regression | Local Singapore, UTC and offset timestamps describe the same start/end interval across midnight. |
| AC-007.3.11 | Unit — Happy path / Boundary | Nullable event details map to blanks, requirement arrays/false registration remain intact, and an empty review list preserves the assigned event context. |
| AC-007.9.23 | Unit — Negative / Regression | Six database value/constraint refusal codes map to safe guidance, with one review RPC and no direct event write or retry. This does not prove database enforcement. |

The catalogue has 282 US7 source IDs. Existing component tests run as regressions;
remaining review-component coverage is a separate portion. US41 arrangement-review
gaps and files allocated to other owners remain outside scope.

## Coverage and retained safeguards

All three files reach 100% statements, functions and lines. Branch coverage is below.
The reasons are pending team review, not accepted exclusions.

| File | Before branches | After branches | Remaining branch locations |
| --- | ---: | ---: | --- |
| changeRequestDisplay.ts | 75% | 96.42% | 47 |
| changeRequestReviewQueryService.ts | 58.62% | 70% | 35, 39–41, 43–46 |
| changeRequestReviewService.ts | 92.85% | 93.10% | 24–25 |

- **Display line 47:** the fallback catalogue would handle an unexpected array-valued
  field. Valid arrays are equipment (handled separately), accessibility and facilities
  (both have catalogue entries). No wrong-field array is supplied just to reach it.
- **Query line 35:** the null embedded-relation fallback is retained. The selected
  to-many relation returns an array, including `[]` when there are no requests.
- **Query lines 39–41:** blank purpose, start, end and attendance fallbacks remain.
  The non-draft core-field constraint requires these fields; assigned Coordinator
  reads do not expose drafts. Optional name, event type, description, programme,
  layout and special-arrangement alternatives are tested with permitted values.
- **Query lines 43–46:** null requirement arrays and registration fallbacks remain.
  0054 makes all three arrays NOT NULL; 0001 makes registration NOT NULL. Tests use
  actual empty arrays and false, not nulls that violate these contracts.
- **Save lines 24–25:** empty-string defaults for missing error message/code remain.
  Supabase PostgREST errors provide string fields (including empty strings on connection
  failures). Existing tests cover permission, stale, unknown and lost-response refusals;
  this portion adds the value/constraint codes. No missing-field error is fabricated
  solely to execute these defensive defaults.

Safeguards stay in application code. Revisit these reasons if the database schema,
query shape, supported field types or error contract changes.

## Verification and limits

Focused baseline: 43 tests / three files. Focused final: 48 tests / four files.
Full frontend: 1,738 tests / 222 files passed; lint and production build (including
TypeScript) passed. Overall coverage: 98.23% statements/lines, 91.94% branches,
95.71% functions. [Logs, counters and quality probes](test-evidence/us7/review-data-coverage/README.md).

No normal assertion failed and no product defect was discovered. Two deliberate
regressions in a disposable copy were detected; restored tests passed. No new manual,
SQL, deployed-environment, RLS or email-delivery result is claimed. Jaydon handles
commit, push, PR and merge; CI and justification acceptance remain separate.
