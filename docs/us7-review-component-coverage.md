# US7 — review component coverage, 4 November 2026

Owner: Jaydon. Branch: `us7-review-component-coverage`; base: `4d47053` (PR181 merged).

Three new component cases protect meaningful US7 behaviour: saved notes and
provisional/final decisions, late responses after switching events, and reloading
without carrying unsaved decisions into a new comparison. Existing form tests remain
unchanged regressions. No application, database, migration, configuration or coverage
exclusion changes are included. US41 arrangement-review gaps and other owners' files
remain outside scope.

## Cases

| ID | Classification | Behaviour protected |
| --- | --- | --- |
| AC-007.13.32 | Component — Happy path / Regression | Saved Coordinator/field notes remain visible. Approval/rejection is provisional while clarification is outstanding and final only after the request completes. Summary stays read-only. |
| AC-007.3.12 | Component — Negative / Regression | Switching events ignores the previous load even if it finishes last; an empty review list for the new event cannot become the old event's comparison. No save or parent callback occurs. |
| AC-007.9.24 | Component — Happy path / Boundary / Regression | Explicit reload clears unsaved choices/comments, displays the latest values and passes only the new event/request versions to the save service. Parent refresh occurs after success; another reload clears the success notice. |

These are component tests with mocked query/save services, not live API, RLS or
database-version enforcement tests. No promise rejection or unknown field is injected
just to execute a defensive branch. The catalogue now maps all 285 US7 source IDs.

## Coverage and remaining reasons

| File | Statements / lines | Branches | Functions | Remaining locations |
| --- | ---: | ---: | ---: | --- |
| ChangeRequestSummary.tsx | 100% | 95.65% | 100% | Branch 25 |
| ChangeRequestReviewField.tsx | 100% | 90.90% | 100% | Branch 17 |
| ChangeRequestReviewForm.tsx | 96.96% | 93.54% | 100% | Lines 49–50; branches 26, 48 |
| ChangeRequestReviewPanel.tsx | 97.95% | 100% | 100% | Line 29; no uncovered branches |

- **Summary line 25 and field line 17:** raw field-name fallbacks remain. Every
  supported `ProposedEventChanges` key has a label in `CHANGE_FIELD_LABELS`, and the
  strict review validator rejects unknown keys. No unknown field is fabricated.
- **Form branch 26:** the early return prevents a pending, saved or reload-required
  form from resubmitting. Normal controls are disabled in these states; existing
  tests check disabled controls, repeated clicks and no duplicate save. A synthetic
  submit bypassing the disabled fieldset is not added solely for coverage.
- **Form lines 49–50 / branch 48:** outer exception handling remains. The actual save
  service converts auth/database/network failures into safe result objects, and the
  form's normal refusal/reload handling is tested. No artificial rejected service
  promise or throwing parent callback is introduced solely to reach this catch.
- **Panel line 29:** the outer rejected-promise handler remains. The actual query
  service catches auth/database/network failures and resolves failure results; the
  panel tests failure results/retry and ignores late successful responses. No mock
  rejection violating that service contract is added. V8 reports 100% branch coverage
  while this statement is uncovered, so the file is correctly still below 100% overall.

These reasons are pending team review, not accepted exclusions. Retain the safeguards
and revisit if supported fields, submission paths or service contracts change.

## Verification and fixture correction

Focused baseline: 42 tests / five files; final: 45 tests / six files passed.
Full frontend: 1,741 tests / 223 files passed. Lint and production build (including
TypeScript) passed. Overall coverage: 98.24% statements/lines, 92.04% branches,
95.71% functions. Two deliberate regressions in a disposable copy were detected;
restored tests passed. [Logs, counters and sheet verification](test-evidence/us7/review-component-coverage/README.md).

The initial build rejected the new summary fixture: attendance was numeric instead
of text and empty field notes were null instead of empty strings. The fixture was
corrected, then focused/full tests, build and regression probes were rerun. This is
a test-fixture error, not an application defect; its failed-build log is retained.
No product defect was found and no new manual, SQL or deployed-environment pass is
claimed. Jaydon handles Git, PR and merge; remote CI and justification acceptance
remain separate.
