# US27 — status coverage evidence

Owner: Jaydon. Local execution: 4 November 2026, Singapore time.
Branch: `us27-status-coverage`; base: `aa2b1ad`.

## Scope and verification

Three new component cases (.1.7, .2.4, .8.9) cover a late previous-unit response,
accurate feedback for one flagged reservation and a blank stored staff display name.
Query/save services are mocked; no real API, audit write, permission enforcement,
shared deployment or new manual result is claimed. The unit-switch case exercises
the component's `itemId` update contract, not a newly introduced UI interaction.
No application, database, migration, configuration or exclusion changes are included.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused baseline | 13 tests / two files passed | before.log |
| Focused final | 16 tests / two files passed | after.log |
| Full frontend | 1,747 tests / 223 files passed | full.log |
| Lint | Passed | lint.log |
| Production build, including TypeScript | Passed | build.log |
| Catalogue/source mapping | All 43 US27 IDs and new source anchors verified | [Catalogue](../../../test-cases/US27_test_cases.md) |

Focused commands run `npm run coverage --` with `EquipmentStatusPanel.test.tsx` and
`EquipmentCatalogue.test.tsx`; `--coverage.include` targets the three components below.
Reports: `/tmp/is212-us27-status-before` and `/tmp/is212-us27-status-after`.
Final gates run once after correcting the new tests: `npm run coverage`,
`npm run lint` and `npm run build`, from `frontend/`.

Overall full-run coverage: 98.24% statements/lines, 92.35% branches, 95.83% functions.

| Component | Statements | Branches | Functions | Lines | Remaining locations |
| --- | ---: | ---: | ---: | ---: | --- |
| EquipmentCatalogueView.tsx | 100% | 96.87% | 100% | 100% | Branches 32, 42 |
| EquipmentStatusPanel.tsx | 100% | 97.29% | 100% | 100% | Branch 41 |
| EquipmentStatusHistory.tsx | 100% | 100% | 100% | 100% | None |

`file-coverage.json` preserves full-run counters and uncovered locations.
[Exact retained-safeguard reasons](../../../us27-equipment-catalogue.md) cover validated
catalogue/selection consistency and disabled submit controls. Team acceptance of
these reasons is pending; no artificial result or submission is used to reach 100%.

## Test corrections and quality probes

The initial targeted run had two authoring mistakes (`test-authoring-initial.log`):
an Under Maintenance lookup matched both a filter option and the table cell, and the
installed Vitest version lacks `toHaveBeenCalledExactlyOnceWith`. The corrected test
targets the cell and compares the complete callback-call array. Both assertions then
passed. These were test issues, not application defects or TDD evidence.

Two deliberate regressions were introduced only in a disposable source copy:

| Deliberate regression | Detecting case | Evidence |
| --- | --- | --- |
| Allow previous-unit responses to replace the current unit | AC-027.1.7 | probe-late-unit.log |
| Replace the required missing-name label | AC-027.8.9 | probe-missing-name.log |

Both failed their intended assertions; the restored copy passed all 16 tests
(`probe-restored.log`). The copy excludes `.env*`, uses synthetic localhost settings
and retains the global network guard. Repository application sources and real
configuration were unchanged; no real credentials were copied. These demonstrate
representative assertion sensitivity, not exhaustive mutation coverage or product defects.

No genuine product defect was discovered. Existing unrelated React act warnings,
refusal diagnostics and attempts blocked by the test network guard remain in the full
log; no real network calls are claimed. The build retains the large-chunk warning.
Log formatting only normalises trailing whitespace and final blank lines.

## Shared records

File worklist rows 32, 34 and 35 were refreshed on 4 November 2026 and verified Saved
to Drive. Catalogue/panel are **Justification needed**, with their exact remaining
locations/reasons; history is **Retested - 100%**, with no uncovered locations or
justification text. The snapshot note identifies the three refreshed US27 rows;
other rows retain their previous measurements. US27 summary now counts story tags
rather than fixed row positions so sorting does not break this story's calculation.

- [Progress and justification verification](shared-sheet-progress.png).
- [Percentage and uncovered-location verification](shared-sheet-percentages.png).

No new manual/SQL pass, Defects entry or Automated Test Case Runs entry is claimed.
Jaydon handles Git, PR and merge; remote CI and acceptance of justifications remain
separate from this local run.
