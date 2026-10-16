# US7 coordinator review UI — change log

Follow-up during live testing: added migration `0011`, a three-case SQL regression
file and a runner update for the shared database's legacy status constraint name.
No application code changed for that correction. See README for the cause and IDs;
all 68 database checks pass locally. Jaydon reported applying `0011` to shared Supabase
and successfully saving a field clarification on 25 September. Organiser visibility
and the remaining live review paths have not yet been confirmed.

This increment connects the previously built review service/database operation to
the event detail screen. It adds 37 mocked application tests: 35 US7 tests and two
US6 withdrawal regression tests. IDs continue existing allocations and are sorted
numerically inside each test file. US6 criterion 8 is withdrawal before review in
the supplied Jira export. No existing test IDs were changed.

## What changed in each application file

Paths below are relative to `src/features/events/`.

| File | Change and reason |
| --- | --- |
| `types.ts` | Adds saved field decisions to a change request and a review context containing current values, requests and the exact event version. |
| `eventChangeRequestService.ts` | Reads/maps `field_decisions`, shares its row mapper with the new loader, and throws on list-load failure rather than claiming the list is empty. Its comment now distinguishes organiser operations from coordinator review. Submission/withdrawal database operations are unchanged. |
| `changeRequestReviewQueryService.ts` | New loader gets event values/version and embedded change requests in one query, filtered to the signed-in assigned coordinator. Returns safe errors for missing access or failed loading. Database RLS remains authoritative. |
| `changeRequestDisplay.ts` | Shared field labels, organiser-friendly status labels and comparison formatting. Dates display in Singapore time; false displays as No; blanks as Not provided. |
| `components/ChangeRequestStatusBadge.tsx` | Shared status badge, including In review and Clarification required. Withdrawn remains visible in history. |
| `components/ChangeRequestSummary.tsx` | Shared read-only proposal, organiser reason, field decisions/questions, rejection reasons and legacy overall note. Unresolved approvals/rejections are labelled provisional. |
| `components/ChangeRequestReviewField.tsx` | A current/proposed comparison, explicit decision dropdown and comment box for each field. Rejection/clarification require a note. |
| `components/ChangeRequestReviewForm.tsx` | Validates complete decisions, calls the existing save service with the displayed version, disables duplicate saves and requires reload after server failure. No automatic approval or automatic retry. |
| `components/ChangeRequestReviewPanel.tsx` | Loads assigned reviews, renders editable submitted requests and read-only outcomes, supports manual reload, and refreshes after saving. It deliberately does not poll while decisions are being entered. |
| `components/ChangeRequestList.tsx` | Reuses the summary for organisers. Adds loading-error/retry display; preserves withdrawal and now displays its failure reason and disables the button while saving. |
| `pages/ReviewRequestDetailPage.tsx` | Coordinator sees the review panel; organiser sees the read-only list. Saving refreshes event data/history. Uses the stable history refresh callback to resolve the existing hook-dependency warning. US4 decision controls are unchanged. |

Documentation: README now describes the connected screen and links this log;
CLAUDE records the snapshot/reload rules and remaining clarification limitation.
This log records every added test. No SQL migrations, CI configuration, credentials,
or shared database contents were changed in this increment.

## Every new test

All test paths below are under `src/features/events/__tests__/`. The shared
`fixtures/changeRequestReview.ts` contains synthetic test data only, including a
confirmed event and a two-field request; it does not create real database records.

### `changeRequestReviewQueryService.test.ts` — 8

| ID | What it checks |
| --- | --- |
| AC-007.2.24 | Signed-out session cannot load a review. |
| AC-007.2.25 | Expired session cannot load a review. |
| AC-007.2.26 | Missing event exposes no review data. |
| AC-007.2.27 | Event assigned to another coordinator exposes no review data. |
| AC-007.2.28 | Invalid event ID makes no database call. |
| AC-007.3.1 | One assignment-filtered query loads current values, exact version and field decisions, newest request first. |
| AC-007.3.2 | Database failure is not reported as an empty request list. |
| AC-007.3.3 | Lost connection produces a recoverable loading error. |

### `ChangeRequestReviewForm.test.tsx` — 11

