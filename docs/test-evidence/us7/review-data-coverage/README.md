# US7 — review-data coverage evidence

Owner: Jaydon. Local execution: 4 November 2026, Singapore time.
Branch: `us7-review-data-coverage`; base: `13309ef`.

## Scope

Five new unit cases (.3.8–11 and .9.23) and stronger AC-007.3.1 current-value mapping.
The query fixture is corrected from legacy text to structured requirement arrays.
This is a fixture correction, not a product defect. Only tests, documentation and
evidence change. Application code, migrations, coverage configuration and exclusions
remain unchanged. No shared data, manual execution or database enforcement pass is
claimed. Other owners' files and US41 arrangement-review coverage remain outside scope.

## Verification

| Check | Result | Log |
| --- | --- | --- |
| Focused baseline | 43 tests / three files passed | before.log |
| Focused final | 48 tests / four files passed | after.log |
| Full frontend coverage | 1,738 tests / 222 files passed | full.log |
| Lint | Passed | lint.log |
| Production build, including TypeScript | Passed | build.log |
| Catalogue/source mapping | 282 unique US7 source IDs; links verified | [Catalogue](../../../test-cases/US7_test_cases.md) |

Focused commands run `npm run coverage --` with
`changeRequestReviewQueryService.test.ts`, `changeRequestReviewService.test.ts` and
`ChangeRequestReviewForm.test.tsx`, adding `changeRequestDisplay.test.ts` in the final
run. `--coverage.include` targets `src/features/events/changeRequestDisplay.ts`,
`src/features/events/changeRequestReviewQueryService.ts` and
`src/features/events/changeRequestReviewService.ts`. Reports go to
`/tmp/is212-us7-data-before` and `/tmp/is212-us7-data-after`.
Final gates run once after the final tests: `npm run coverage`, `npm run lint` and
`npm run build`, from `frontend/`.

Full-run coverage: 98.23% statements/lines, 91.94% branches, 95.71% functions.
`file-coverage.json` retains full-run counters and each missed branch, including two
distinct missed branches at query line 41. V8 branch totals can increase when a new
path is executed; percentages alone do not establish AC acceptance.

| File | Statements | Branches | Functions | Lines | Remaining branches |
| --- | ---: | ---: | ---: | ---: | --- |
| changeRequestDisplay.ts | 100% | 96.42% | 100% | 100% | 47 |
| changeRequestReviewQueryService.ts | 100% | 70% | 100% | 100% | 35, 39–41, 43–46 |
| changeRequestReviewService.ts | 100% | 93.10% | 100% | 100% | 24–25 |

[Exact remaining-branch reasons and contract references](../../../us7-review-data-coverage.md).
Reasons are pending team review; no safeguards are removed and no nulls violating
the current database/query/error contracts are invented solely to reach 100%.

## Representative regression probes

Two deliberate changes in a disposable copy were detected by the new tests:

| Deliberate change | Detecting case | Evidence |
| --- | --- | --- |
| Interpret unzoned dates as UTC instead of Singapore time | AC-007.3.10 | probe-singapore-date.log |
| Stop recognising SQL constraint refusal 23514 | AC-007.9.23 | probe-constraint-refusal.log |

Restoring the disposable files gave 37 passing service/query/format unit tests
(`probe-restored.log`). The copy excludes `.env*` files and retains the normal network
guard. Repository application files were never edited. These expected failures are
test-quality probes, not product defects or TDD evidence.

No normal assertion failed. The full run retains unrelated React act warnings,
refusal diagnostics and attempts blocked by the existing test network guard. No real
network calls are claimed. The build retains the existing large-chunk warning.
Logs only normalise trailing whitespace and final blank lines.

## Shared records

Shared File worklist rows 41, 47 and 49 were refreshed on 4 November 2026, with
percentages, remaining branch locations, next steps and exact justifications. All
three say **Justification needed**. The snapshot note identifies the three refreshed
US7 rows; other rows retain their baseline. US7 summary counts story tags rather than
fixed row positions, so sorting does not break this story's counts. Verification
showed Saved to Drive and the expected cell contents:

- [Formatting justification](shared-sheet-justifications.png).
- [Query and save-service justifications](shared-sheet-service-justifications.png).
- [Query and save-service percentages](shared-sheet-service-percentages.png).

No team acceptance of justifications, manual pass, Defects entry or Automated Test
Case Runs entry is claimed. Jaydon handles commit, push, PR and merge; remote CI is
separate from this local run.
