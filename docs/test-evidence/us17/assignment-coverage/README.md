# US17 — assignment coverage

Owner: Jaydon. Local execution: 4 November 2026, Singapore time.
Branch: `us17-assignment-coverage`; base: `41fa44a`.

## Scope

Thirteen new US17 cases: eight unit and five component tests in
`coordinatorAssignmentService.test.ts`, `CoordinatorAssignmentForm.test.tsx` and
`CoordinatorAssignmentAvailability.test.tsx`.
The form tests use the real service with mocked Supabase RPC, not a mocked assignment
result. Existing queue, assignment and US36/US38 overview tests remain unchanged.

No application code, database objects, migrations, coverage settings or exclusions
changed. No shared deployment or data writes. No manual or live RLS pass is claimed;
the existing database authorisation tests were not rerun for this frontend-test change.
Both assigned files and the US17/US36 stories belong to Jaydon. Other owners' source
files remain outside scope. Jaydon also accepted the card and queue coverage gaps,
bringing the workload to 32 files (the original 30 plus these two). They are covered
here through US17 scenarios, without changing US36, US38 or US43 behaviour or tests.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused baseline | 9 tests / two files passed | focused-before.log |
| Focused final | 20 tests / four files passed | focused-after.log |
| Expanded focused coverage | 22 tests / five files passed | expanded-focused.log |
| Full frontend coverage after expansion | 1,733 tests / 221 files passed | expanded-frontend-coverage.log |
| Final assertion refinement | Two availability tests passed | expanded-targeted-retest.log |
| Lint after expansion | Passed | expanded-lint.log |
| Production build after expansion, including TypeScript check | Passed | expanded-build.log |
| US17 catalogue/source mapping | 66 unique IDs, all listed | [US17 catalogue](../../../test-cases/US17_test_cases.md) |

Focused baseline runs `CoordinatorAssignmentQueue.test.tsx` and
`CoordinatorActiveEvents.test.tsx`; final adds the two new test files. Both commands
use `npm run coverage -- <test files>` and restrict `--coverage.include` to
`src/features/events/coordinatorAssignmentService.ts` and
`src/features/events/components/CoordinatorAssignmentForm.tsx`. Report directories:
`/tmp/is212-us17-before` and `/tmp/is212-us17-after`. Final gates, each run once:
`npm run coverage`, `npm run lint`, `npm run build`, from `frontend/`.

Expanded focused checks add `CoordinatorAssignmentAvailability.test.tsx` and include
the card and queue source files as well. The full gates were rerun once after adding
those two cases. A final assertion refinement checks the actual selectable IDs,
followed by the two-case targeted retest; application code is unchanged. Earlier
`frontend-coverage.log`, `lint.log` and `build.log` retain the pre-expansion checkpoint.

The final full snapshot has 98.14% statements/lines, 91.80% branches and 95.71% functions.
It includes upstream PR178's tests as well as this portion; differences from the older
worklist or US1 checkpoint must not all be attributed to these eleven cases.

## File results and remaining justification

| File | Statements | Branches | Functions | Lines | Uncovered locations |
| --- | ---: | ---: | ---: | ---: | --- |
| coordinatorAssignmentService.ts | 100% | 100% | 100% | 100% | None |
| CoordinatorAssignmentForm.tsx | 100% | 95.45% | 100% | 100% | Branch at line 23 |
| CoordinatorAssignmentCard.tsx | 100% | 100% | 100% | 100% | None |
| CoordinatorAssignmentQueue.tsx | 100% | 100% | 100% | 100% | None |

The two added component cases exercise genuine assignment boundaries: no Coordinator
accounts leaves the event visible with guidance and prevents writes; an unavailable
current assignee is distinguished from loading, then the Lead can choose a valid
replacement and receive success feedback. No fabricated submit or impossible service
response is needed to cover the card and queue's missing branches.

**Branch at CoordinatorAssignmentForm.tsx:23:** the early return guards a pending,
disabled or invalid submission. Ordinary UI interactions cannot submit while the
button is disabled; selection is also locked while saving. The new tests verify these
controls and that repeated clicks, current-Coordinator selection, disabled state and
an empty picker send no extra RPC. A direct synthetic submit would bypass those UI
constraints solely to exercise the guard, so the safeguard is retained without that
test. Revisit if the supported submission path changes. The reason is pending team
review, not an accepted exclusion or a claim of 100% branch coverage.

The malformed-picker unit case checks the service's explicit validation of untrusted
RPC data; it does not claim the current SQL function produces malformed records or
patch Zod internals. Permission-refusal tests verify message mapping, not real RLS.
`file-coverage.json` retains full-run counters and missing locations for all four files.

## Tests detect representative regressions

Three deliberate changes were made only in a disposable source copy with no `.env`
files and the normal global network guard. Each caused the intended test to fail:

| Deliberate regression | Detecting case | Evidence |
| --- | --- | --- |
| Use the wrong permission error code, producing the generic message | AC-017.1.13 | probe-permission-message.log |
| Return empty success for malformed picker rows | AC-017.2.12 | probe-malformed-picker.log |
| Enable the save button while the request is pending | AC-017.2.17 | probe-pending-save-button.log |

After restoring the disposable files, all eleven new tests passed (`probe-restored.log`).
These probes demonstrate representative assertion sensitivity; they are not exhaustive
mutation coverage, product defects, or TDD red/green evidence. No repository application
file was modified by a probe. The probe checker initially expected `AssertionError`,
while the component matcher emits `Error`; correcting that detector confirmed the
intended disabled-button failure. This was a harness issue, not an application failure.

## Warnings and records

No normal test assertion failed and no genuine product defect was discovered. The full
suite retains unrelated React act warnings, logged refusal diagnostics and attempted
calls blocked by the existing test network guard. The build retains the large-chunk
warning. These were not repaired in this story portion. Log formatting only removes
trailing whitespace and extra final blank lines; diagnostic content is preserved.

Shared File worklist rows 24–25, 29 and 45 were refreshed on 4 November 2026 and verified
saved to Drive: service/card/queue **Retested - 100%**, form **Justification needed**. Percentages,
uncovered locations, next steps and the form's line 23 justification match this run;
the three fully covered files' justifications are blank. See the
[initial two rows](shared-sheet-results.png) and [expanded workload](shared-sheet-expanded-results.png).
The snapshot note distinguishes these four rows and the earlier five US1 rows from
the retained baseline. US17's summary now counts story tags rather than fixed row
addresses, preserving correctness when the worklist is sorted: 11 mapped files,
six with gaps across all owners. These counts do not imply ownership of every gap.

No team acceptance of the justification, new manual results, Defects entry or
Automated Test Case Runs entry is claimed. Jaydon handles commit, push, PR and merge
after review/CI; PR number is not yet assigned.