| ID | What it checks |
| --- | --- |
| AC-007.3.4 | Current and proposed values are grouped under the correct field. |
| AC-007.3.5 | Singapore dates, explicit false and blanks display correctly. |
| AC-007.5.28 | Explicit all-approval submits once with the displayed event version. |
| AC-007.5.29 | Mixed final decisions send the rejection reason and report partial approval. |
| AC-007.5.30 | Nothing is pre-approved; incomplete decisions cannot save. |
| AC-007.5.31 | Failed save preserves choices and requires reload before retry. |
| AC-007.5.32 | Busy controls prevent double-click duplicate saves. |
| AC-007.6.6 | Rejection without a reason is blocked. |
| AC-007.7.31 | Clarification without a question is blocked. |
| AC-007.7.32 | Approval and a separate question save provisionally without claiming final approval. |
| AC-007.10.3 | Rejecting every field sends each reason and reports rejection. |

### `ChangeRequestReviewPanel.test.tsx` — 11

| ID | What it checks |
| --- | --- |
| AC-007.2.29 | Permission denial hides comparison and review controls. |
| AC-007.3.6 | Failed loading offers manual reload instead of a false empty list. |
| AC-007.3.7 | Window focus and parent rerenders preserve the comparison and unsaved choices. |
| AC-007.4.1 | Organiser reason is visible alongside the review. |
| AC-007.5.33 | Approved request is read-only. |
| AC-007.5.34 | Rejected request is read-only. |
| AC-007.5.35 | Partially approved request is read-only. |
| AC-007.5.36 | Withdrawn request is read-only. |
| AC-007.5.37 | Cancelled event cannot be reviewed even with a pending request. |
| AC-007.7.33 | Outstanding clarification is read-only and cannot be finalised again. |
| AC-007.9.16 | Successful finalisation reloads the result and refreshes the parent event. This verifies UI refresh, not real database writes. |

### `ChangeRequestList.test.tsx` — 5

| ID | What it checks |
| --- | --- |
| AC-006.8.1 | Existing owner withdrawal sends the selected request and reloads. |
| AC-006.8.2 | Refused withdrawal displays the reason. |
| AC-007.6.7 | Organiser sees the rejected field's explanation and partial outcome. |
| AC-007.7.34 | Organiser sees field questions and provisional decisions without review controls. |
| AC-007.7.35 | Loading failure cannot hide questions behind an empty list; retry works. |

### `ChangeRequestReviewPage.test.tsx` — 2

| ID | What it checks |
| --- | --- |
| AC-007.2.30 | Organiser detail page mounts only the read-only change list. |
| AC-007.2.31 | Coordinator detail page passes the event and refresh callback to the review panel. |

## How to see it

Run `npm run dev`, sign in as the event's assigned coordinator, open its request
detail page and find Requested changes. The real database role and coordinator
assignment must match; selecting a development role alone does not assign an event.
The team's database environment needs the existing migrations through `0010` applied
in the documented order. This UI increment does not apply them to shared Supabase.

For an existing submitted change request, compare each field and choose its decision.
Selecting decisions alone saves nothing. Finalise review saves resolved decisions;
Save clarification requests saves provisional decisions/questions and leaves all event
values unchanged. Reload review replaces the comparison and clears unsaved choices.
After a failed save, reload and check the result before attempting another save.

Sign in as the owning organiser to see the friendly overall status and individual
reasons/questions. There is **no organiser reply control yet**. A request requiring
clarification stays unresolved until that subsequent feature is implemented; do not
manually change its status to work around this.

## Remaining work and verification limits

- Verified for this increment: **313 tests in 25 files passed**, TypeScript checking,
  lint and the production build passed. The existing bundle-size warning remains.
  The initial UI increment did not rerun SQL checks; the subsequent constraint fix
  ran all 68 database checks successfully.
- Subsequent increments added organiser replies/history and the significant-change display
  (see us7-reply-preparation.md and us7-significance.md). Notifications, database
  revalidation and full change-review activity history remain.
- These 37 tests use mocks. They check UI and service contracts, not live RLS or actual
  saved rows. Existing SQL checks cover database enforcement separately.
- Run `npm test`, `npm run lint` and `npm run build` before committing. Live browser
  acceptance testing with assigned accounts remains necessary before marking US7 done.
- Jira: the review UI subtask can move to In Review after the team reviews this increment.
  Keep US7 In Progress; do not mark clarification or the whole story done.
