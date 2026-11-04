# US24 — return coverage evidence

Owner: Jaydon. Local execution: 4 November 2026, Singapore time.
Branch: `us24-return-coverage`; base: `3350c20`.

## Scope

Three new component cases, AC-024.1.19–21, cover closing unsaved inspections,
nullable display details and ignoring late allocation reloads after unmount.
The existing unit case AC-024.1.12 additionally refuses six malformed snapshots:
cancelled Out; inspected Out; completed Pending checks; defect history with null or
blank descriptions; and Missing history with an Operational result.

Nullable event labels and empty staff labels are supported by the response schema;
the component case does not claim normal submission omits references, modify audit
identities, or prove database behaviour. History examples use distinct allocations,
units and event identities. Service unit tests mock Supabase; component tests mock
load/save services. No application, SQL, configuration or coverage-exclusion changes
are included. No new manual, RLS, shared-deployment or database-enforcement pass is
claimed. US27 status/catalogue gaps and the event-catalogue mapping review are separate.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused baseline | 14 tests / two files passed | before.log |
| Focused final | 17 tests / two files passed | after.log |
| Full frontend | 1,744 tests / 223 files passed | full.log |
| Lint | Passed | lint.log |
| Production build, including TypeScript | Passed | build.log |
| Catalogue/source mapping | All 40 US24 IDs and new source anchors verified | [Catalogue](../../../test-cases/US24_test_cases.md) |

Focused commands run `npm run coverage --` with `equipmentReturnService.test.ts` and
`EquipmentReturns.test.tsx`; `--coverage.include` targets the three files below.
Reports go to `/tmp/is212-us24-return-before` and `/tmp/is212-us24-return-after`.
Final gates run once after the final tests: `npm run coverage`, `npm run lint` and
`npm run build`, from `frontend/`.

Overall full-run coverage: 98.24% statements/lines, 92.29% branches, 95.83% functions.

| File | Statements | Branches | Functions | Lines | Remaining locations |
| --- | ---: | ---: | ---: | ---: | --- |
| EquipmentReturnsView.tsx | 100% | 100% | 100% | 100% | None |
| equipmentReturnService.ts | 100% | 100% | 100% | 100% | None |
| ReturnInspectionForm.tsx | 100% | 93.75% | 100% | 100% | Branches 26, 30, 40 |

`file-coverage.json` retains counters and missing locations. [Exact remaining-guard
reasons](../../../us24-return-inspections.md) cover disabled submit/reload paths and
the Zod error-message fallback. Reasons await team acceptance, not an accepted
exclusion or a claim of 100% form branch coverage.

## Representative regression probes

Only a disposable source copy was changed:

| Deliberate regression | Detecting case | Evidence |
| --- | --- | --- |
| Accept cancelled allocations in Out | AC-024.1.12 | probe-cancelled-out.log |
| Invoke reload callbacks after the form unmounts | AC-024.1.21 | probe-late-reload.log |

Both changes failed their intended assertions. Restoring the copy gave 17 passing
tests (`probe-restored.log`). No repository application source was changed. These
expected failures are quality probes, not product defects or TDD evidence.

The first component probe stopped during module import because `.env*` files were
deliberately excluded (`probe-environment-initial.log`). Supplying synthetic localhost
configuration only to the disposable test process allowed the check to reach its
assertion. The usual network guard stayed active; no real credentials were copied
and the repository's configuration was unchanged. This was a probe-environment issue,
not a product defect or a successful regression detection.

No normal assertion failed and no genuine product defect was found. The full run
retains unrelated React act warnings, refusal diagnostics and attempts blocked by
the existing test network guard; no real network calls are claimed. The build retains
its large-chunk warning. Logs only normalise trailing whitespace and final blank lines.

## Shared records

File worklist rows 30, 31 and 33 were refreshed on 4 November 2026 and verified
Saved to Drive. View/service are **Retested - 100%**, with no uncovered locations or
justification text. The form is **Justification needed**, with branches 26, 30 and 40
and their exact reasons recorded. US24 summary now counts story tags rather than
fixed row positions; the snapshot note distinguishes the three refreshed US24 rows
from the other retained measurements.

- [Progress and justification verification](shared-sheet-results.png).
- [Percentage and uncovered-location verification](shared-sheet-percentages.png).

No new manual results, Defects entry or Automated Test Case Runs entry is claimed.
Jaydon handles Git, PR and merge; remote CI and team acceptance of remaining reasons
are separate from this local run.
