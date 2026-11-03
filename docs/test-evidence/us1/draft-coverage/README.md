# US1 — draft coverage follow-up

Owner: Jaydon. Executed locally on 4 November 2026 (Singapore time), on
`us1-draft-coverage` based on `3edab5b`. Jaydon handles commits, PR and merge.

## Scope and results

Only two frontend test files and their supporting documentation changed. No product
code, migration, shared Supabase data, coverage configuration or exclusions changed.

- Three new cases: AC-001.4.35–36 are unit tests (Negative/Boundary and Happy path/Regression);
  AC-001.4.37 is a component Negative/Regression test. See the
  [US1 catalogue](../../../test-cases/US1_test_cases.md).
- AC-001.3.1 now checks purpose and untitled labels with the correct draft links/status.
  AC-001.4.27–28 assert successful retry clears errors without saving/submitting.
- Focused baseline: **53 tests / four files**, passed. Final focused: **56 / four**, passed.
- Full frontend coverage: **1,701 tests / 211 files**, passed. Overall statements/lines
  **96.52%**, branches **91.30%**, functions **94.76%**. This is the updated-main
  snapshot, not a claim that all differences from the older workbook came from US1.
- Lint and production build passed; build includes `tsc --noEmit`.
- No failing assertion or genuine product defect occurred. No manual or database pass
  is claimed. Existing service tests mock Supabase and do not establish live RLS.

The focused runs select `DraftPages.test.tsx`, `draftFormValues.test.ts`,
`draftValidation.test.ts` and `eventDraftQueryService.test.ts` and restrict reporting
to the five assigned US1 files. Reports go to `/tmp/is212-us1-coverage-before` and
`/tmp/is212-us1-coverage-after`, preserving the normal full-suite report. Final gates:
`npm run coverage`, `npm run lint`, `npm run build`, all from `frontend/`.

## Five assigned files — final full-run percentages

| File | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| draftFormValues.ts | 100% | 100% | 100% | 100% |
| MyDraftsPage.tsx | 97.36% | 100% | 100% | 97.36% |
| ResumeDraftPage.tsx | 96.66% | 100% | 100% | 96.66% |
| draftValidation.ts | 100% | 96.96% | 100% | 100% |
| eventDraftQueryService.ts | 100% | 97.67% | 100% | 100% |

`file-coverage.json` preserves the full-run counters; percentages above follow the
report's two-decimal truncation. The focused before/after logs are comparable to each
other, but other stories' tests add coverage in the full run, so denominators may differ.

## Remaining fallbacks: investigation, not a 100% claim

Follow-up branch review: the final LCOV report identifies only two unexecuted branch
alternatives in these five files, at draftValidation.ts:82 and
eventDraftQueryService.ts:86. The other three files have 100% branch coverage. Across
this selected five-file scope, 119 of 121 measured branch alternatives were executed;
this is not an overall US1 percentage. The two page exception lines below are remaining
statement/line gaps, not additional branch gaps in this report.

No further test is added solely for these two alternatives: the current schema has no
root-level form issue, and the normal collection API returns an array on success.
Reassess when those supported contracts change. Keep the code, measured percentages
and these reasons visible; do not mark the files as 100% or exclude the fallbacks.

| Location | Current contract and reason no artificial test was added |
| --- | --- |
| MyDraftsPage.tsx:26 | The list service's auth/query/map work is inside try/catch; failures resolve to an `ok: false` result. The page's additional rejection handler is retained as a safeguard. Rejecting the mocked service would bypass the real contract. Existing query-failure/connection tests and strengthened retry tests cover the supported error route. |
| ResumeDraftPage.tsx:28 | The editor passes a string ID and the load service catches auth/query/mapping failures. They resolve to an unavailable/load-failed result. The outer page rejection safeguard remains; no forced mock rejection is counted as realistic coverage. |
| draftValidation.ts:82 | The `form` fallback is for an issue without a field path. Supported input is an object, every current field validator supplies its key, and the cross-field date issue explicitly uses `proposedEnd`. Passing a null/non-object root or patching Zod internals just to generate an empty path is outside the current form contract. Reassess if root-level rules are introduced. |
| eventDraftQueryService.ts:86 | A successful ordinary collection SELECT returns an array, including `[]` for no rows. Auth/query failures return earlier or are caught. The null-data fallback is retained for a missing/malformed response, but `{data: null, error: null}` is not a normal successful collection response. The existing empty-array case AC-001.4.17 remains the realistic empty-state check. |

These are explanations for uncovered code under the current contracts, not approval
to exclude it or report it as covered. Team review may accept or challenge the rationale.
The invalid-date test exercises the exported conversion helper's string boundary; it
does not assert PostgreSQL stores invalid timestamps. Requirement-array isolation uses
ordinary populated saved values, without mocking the helper or validator internals.

## Logs and limitations

- `focused-before.log`, `focused-after.log`: targeted execution and five-file coverage.
- `frontend-coverage.log`, `lint.log`, `build.log`: final regression gates, each run once.
- `file-coverage.json`: final measured counters for the five files and overall summary.
- Full regression stderr includes React `act(...)` warnings and attempted service calls
  blocked by the existing global test fetch guard in unrelated tests (including
  registration readiness). Those tests pass; these warnings are follow-up test-isolation
  work for their owners, not a demonstrated US1 product defect. No network was enabled.
- Production build retains the existing large-chunk warning. No bundling change made.
- Log formatting is normalised only to remove trailing whitespace/extra final blank
  lines for `git diff --check`; diagnostic content is retained.

## Shared coverage worklist — 4 November 2026

Updated the existing [File worklist](https://docs.google.com/spreadsheets/d/1R6WpfZ9Q1-5WqRmu0cV6kvZlFCeiXl8u1KFM1pCxmug/edit?gid=568103064#gid=568103064)
after verifying each file name: K19:L20 and K22:L23 contain `Justification needed`
and a concise file-specific explanation only. Removed generated ownership/mapping
boilerplate from column L across all 253 files after confirming no other user-entered
notes would be lost: four justifications remain and the other 249 cells are blank.
Read back all 253 rows and verified all other cell values were unchanged. Restored
the Jaydon/US1 filters; Google Sheets showed Saved to Drive. PR remains pending;
no team acceptance is claimed.

Subsequently refreshed E19:I23 from the verified 4 November full-run summary and LCOV
report: percentages and uncovered locations now match the five-file table above.
`draftFormValues.ts` recalculated to 100%, has no uncovered locations or justification,
and K21 is `Retested`. The four remaining explanations in L19:L20/L22:L23 now state
the exact line/branch, what is unexecuted and the supporting contract; review remains
pending. A3 labels the mixed-date snapshot: only these five files were refreshed.

The US1 summary originally still counted eight gaps because its fixed row references
no longer matched the sorted worklist. Replaced D12:E12 with story-tag-based COUNTIFS
over B10:B262/D10:D262 and verified 13 mapped files / seven gaps. The seven include
shared files assigned to teammates; only four are in Jaydon's five-file US1 portion.
Other story-summary formulas were not changed in this refresh.
No Test Case Overview, Manual Testing, Defects or Automated Test Case Runs edits were
made in this update. Screenshots: `shared-sheet-justifications.png` and
`shared-sheet-coverage-updated.png`.
