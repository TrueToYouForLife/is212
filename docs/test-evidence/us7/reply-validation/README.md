# US7 dedicated reply-validation restoration

Owner: Jaydon. Local execution: 3 November 2026, Singapore time.
Branch: `us7-reply-validation-tests`. Base: `215f847` (PR170 merged).

## Change and requirement basis

The dedicated reply-validation file duplicated all 27 expanded review-validation
cases. It now tests `validateChangeRequestReply` with the existing allocated IDs
AC-007.7.37–47. Their intended behaviour is retained in
[reply preparation](../../../us7-reply-preparation.md) and their source/classification
is mapped in the [US7 catalogue](../../../test-cases/US7_test_cases.md).
The review validator's original 27 cases remain untouched in its own file.

The eleven grouped cases cover one/multiple questions, trimming and order, zero/missing/
duplicate/extra answers, approved/rejected/unrequested fields, blank answers, injected
values and decisions, non-text/malformed payloads, unavailable request statuses,
inconsistent saved questions, legacy whole-request answers and immutable request/input.
These are pure unit checks; database ownership and request-version enforcement remain
the responsibility of existing service/SQL cases. No new authorization claim is made.

## Verification

All final commands exited successfully:

| Check | Result | Log |
| --- | --- | --- |
| Reply validation, original review validation, reply service, form and history | 57 passed / 5 files, including all 11 restored cases | [targeted](targeted.log) |
| Full frontend coverage | 1,701 passed / 213 files | [coverage](coverage.log) |
| TypeScript | Passed | [typecheck](typecheck.log) |
| ESLint | Passed | [lint](lint.log) |
| Production build | Passed; existing bundle-size warning | [build](build.log) |

Full coverage: 96.50% statements/lines, 91.29% branches, 94.76% functions.
The reply-validation helper has 100% reported statements/lines, branches and functions
in that full run. Coverage is supporting evidence, not proof of requirement completeness.

The runtime total is 16 lower than the preceding 1,717: 27 duplicate review executions
were replaced by 11 distinct reply cases. No unique review case was removed. Source-ID
inventory is now 277 for US7 and 2,892 across the same 45 stories (eleven restored IDs).

From `frontend/`, the focused command used `npm run test --` with:

- `src/features/events/__tests__/changeRequestReplyValidation.test.ts`
- `src/features/events/__tests__/changeRequestReviewValidation.test.ts`
- `src/features/events/__tests__/changeRequestReplyService.test.ts`
- `src/features/events/__tests__/ChangeRequestReplyForm.test.tsx`
- `src/features/events/__tests__/ChangeRequestReplyHistory.test.tsx`

Final gates: `npm run coverage`, `npm run typecheck`, `npm run lint`, `npm run build`.
Tests/build used Singapore time and placeholder Supabase URL/public key, with network
blocked by the existing test setup. No shared service or privileged credentials used.
Static checks verify source-ID traceability, source-line links and whitespace.

## Defects and limits

No restored assertion or related test failed; no product defect was found or fixed.
An initial command used a repository-relative output path while already in `frontend/`;
the shell refused the write. The path was corrected before running the restored cases.
That command/path mistake is not a product or test assertion failure.

No application, database, migration, shared deployment or CI configuration change.
No database rerun was needed for these pure frontend tests. No new manual acceptance,
email delivery or remote CI result is claimed. No Google Sheet edit was performed;
existing overview rows for these IDs should be updated rather than duplicated.
Automated Test Case Runs remains managed by GitHub Actions.
