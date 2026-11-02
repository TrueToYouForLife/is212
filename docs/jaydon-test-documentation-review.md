# Jaydon's test documentation accuracy review

Owner: Jaydon. Recorded: 2 November 2026.
Branch: `jaydon-test-documentation-review`. Source baseline: `d23ff29`.

Latest US41 follow-up: the ten older SQL cases now execute before replay in the
focused/historical/quarter-hour upgrade/fresh gates and all passed. This closes the
SQL runner gap described at the earlier checkpoints below. No additional case IDs
or product changes were needed. See [restored regression evidence](test-evidence/us41/regression/README.md).
US7's dedicated reply-validation gap was subsequently closed on 3 November;
see [restored cases and evidence](test-evidence/us7/reply-validation/README.md).
Unreported US48 safety-stage manual checks remain outstanding.

Subsequent US41 follow-up: AC-041.1.3 is now implemented and locally verified;
see [replay evidence](test-evidence/us41/replay/README.md). The findings below retain
the documentation-review checkpoint. That work also identified a separate current
runner gap: the ten older US41 SQL cases are not invoked by existing entry points.
Restoring those behavioural checks and US7's dedicated reply cases remains separate.

## Scope and method

Review US1, US7, US17, US24, US27, US36, US41, US42, US47 and US48 after the
source-ID catalogue closeout. Check descriptions against test definitions, parameter
inputs and assertions; distinguish mocked frontend checks from database enforcement;
check source references and the scope of recorded evidence. A title or filename alone
does not establish an assertion, current pass or end-to-end coverage.

These ten stories have 634 distinct numeric source-ID references. US48 includes one
legacy dependency-only ID; duplicates across files do not add distinct cases. This
is a static documentation review, not a new test execution or complete Jira signoff.
Historical results remain dated. No application, migration or test source is changed.

## Catalogue findings

| Story | Source IDs | Review outcome and limits |
| --- | ---: | --- |
| [US1](test-cases/US1_test_cases.md) | 83 | Corrected refusal/boundary classifications and non-numeric attendance wording. AC-001.5.2–3 validate create/save replies, not existing-draft updates; the unavailable-update check is AC-001.4.1. All tests are mocked unit/component checks, not proof of live RLS. |
| [US7](test-cases/US7_test_cases.md) | 266 | Distinguished valid rejection/partial approval from failed operations, specified parameter inputs, and changed email wording to queuing. Found the duplicated test file and eleven absent dedicated reply-validation cases below. |
| [US17](test-cases/US17_test_cases.md) | 53 | Clarified name-lookup empty results versus permission errors and the 500/501 boundary. Kept mocked handover checks separate from real SQL permissions and retained historical ownership/TDD notes. |
| [US24](test-cases/US24_test_cases.md) | 37 | Retained 23 SQL, six unit and eight component cases. Date-based Out, missing follow-up, status reuse, stale consent, rollback and races remain distinct. Eight manual groups are reported results from 29 October; no physical checkout or additional availability block is claimed. |
| [US27](test-cases/US27_test_cases.md) | 40 | Retained 21 SQL and 19 frontend cases. Global stock counts, no-op saves, stale consent, retained reservations/reviews and auto-close have separate coverage. Full-suite and later targeted results retain their original scopes. |
| [US36](test-cases/US36_test_cases.md) | 5 | Clarified link-destination assertions versus actual navigation and database reassignment. Five mocked component cases do not enumerate every newer safety stage. US38's Postponed regression remains under its own ID. |
| [US41](test-cases/US41_test_cases.md) | 21 | Corrected mixed-success/refusal classifications. Existing reason independence, reservation preservation, resolution permissions and rollback checks remain mapped. Replay snapshots lack the promised comparison; AC-041.1.3 remains missing. |
| [US42](test-cases/US42_test_cases.md) | 19 | Corrected five rendered UI/page cases to Component. Six service unit and eight SQL cases remain distinct. Seven reported manual passes remain dated 18 October. Legacy slot rendering fixtures do not prove quarter-hour booking writes. |
| [US47](test-cases/US47_test_cases.md) | 61 | Kept foundation/conversion/settings and unit/component/SQL boundaries distinct. Earlier pending statements and allocated-next IDs are historical checkpoints. Forced breaks, genuine defects, fixtures and later settings/manual evidence retain separate descriptions. |
| [US48](test-cases/US48_test_cases.md) | 49 | Retained 48 replacement cases plus the excluded legacy block-form dependency ID. Original manual acceptance is separate from 17 later safety-stage SQL cases. New-stage manual checks and US45 integration are not established by the earlier passes. |

