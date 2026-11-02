# US38 — Event status lifecycle

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

Related implementation notes: [us38-status-lifecycle.md](../us38-status-lifecycle.md).

## Existing cases (57 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-038.1.1 | 1 | Unit — Happy path / Boundary | exactly the 14 agreed statuses exist, each with a label | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L10) |
| AC-038.1.2 | 1 | Integration — Happy path | 'postponed' is an accepted event status | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L31) |
| AC-038.1.3 | 1 | Integration — Negative | a status outside the 14 is refused (Returned for Clarification is submitted + a note, not a stored status) | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L190) |
| AC-038.1.4 | 1 | Integration — Happy path | all 14 statuses are in the CHECK constraint | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L197) |
| AC-038.2.1 | 2 | Unit — Happy path | Planning, In Preparation and Confirmed can be postponed | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L20) |
| AC-038.2.2 | 2 | Unit — Happy path | a postponed event can only be re-planned or cancelled | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L26) |
| AC-038.2.3 | 2 | Unit — Negative / Boundary | earlier stages and closed events cannot be postponed (boundary) | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L31) |
| AC-038.2.4 | 2 | Unit — Negative | only the Coordinator postpones or resumes; the owning organiser cannot | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L37) |
| AC-038.2.5 | 2 | Unit — Happy path | the Coordinator is offered Postpone on a confirmed event and Resume on a postponed one | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L53) |
| AC-038.2.6 | 2 | Integration / Unit — Happy path | no other role can postpone or resume, but the owner can still cancel a postponed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L39)<br>[frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L44) |
| AC-038.2.7 | 2 | Integration — Negative | early or closed events cannot be postponed, and postponed cannot skip back to Confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L47) |
| AC-038.2.8 | 2 | Integration — Negative | the organiser cannot postpone their own confirmed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L55) |
| AC-038.2.9 | 2 | Integration — Negative | an Approved event cannot be postponed even by its Coordinator | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L61) |
| AC-038.2.10 | 2 | Integration — Negative | a completed event cannot be postponed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L65) |
| AC-038.2.11 | 2 | Integration — Happy path | the Coordinator postpones a confirmed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L70) |
| AC-038.2.12 | 2 | Integration — Negative | the organiser cannot resume a postponed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L76) |
| AC-038.2.13 | 2 | Integration — Happy path | the Coordinator resumes a postponed event into Planning | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L82) |
| AC-038.2.14 | 2 | Integration — Negative | a completed, cancelled, rejected or withdrawn event cannot move to any status | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L207) |
| AC-038.2.15 | 2 | Integration — Negative | a rejected event cannot be revived to Confirmed by the database | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L214) |
| AC-038.2.16 | 2 | Integration — Negative | a cancelled event cannot move back to Planning | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L218) |
| AC-038.2.17 | 2 | Integration — Negative | a postponed event cannot jump straight back to Confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L222) |
| AC-038.2.18 | 2 | Integration — Negative | a Coordinator who is not assigned to the event cannot postpone it | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L229) |
| AC-038.3.1 | 3 | Integration — Happy path | approving an event creates no venue booking and no equipment booking | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L247) |
| AC-038.4.1 | 4 | Integration — Happy path | no equipment requirement can be added to a Completed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L255) |
| AC-038.4.2 | 4 | Integration — Happy path | no equipment requirement can be added to a Cancelled event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L259) |
| AC-038.4.3 | 4 | Integration — Negative | no equipment requirement can be added to a Rejected event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L263) |
| AC-038.4.4 | 4 | Integration — Happy path | no equipment requirement can be added to a Withdrawn event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L267) |
| AC-038.4.5 | 4 | Integration — Happy path | a Postponed event takes no planning actions until it is resumed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L271) |
| AC-038.5.1 | 5 | Integration — Happy path | postponing a confirmed event notifies its Organiser once | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L151) |
| AC-038.5.2 | 5 | Integration — Happy path | completing an event is not announced as it no longer being confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L156) |
| AC-038.5.3 | 5 | Integration — Happy path | cancelling a confirmed event notifies its Organiser | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L310) |
| AC-038.5.4 | 5 | Integration — Negative | an event that was never Confirmed (cancelled from another status) sends no such notice | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L314) |
| AC-038.5.5 | 5 | Integration — Happy path | approving a significant change moves a Confirmed event back to Planning, with the change applied | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L354) |
| AC-038.5.6 | 5 | Integration — Happy path | the Organiser is notified when the approved change takes the event out of Confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L360) |
| AC-038.5.7 | 5 | Integration — Happy path | the move is in the audit trail with the approving Coordinator as actor | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L366) |
| AC-038.5.8 | 5 | Integration — Happy path | approving an ordinary change leaves the event Confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L369) |
| AC-038.5.9 | 5 | Integration — Negative | rejecting a significant change leaves the event Confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L372) |
| AC-038.5.10 | 5 | Integration — Happy path | an event not yet Confirmed is not moved and sends no such notice | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L377) |
| AC-038.5.11 | 5 | Integration — Happy path | nobody moves a Confirmed event back to Planning by hand | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L384) |
| AC-038.5.12 | 5 | Unit — Happy path | Confirmed can go back to Planning in the rules, but no actor can do it by hand | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L82) |
| AC-038.6.1 | 6 | Unit — Happy path | an event that has ended can be marked completed | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L63) |
| AC-038.6.2 | 6 | Unit — Negative / Boundary | an event still running or in the future cannot (boundary: ending exactly now counts as ended) | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L68) |
| AC-038.6.3 | 6 | Unit — Happy path | with no end date, the button is withheld rather than guessed | [frontend/src/features/events/__tests__/postponedStatus.test.ts](../../frontend/src/features/events/__tests__/postponedStatus.test.ts#L74) |
| AC-038.6.4 | 6 | Integration — Negative | the Coordinator cannot complete an event that has not ended | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L106) |
| AC-038.6.5 | 6 | Integration — Happy path | the Coordinator completes an event once it has ended | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L110) |
| AC-038.7.1 | 7 | Integration — Happy path | an event that ended 3 days ago, or has not ended, is left Confirmed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L119) |
| AC-038.7.2 | 7 | Integration — Happy path | an event that ended 8 days ago becomes Completed automatically | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L122) |
| AC-038.7.3 | 7 | Integration — Happy path | ended 7 days less a minute ago stays Confirmed; ended 7 days and a minute ago becomes Completed | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L292) |
| AC-038.7.4 | 7 | Integration — Happy path / Regression | running the job again completes nothing more (idempotent) | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L295) |
| AC-038.7.5 | 7 | Integration — Happy path | only Confirmed events auto-complete; a Postponed one is left alone | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L298) |
| AC-038.8.1 | 8 | Integration — Negative | the Coordinator cannot edit the details of a Completed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L276) |
| AC-038.8.2 | 8 | Integration — Negative | the Organiser cannot edit the details of a Completed event | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L280) |
| AC-038.8.3 | 8 | Integration — Happy path | a Completed event stays readable as a historical record | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L283) |
| AC-038.8.4 | 8 | Component — Happy path | a Postponed event stays in the active list; a Completed one drops out of it | [frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx](../../frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx#L193) |
| AC-038.9.1 | 9 | Integration — Happy path | the automatic completion is in the audit trail with no invented actor | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L127) |
| AC-038.9.2 | 9 | Integration — Happy path | postponing is recorded once, with the Coordinator as actor | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L135) |
| AC-038.9.3 | 9 | Integration — Happy path | a Coordinator completion is recorded with the Coordinator as actor | [backend/supabase/tests/event_status_lifecycle.sql](../../backend/supabase/tests/event_status_lifecycle.sql#L141) |
