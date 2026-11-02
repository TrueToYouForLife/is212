# US4 — Review and Approve/Reject an Event Request

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

## Existing cases (69 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-004.1.1 | 1 | Unit — Happy path | drafts are excluded — an unsubmitted draft is the organiser private working copy | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L44) |
| AC-004.1.2 | 1 | Unit — Happy path | maps database columns onto the shape the UI renders | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L52) |
| AC-004.1.3 | 1 | Unit — Negative | a database error is reported to the user without leaking the schema | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L86) |
| AC-004.1.4 | 1 | Component — Happy path | shows every detail the organiser supplied | [frontend/src/features/events/__tests__/RequestDetails.test.tsx](../../frontend/src/features/events/__tests__/RequestDetails.test.tsx#L35) |
| AC-004.1.5 | 1 | Component — Happy path / Boundary | optional details the organiser left blank read as a dash, not an empty cell | [frontend/src/features/events/__tests__/RequestDetails.test.tsx](../../frontend/src/features/events/__tests__/RequestDetails.test.tsx#L62) |
| AC-004.1.6 | 1 | Component — Happy path | an earlier review note is shown only when one exists | [frontend/src/features/events/__tests__/RequestDetails.test.tsx](../../frontend/src/features/events/__tests__/RequestDetails.test.tsx#L83) |
| AC-004.2.1 | 2 | Unit — Happy path | every status is covered by the transition table | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L17) |
| AC-004.2.2 | 2 | Unit — Happy path | a submitted request can be taken under review | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L25) |
| AC-004.2.3 | 2 | Unit — Negative | a submitted request cannot jump straight to approved | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L29) |
| AC-004.2.4 | 2 | Unit — Happy path | a request under review can be returned to the organiser for more detail | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L34) |
| AC-004.2.5 | 2 | Unit — Happy path | a completed request is terminal and has no next step | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L39) |
| AC-004.2.6 | 2 | Unit — Happy path | a cancelled request is terminal and has no next step | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L40) |
| AC-004.2.7 | 2 | Unit — Negative | a rejected request is terminal and has no next step | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L41) |
| AC-004.2.8 | 2 | Unit — Happy path | a coordinator can approve a request that is under review | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L52) |
| AC-004.2.9 | 2 | Unit — Negative | an organiser cannot approve their own request | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L56) |
| AC-004.2.10 | 2 | Unit — Happy path | an organiser can submit their own draft | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L61) |
| AC-004.2.11 | 2 | Unit — Negative | a coordinator cannot submit an organiser draft on their behalf | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L65) |
| AC-004.2.12 | 2 | Unit — Negative | an organiser cannot touch another organiser request | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L69) |
| AC-004.2.13 | 2 | Unit — Happy path | an organiser can withdraw their own request | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L73) |
| AC-004.2.14 | 2 | Unit — Negative | a newly submitted request offers approve, return, reject, withdraw and cancel | [frontend/src/features/events/__tests__/organisationEventService.test.ts](../../frontend/src/features/events/__tests__/organisationEventService.test.ts#L112)<br>[frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L79) |
| AC-004.2.15 | 2 | Unit — Negative | a request under review offers approve, return and reject | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L87) |
| AC-004.2.16 | 2 | Unit — Negative | a rejected request offers nothing | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L94) |
| AC-004.2.17 | 2 | Unit — Happy path | a coordinator can take a submitted request under review | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L104) |
| AC-004.2.18 | 2 | Unit — Negative | an illegal transition is refused before it reaches the database | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L119) |
| AC-004.2.19 | 2 | Unit — Negative | an organiser cannot approve their own request | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L135) |
| AC-004.2.20 | 2 | Unit — Happy path | the update is scoped to the status we believe the request is in | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L184) |
| AC-004.2.21 | 2 | Unit — Happy path | a request another coordinator has already moved is reported, not overwritten | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L198) |
| AC-004.2.22 | 2 | Component — Happy path | a submitted request offers immediate decisions without Start review | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L24) |
| AC-004.2.23 | 2 | Component — Negative | a request under review offers Approve, Reject and Return buttons | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L33) |
| AC-004.2.24 | 2 | Component — Happy path | Approve records the decision as the coordinator and reports the new status | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L41) |
| AC-004.2.25 | 2 | Component — Happy path | a decided request offers no further review buttons | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L54) |
| AC-004.2.26 | 2 | Component — Negative / Regression | a failed decision reports an error and leaves the buttons usable for a retry | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L61) |
| AC-004.2.27 | 2 | Unit — Happy path | a direct approved decision uses one atomic RPC | [frontend/src/features/events/__tests__/directEventReview.test.ts](../../frontend/src/features/events/__tests__/directEventReview.test.ts#L11) |
| AC-004.2.28 | 2 | Unit — Negative | a direct rejected decision uses one atomic RPC | [frontend/src/features/events/__tests__/directEventReview.test.ts](../../frontend/src/features/events/__tests__/directEventReview.test.ts#L11) |
| AC-004.2.29 | 2 | Unit — Happy path | a direct submitted decision uses one atomic RPC | [frontend/src/features/events/__tests__/directEventReview.test.ts](../../frontend/src/features/events/__tests__/directEventReview.test.ts#L11) |
| AC-004.2.30 | 2 | Unit — Negative | a stale submitted request reports failure without a fallback write | [frontend/src/features/events/__tests__/directEventReview.test.ts](../../frontend/src/features/events/__tests__/directEventReview.test.ts#L21) |
| AC-004.2.31 | 2 | Integration — Negative | organiser cannot invoke direct coordinator review | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L13) |
| AC-004.2.32 | 2 | Integration — Happy path | coordinator approves a submitted request in one operation | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L17) |
| AC-004.2.33 | 2 | Integration — Negative | already decided request cannot be overwritten | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L19) |
| AC-004.2.34 | 2 | Integration — Negative | a final-step failure is reported by the atomic operation | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L25) |
| AC-004.2.35 | 2 | Integration — Negative | failed decision does not leave the request started or stamped | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L29) |
| AC-004.3.1 | 3 | Unit — Negative | a rejection without a reason is refused | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L149) |
| AC-004.3.2 | 3 | Unit — Negative | a rejection with a reason records the note (also AC-004.5) | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L167) |
| AC-004.3.3 | 3 | Component — Negative | the reason typed in the box is sent with a rejection | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L75) |
| AC-004.3.4 | 3 | Component — Negative | a rejection refused for having no reason explains why and does not complete | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L87) |
| AC-004.3.5 | 3 | Component — Happy path | the reason box clears after a successful decision | [frontend/src/features/events/__tests__/ReviewActions.test.tsx](../../frontend/src/features/events/__tests__/ReviewActions.test.tsx#L98) |
| AC-004.3.6 | 3 | Unit — Happy path | a direct submitted decision requires a reason before contacting the database | [frontend/src/features/events/__tests__/directEventReview.test.ts](../../frontend/src/features/events/__tests__/directEventReview.test.ts#L27) |
| AC-004.3.7 | 3 | Unit — Negative | a direct rejected decision requires a reason before contacting the database | [frontend/src/features/events/__tests__/directEventReview.test.ts](../../frontend/src/features/events/__tests__/directEventReview.test.ts#L27) |
| AC-004.3.8 | 3 | Integration — Negative | database rejects direct clarification without a reason | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L34) |
| AC-004.3.9 | 3 | Integration — Happy path / Regression | direct clarification retains the question for organiser display | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L38) |
| AC-004.4.1 | 4 | Integration — Happy path | approval queues one email to the organiser with the outcome | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L190) |
| AC-004.4.2 | 4 | Integration — Negative | rejection email carries the coordinator's reason | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L204) |
| AC-004.4.3 | 4 | Integration — Happy path | a return is logged but does not queue an email | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L194) |
| AC-004.4.4 | 4 | Integration — Happy path | no signed-in user can read queued emails or addresses | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L130) |
| AC-004.4.5 | 4 | Integration — Happy path | an organiser without an email is still decided on, with nothing queued | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L213) |
| AC-004.4.6 | 4 | Integration — Negative | direct approval and rejection each queue an email | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L44) |
| AC-004.5.1 | 5 | Unit — Happy path | lists the decision, reason and reviewer for a request, newest first | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L223) |
| AC-004.5.2 | 5 | Unit — Negative | a malformed request ID returns unavailable without querying the database | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L262) |
| AC-004.5.3 | 5 | Unit — Negative | a failed history read is reported without leaking the schema | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L269) |
| AC-004.5.4 | 5 | Component — Happy path | shows each decision with its outcome, reason, reviewer and time | [frontend/src/features/events/__tests__/DecisionHistory.test.tsx](../../frontend/src/features/events/__tests__/DecisionHistory.test.tsx#L25) |
| AC-004.5.5 | 5 | Component — Happy path | an approval without a reason says so explicitly rather than showing a blank | [frontend/src/features/events/__tests__/DecisionHistory.test.tsx](../../frontend/src/features/events/__tests__/DecisionHistory.test.tsx#L39) |
| AC-004.5.6 | 5 | Component — Happy path / Boundary | a request with no decisions yet shows an empty-state message | [frontend/src/features/events/__tests__/DecisionHistory.test.tsx](../../frontend/src/features/events/__tests__/DecisionHistory.test.tsx#L45) |
| AC-004.5.7 | 5 | Integration — Happy path | approval recorded with who decided, from which status, and when | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L74) |
| AC-004.5.8 | 5 | Integration — Happy path | an earlier return and its reason survive a later approval | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L83) |
| AC-004.5.9 | 5 | Integration — Happy path | starting a review and administrator changes are not decisions | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L89) |
| AC-004.5.10 | 5 | Integration — Negative | decisions cannot be inserted, edited or deleted by a signed-in user | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L107) |
| AC-004.5.11 | 5 | Integration — Happy path | the decision log, including reviewer identity, is staff-only | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L146) |
| AC-004.5.12 | 5 | Integration — Negative | a refused transition leaves no decision record | [backend/supabase/tests/review_decisions_test.sql](../../backend/supabase/tests/review_decisions_test.sql#L161) |
| AC-004.5.13 | 5 | Integration — Happy path / Regression | direct decisions retain one audit entry each including clarification actor and reason | [backend/supabase/tests/direct_event_review.sql](../../backend/supabase/tests/direct_event_review.sql#L50) |