## Follow-up 1: US41 replay assertion

`arrangement_revalidation.sql` saves `us41_flags_replay` and `us41_notices_replay`,
but the runner has no corresponding comparison. Historical documentation allocated
AC-041.1.3 to this behaviour. The fixture snapshots alone cannot establish preservation
or idempotency, and the missing ID is excluded from the 21 existing source IDs.

Next bounded portion: add a real populated replay comparison for both flags and notices,
including resolved history, and verify it with the disposable database runner. Inspect
the runner's migration order before placing the assertion. Do not weaken preservation
expectations or claim a pass before the test runs. No migration is expected unless
testing demonstrates a product defect requiring one.

## Follow-up 2: US7 dedicated reply-validation tests

Closed on 3 November 2026: eleven allocated IDs now exercise the real reply validator.
The paragraphs below retain the original review finding, not the current source state.

At the review baseline, these tracked files are byte-identical:

- [changeRequestReplyValidation.test.ts](../frontend/src/features/events/__tests__/changeRequestReplyValidation.test.ts)
- [changeRequestReviewValidation.test.ts](../frontend/src/features/events/__tests__/changeRequestReviewValidation.test.ts)

Both import and exercise `validateChangeRequestReview`, repeating 27 expanded cases.
The dedicated reply file does not call `validateChangeRequestReply`. This is an
existing test-source duplication, not one of the untracked ` 2` copies removed earlier.
No duplicate is deleted or test rewritten by this documentation PR.

[Reply preparation](us7-reply-preparation.md) lists AC-007.7.37–47, but none of those
eleven IDs is present in the current test sources. The [US7 catalogue's missing-case
register](test-cases/US7_test_cases.md#missing-historical-reply-validation-cases) retains
their intended behaviour without counting them as implemented or passed. Service,
component and SQL tests exercise related reply behaviour; this is a missing dedicated
unit-test set, not evidence that the feature is broken or wholly untested.

After US41, inspect the original history and restore useful requirement-based reply
validation cases in a separate portion. Check ordering/trimming, missing/duplicate/
unrequested answers, blanks, immutable input, legacy questions and value injection.
Retain the allocated IDs where their original intent still applies. Do not turn a
static finding into a fabricated failing run or product-defect sheet entry.

## Manual and evidence limits

- US24, US27, US42, US47 and original US48 manual reports retain only their documented
  scope, dates and reporter. No additional account, fixture, screenshot or timestamp
  is inferred. Earlier checkpoints are not new runs on this baseline.
- US48 safety-stage manual checks remain unreported. Later US45 behaviour with the
  safety workflow enabled needs its own integration verification; the US48 SQL suite
  does not enable that workflow or prove the resubmission lifecycle.
- No new manual results for US1, US7, US17, US36 or US41 are invented by this review.
  Existing historical notes remain available through their implementation documents.
- No Google Sheet edits, deployment, delivered email, new runtime coverage percentage
  or automated-suite pass is claimed. Spreadsheet Automated Test Case Runs remains
  owned by GitHub Actions.

## Static verification

Static checks passed on 2 November 2026:

- All 2,880 numeric source IDs across 45 stories remain in their own catalogues,
  including the 634 source references in these ten stories.
- All 1,853 catalogue/review links and 1,749 source-line anchors resolve. Reviewed
  catalogue row anchors contain the exact ID, not just a matching numeric prefix.
- Generated table structure, changed-file endings and `git diff --check` passed.
- All changes are Markdown. The absent historical IDs and next-unused allocations
  are separate from the implemented-case inventory.

These checks validate documentation consistency; they do not replace executing a
test or observing a manual outcome. No runtime suite was rerun for this portion.
