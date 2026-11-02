# US22 — Withdraw a submitted request

Catalogue checked: 2 November 2026.

## Scope and evidence

This catalogue maps existing test-source IDs to their AC numbers, assertions and files.
Descriptions follow the current test titles/assertion labels; parameter rows keep their
existing IDs. Counts are unique source IDs, not a count of runtime executions or a new
coverage measurement. Shared cross-story assertions may appear in both relevant catalogues.

This is a documentation update. It does not claim fresh automated passes, manual
acceptance, deployed migrations or email delivery. Unit tests exercise pure logic or mock
external services; component tests render UI with their source's mocks; SQL/shell
integration tests use the disposable database runners. Existing evidence and historical
checkpoints remain in their original documents. Manual results are valid only where an
actual execution/report is recorded.

## Existing cases (34 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-022.1.1 | 1 | Unit — Happy path | a submitted request can be withdrawn | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L48) |
| AC-022.1.2 | 1 | Unit — Happy path | a request already taken under review can be withdrawn | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L54) |
| AC-022.1.3 | 1 | Unit — Happy path | the assigned coordinator is offered the action on both states | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L58) |
| AC-022.1.4 | 1 | Unit — Happy path | "Withdraw request" appears among a reviewer's actions, as a danger action | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L63) |
| AC-022.1.5 | 1 | Unit — Happy path | the organiser is not offered it — withdrawal is the reviewer's decision | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L69) |
| AC-022.1.6 | 1 | Unit — Happy path | a withdrawal reaches the database as a plain status update, not the review RPC | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L76) |
| AC-022.1.7 | 1 | Unit — Happy path | the update is filtered on the status the reviewer was shown | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L89) |
| AC-022.1.8 | 1 | Unit — Happy path | a request decided in the meantime is reported, not overwritten | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L106) |
| AC-022.1.9 | 1 | Unit — Negative | a withdrawal with no reason is refused before any query runs | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L115) |
| AC-022.1.10 | 1 | Unit — Negative | a permission refusal from the database is reported as one | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L126) |
| AC-022.1.11 | 1 | Integration — Happy path | a request awaiting a decision can be withdrawn from either review state | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L48) |
| AC-022.1.12 | 1 | Integration — Negative | the organiser cannot withdraw their own request — their close is cancel | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L71) |
| AC-022.1.13 | 1 | Integration — Negative | a coordinator who is not the assignee cannot withdraw the request | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L78) |
| AC-022.1.14 | 1 | Integration — Negative | an approved event is refused by the transition rule, not the permission one | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L85) |
| AC-022.1.15 | 1 | Integration — Happy path | the assigned coordinator withdraws from both submitted and under_review | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L101) |
| AC-022.1.16 | 1 | Integration — Happy path | the withdrawal is stamped with who closed the request and when | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L106) |
| AC-022.2.1 | 2 | Unit — Happy path | the status reads as "Withdrawn" | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L139) |
| AC-022.2.2 | 2 | Unit — Negative | the organiser sees "Withdrawn", not "In review" or a rejection | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L143) |
| AC-022.2.3 | 2 | Unit — Happy path | it is its own value, distinct from the four the criterion names | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L148) |
| AC-022.2.4 | 2 | Unit — Happy path | it is also distinct from cancelled, which means something else | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L157) |
| AC-022.2.5 | 2 | Unit — Happy path | withdrawn is terminal — reviving a request means filing a new one | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L164) |
| AC-022.2.6 | 2 | Unit — Happy path | nothing can be withdrawn once a decision has been made | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L170) |
| AC-022.2.7 | 2 | Unit — Happy path | a withdrawn request offers no further review actions | [frontend/src/features/events/__tests__/withdrawRequest.test.ts](../../frontend/src/features/events/__tests__/withdrawRequest.test.ts#L179) |
| AC-022.2.8 | 2 | Integration — Happy path | 'withdrawn' is an accepted event status | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L43) |
| AC-022.2.9 | 2 | Integration — Negative | a request already decided or not yet submitted cannot be withdrawn | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L55) |
| AC-022.2.10 | 2 | Integration — Happy path | withdrawn is terminal — reviving a request means filing a new one | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L61) |
| AC-022.2.11 | 2 | Integration — Happy path | the decision log records a withdrawal as its own outcome, with its reason | [backend/supabase/tests/notice_channels_us4.sql](../../backend/supabase/tests/notice_channels_us4.sql#L38)<br>[backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L117) |
| AC-022.2.12 | 2 | Integration — Happy path | the log keeps the state the request was withdrawn from | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L122) |
| AC-022.2.13 | 2 | Integration — Negative | a withdrawal is not recorded as an approval, rejection or return | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L128) |
| AC-022.2.14 | 2 | Integration — Happy path | no email is queued for a withdrawal, matching the existing return behaviour | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L136) |
| AC-022.2.15 | 2 | Integration — Happy path | re-withdrawing an already withdrawn request changes nothing | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L152) |
| AC-022.2.16 | 2 | Integration — Negative | a withdrawn request cannot be approved afterwards | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L158) |
| AC-022.2.17 | 2 | Integration — Negative | the refused second attempt adds no second decision record | [backend/supabase/tests/withdraw_submitted_request.sql](../../backend/supabase/tests/withdraw_submitted_request.sql#L166) |
| AC-022.2.18 | 2 | Integration — Happy path / Regression | replaying 0066 changes no withdrawn event and logs no extra decision | [backend/supabase/tests/run_change_request_review.sh](../../backend/supabase/tests/run_change_request_review.sh#L276) |
