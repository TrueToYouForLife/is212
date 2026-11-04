# US7 — review component coverage evidence

Owner: Jaydon. Local execution: 4 November 2026, Singapore time.
Branch: `us7-review-component-coverage`; base: `4d47053`.

## Scope and checks

Three new component cases (.3.12, .9.24, .13.32) exercise saved notes/provisional
outcomes, late responses after an event switch, and explicit reload with fresh
comparison versions. Query/save services are mocked in the panel tests. These checks
do not prove live API, database, RLS or version enforcement. Existing form tests remain
unchanged regressions. Application code, migrations and coverage settings/exclusions
are unchanged. US41 arrangement files and other owners' work remain outside scope.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused baseline | 42 tests / five files passed | before.log |
| Focused final, after fixture correction | 45 tests / six files passed | after.log |
| Full frontend, after fixture correction | 1,741 tests / 223 files passed | full.log |
| Lint | Passed | lint.log |
| Production build, including TypeScript | Passed after fixture correction | build.log |
| US7 catalogue/source mapping | All 285 source IDs and source anchors verified | [Catalogue](../../../test-cases/US7_test_cases.md) |

Focused commands run `npm run coverage --` with `ChangeRequestReviewForm.test.tsx`,
`ChangeRequestReviewPanel.test.tsx`, `ChangeRequestReplyHistory.test.tsx`,
`ChangeRequestSignificance.test.tsx` and `ChangeRequestList.test.tsx`, adding
`ChangeRequestSummary.test.tsx` in the final run. `--coverage.include` targets the
four component source files listed below. Reports go to
`/tmp/is212-us7-component-before` and `/tmp/is212-us7-component-after`.
Final gates: `npm run coverage`, `npm run lint`, `npm run build`, from `frontend/`.
Full coverage/build were repeated after the fixture correction, not solely for a
second successful measurement.

Overall full-run coverage: 98.24% statements/lines, 92.04% branches, 95.71% functions.

| File | Statements | Branches | Functions | Lines | Uncovered locations |
| --- | ---: | ---: | ---: | ---: | --- |
| ChangeRequestSummary.tsx | 100% | 95.65% | 100% | 100% | Branch 25 |
| ChangeRequestReviewField.tsx | 100% | 90.90% | 100% | 100% | Branch 17 |
| ChangeRequestReviewForm.tsx | 96.96% | 93.54% | 100% | 96.96% | Lines 49–50; branches 26, 48 |
| ChangeRequestReviewPanel.tsx | 97.95% | 100% | 100% | 97.95% | Line 29; no uncovered branches |

`file-coverage.json` retains full-run counters and missing locations. V8 can report
100% branches while an exception-handler statement is unexecuted, as for the panel;
this is not reported as a fully covered file. [Exact retained-safeguard reasons](../../../us7-review-component-coverage.md)
are pending team acceptance, not accepted exclusions.

## Fixture mistake and correction

The initial build's TypeScript check rejected the new summary fixture: proposed
attendance was numeric instead of text, and empty field notes were null instead of
empty strings (`build-initial-fixture.log`). Runtime tests had passed because Vitest
does not typecheck those fixtures. Correcting these values restored the real types;
focused/full tests, build, lint and representative probes then passed. This was a
test-fixture mistake, not an application defect, so no product-defect entry is claimed.

## Representative regression probes

Two deliberate changes were made only in a disposable source copy:

| Deliberate regression | Detecting case | Evidence |
| --- | --- | --- |
| Stop ignoring a response after the component's event changes | AC-007.3.12 | probe-late-response.log |
| Label a provisional rejection as final | AC-007.13.32 | probe-provisional-rejection.log |

Both failed in the intended assertions. Restoring the copy produced 15 passing
panel/summary tests (`probe-restored.log`). The copy excludes `.env*` and retains
the normal network guard; repository application files were never changed. These
expected failures demonstrate representative test sensitivity, not product defects
or TDD evidence.

No normal runtime assertion failed and no product defect was found. The full run
retains unrelated React act warnings, logged refusal diagnostics and attempts blocked
by the existing test network guard. No real network calls are claimed. The build
retains its existing large-chunk warning. Logs only normalise trailing whitespace and
final blank lines.

## Shared records

Shared File worklist rows 42, 43, 46 and 50 were refreshed with measured percentages,
uncovered locations, next steps and exact justifications; all four correctly say
**Justification needed** because at least one metric is below 100%. Saved to Drive
was verified. The snapshot note now identifies seven refreshed US7 rows, including
the earlier three review-data rows. Other rows retain their previous measurements.

- [Summary, form and panel records](shared-sheet-summary-form.png).
- [Field record](shared-sheet-panel-field.png).

No new manual pass, SQL pass, deployed acceptance, Defects entry or Automated Test
Case Runs entry is claimed. Jaydon handles commit, push, PR and merge; remote CI and
team acceptance of the reasons remain separate.
