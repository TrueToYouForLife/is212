# Organiser reply preparation (26 September)

## Current verification note — 3 November 2026

AC-007.7.37–47 are restored in the dedicated reply-validation file. It calls
`validateChangeRequestReply`, replacing the duplicate review cases found on 2 November.
The original review file retains all 27 review cases. The eleven restored IDs keep
this document's original intent and group related invalid inputs under each case.
See the [current catalogue](test-cases/US7_test_cases.md) and
[execution evidence](test-evidence/us7/reply-validation/README.md). Historical results
below remain historical; no new shared deployment or manual pass is claimed.

`src/features/events/changeRequestReplyValidation.ts` prepares answers without I/O.
Every field marked clarification_requested needs exactly one nonblank answer; reply
input cannot change proposed values or review decisions. Older whole-request questions
use a single note. `changeRequestReplyTypes.ts` defines the reply/result types. The reply service and database operation are now implemented, and the reply form/history UI are now connected.
Migration 0013 verifies ownership and the displayed request version, preserves the
question/answer history, and returns the request to submitted without changing the event.
Jaydon reported applying it to shared Supabase on 27 September. Apply it after 0011
in any other environment before loading the new version-aware queries; 0012 is reserved for the separate pending US4 PR.


All 11 tests live in `src/features/events/__tests__/changeRequestReplyValidation.test.ts`:

| ID | Check |
| --- | --- |
| AC-007.7.37 | Separate answers are trimmed and returned in question order. |
| AC-007.7.38 | Missing answers are rejected. |
| AC-007.7.39 | Duplicate answers cannot replace a missing answer. |
| AC-007.7.40 | Answers for fields without questions are rejected. |
| AC-007.7.41 | Whitespace-only answers are rejected. |
| AC-007.7.42 | Reply input cannot include changes to proposed event values. |
| AC-007.7.43 | Requests already returned for review cannot accept another reply. |
| AC-007.7.44 | Inconsistent saved decisions are rejected. |
| AC-007.7.45 | Legacy whole-request clarification accepts a trimmed text answer. |
| AC-007.7.46 | Legacy clarification also requires a nonblank answer. |
| AC-007.7.47 | Validation preserves proposals, questions, provisional decisions and input. |


## Files changed in this increment

- `changeRequestReplyService.ts`: validates answers, checks sign-in and calls the reply RPC;
  translates failures into user messages without retrying an uncertain save.
- `0013_change_request_replies.sql`: adds the version counter/history and protected reply
  operation. Replaces the existing review function to check the request version too;
  most of that function is unchanged from 0010.
- `types.ts`, `eventChangeRequestService.ts`, `changeRequestReviewQueryService.ts`:
  read/map the request version. `changeRequestReviewService.ts` sends it with decisions.
- `run_change_request_review.sh`: restores the newest RPC after earlier migration replay
  checks, runs reply checks and checks migration replay preserves saved replies.
- README/CLAUDE: setup, behavior, test allocations and unfinished UI work.

## Additional automated cases

`src/features/events/__tests__/changeRequestReplyService.test.ts`:

| ID | Check |
| --- | --- |
| AC-007.7.48 | Trimmed answers and displayed version are sent; no client actor/event values. |
| AC-007.7.49 | Missing answers prevent an RPC call. |
| AC-007.7.50 | Missing version requires reloading. |
| AC-007.7.51 | Missing session prevents saving. |
| AC-007.7.52 | Stale request response asks for reload. |
| AC-007.7.53 | Another pending request produces a useful conflict message. |
| AC-007.7.54 | Permission denial produces a safe message. |
| AC-007.7.55 | Lost response is not automatically retried. |
| AC-007.7.56 | Unexpected response is not reported as success. |

`changeRequestReviewService.test.ts`: AC-007.5.39 sends the displayed request version;
AC-007.5.40 maps a stale request to the reload message.
Existing query case AC-007.3.1 also verifies that the loaded version survives mapping.

`backend/supabase/tests/change_request_replies.sql` (real disposable PostgreSQL):

| ID | Check |
| --- | --- |
| AC-007.2.32 | Coordinator cannot reply as the organiser. |
| AC-007.2.33 | Another organiser cannot reply. |
| AC-007.2.34 | Missing identity cannot reply. |
| AC-007.2.35 | Browser cannot overwrite answer history directly. |
| AC-007.7.57 | Missing field answer rejected. |
| AC-007.7.58 | Blank answer rejected. |
| AC-007.7.59 | Duplicate answers rejected. |
| AC-007.7.60 | Proposed-value injection rejected. |
| AC-007.7.61 | Stale reply version rejected. |
| AC-007.7.62 | Complete replies return the request to review. |
| AC-007.7.63 | Repeated save cannot duplicate an answer. |
| AC-007.7.64 | Old review client cannot overwrite an answered request. |
| AC-007.7.65 | Stale coordinator version rejected even though the event is unchanged. |
| AC-007.7.66 | Later legacy whole-request clarification accepts an answer. |
| AC-007.8.3 | All event columns stay unchanged throughout clarification rounds. |
| AC-007.9.17 | Final review applies accepted values only. |
| AC-007.13.7 | Both rounds retain questions, answers, actors and timestamps readable by owner. |

The runner also checks AC-007.13.8: replaying 0013 preserves all request rows and history.

## Remaining work

Demonstrate the connected reply form and coordinator answer-history display against shared Supabase. Notifications, significance/revalidation and complete
activity history are separate remaining US7 work. Do not mark the story complete yet.

## Reply UI increment (27 September)

No new SQL migration. Migration 0013 remains required.

- `components/ChangeRequestReplyForm.tsx`: separate answer boxes for each outstanding
  field question, plus support for an older whole-request question. Checks all answers
  before saving; prevents duplicate submits; keeps text after failure and requires reload
  before retrying a possibly successful write. Reply answers cannot edit proposed values.
- `components/ChangeRequestList.tsx`: shows the form only to the owning organiser on a
  clarification-requested change request. Successful saves reload the request and show a
  confirmation. This list now uses manual reload instead of focus/interval refresh so
  typing is not disrupted. Reload explicitly clears unsaved answers. Other status panels
  retain their existing refresh behavior. Existing withdrawal remains available.
- `components/ChangeRequestReplyHistory.tsx`: displays each saved round's field questions
  and answers (or legacy note), numbered and dated. It is shared by both roles.
- `components/ChangeRequestSummary.tsx`: includes the history; an answered field question
  on a submitted request says "Reply received — awaiting review". It retains provisional
  decision labels until final review.
- `changeRequestReplyTypes.ts` and `types.ts`: define the saved round and optional history.
- `eventChangeRequestService.ts` and `changeRequestReviewQueryService.ts`: select/map
  reply_history for both organiser and coordinator reads. Older fixture rows default to [].
- `changeRequestReplyValidation.ts`: corrects a stale comment; validation behavior unchanged.
- README/CLAUDE and this document describe the implemented UI and remaining live checks.

### New UI test cases

All are mocked component tests, not live Supabase browser tests.

| File under src/features/events/__tests__/ | ID | What it verifies |
| --- | --- | --- |
| ChangeRequestReplyForm.test.tsx | AC-007.7.67 | Inputs appear only for fields awaiting clarification. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.68 | Blank answer blocks saving; corrected answer saves with the displayed request. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.69 | Answering one question cannot substitute for another. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.70 | Legacy whole-request question accepts a single note. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.71 | Repeated submission while saving or after success makes only one service call. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.72 | Refused save retains text and requires reload. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.73 | Unexpected failure retains text without retrying automatically. |
| ChangeRequestReplyForm.test.tsx | AC-007.7.74 | Submitted request has no reply form. |
| ChangeRequestList.test.tsx | AC-007.7.75 | Another viewer does not get organiser reply controls. |
| ChangeRequestList.test.tsx | AC-007.7.76 | Successful reply reloads status, removes the form and shows confirmation. |
| ChangeRequestList.test.tsx | AC-007.7.77 | Window focus preserves typing; explicit reload clears it. |
| ChangeRequestReviewPanel.test.tsx | AC-007.13.9 | Coordinator sees the stored question/answer alongside the next review form. |
| ChangeRequestReplyHistory.test.tsx | AC-007.13.10 | Field and legacy whole-request rounds remain visible together. |
| ChangeRequestReplyHistory.test.tsx | AC-007.13.11 | Answered field shows awaiting review instead of requiring another answer. |

Existing query test AC-007.3.1 now checks history mapping as well as request version.
The shared fixture file gains a synthetic reply round. New total: 349 application tests;
the existing 86 database checks are unchanged and were not rerun for this UI-only step.

### Manual walkthrough against Supabase

1. Run npm run dev and open an event with an assigned coordinator and a submitted change request.
2. As that coordinator, ask a field question (optionally provisionally approve another field).
3. As the owning organiser, open the event's Requested changes section. Use Reload change
   requests if the page was already open. Confirm each outstanding question has an answer box.
4. Submit with an empty answer: an error should appear and nothing should be saved.
5. Answer every question and send. Confirm the form disappears, the request returns for
   review, the saved answers appear in history, and event values have not changed.
6. As coordinator, reload review. Check the answers are visible. Finalise with approval,
   rejection or a mixture; verify only approved fields change. Alternatively ask again and
   answer again to check both rounds remain visible.
7. For an outdated-tab check, open the same question in two organiser tabs. Send in one,
   then try the old second tab. The second save should fail and ask for reload.

This branch still uses main's Pending review wording; the separate open status-label PR
changes that label to In review. Do not mark all of US7 Done based on this loop alone.
