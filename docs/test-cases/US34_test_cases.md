# US34 Record an audit trail of significant actions (SCRUM-231)

Updated: 22 October 2026. Code-first development; this is not a TDD record.

Design, scope and follow-ups: [US34 documentation](../us34-audit-trail.md). Migration: `0101_event_audit_log.sql` (applied to shared Supabase).

## Acceptance criteria

- AC-034.1: Submission, approval or rejection, coordinator assignment or reassignment, significant information changes (with old and new values), venue booking decisions, equipment reservation changes, safety check outcomes, confirmation, rescheduling and cancellation are recorded with the user, the action, the affected item and the time.
- AC-034.2: No application user can edit or delete an audit record.
- AC-034.3: The assigned Event Coordinator and the Coordinator Lead can view an event's audit records in time order.
- AC-034.4: Event Organisers and Attendees cannot view audit records.

Safety check outcomes (part of AC-034.1) are not recorded yet: US44 is not built. Rescheduling is recorded for changes to the event dates only.

## Database tests (21)

File: `backend/supabase/tests/event_audit_log.sql`, run last by `backend/supabase/tests/run_change_request_review.sh`. Disposable database, real permissions.

| ID | Type | What is tested |
|---|---|---|
| AC-034.1.1 | Boundary | Creating events records nothing |
| AC-034.1.2 | Happy path | Submission records the Organiser, action, event and old/new status |
| AC-034.1.3 | Happy path | Approval and rejection record the deciding Coordinator |
| AC-034.1.4 | Happy path | Assignment and reassignment record the Lead and old/new Coordinator |
| AC-034.1.5 | Happy path | A significant change records only changed fields with old/new values |
| AC-034.1.6 | Happy path | A date change records one rescheduling |
| AC-034.1.7 | Boundary | A change to a field not listed (name) records nothing |
| AC-034.1.8 | Boundary | Editing a draft records nothing |
| AC-034.1.9 | Happy path / boundary | A venue booking decision is recorded; an expiring hold is not |
| AC-034.1.10 | Happy path / boundary | Equipment line creation and reservation recorded; an unrelated note edit is not |
| AC-034.1.11 | Happy path | Confirmation and cancellation recorded |
| AC-034.1.12 | Boundary | A change with no signed-in user records no actor |
| AC-034.2.1 | Failure | Even the table owner cannot update, delete or truncate a record |
| AC-034.2.2 | Failure | Signed-in users have no write grant; anonymous callers cannot read |
| AC-034.3.1 | Happy path | Assigned Coordinator and Lead see all of an event's records |
| AC-034.3.2 | Happy path | Records come back in time order |
| AC-034.3.3 | Happy path | A record shows the actor's name |
| AC-034.3.4 | Failure | An unassigned Coordinator is refused, not shown an empty list |
| AC-034.4.1 | Failure | Organiser and Attendee are refused |
| AC-034.4.2 | Failure | The Organiser reads no rows directly from the table |
| AC-034.4.3 | Failure / conflict | Direct table reads follow the same rule as the function |

## Frontend tests (15)

| ID | Type | What is tested | File |
|---|---|---|---|
| AC-034.3.5 | Service | Records read in one call, database order kept | `features/events/audit/__tests__/auditService.test.ts` |
| AC-034.3.6 | Service / failure | Empty answer is an empty trail; failed or malformed read is reported and logged | Same |
| AC-034.4.4 | Service / failure | A refusal is reported as not allowed, never as an empty trail | Same |
| AC-034.3.7 | Unit | Known action titles; an unknown action still reads as words | `.../auditDescription.test.ts` |
| AC-034.3.8 | Unit | Old and new values shown, dates in Singapore time | Same |
| AC-034.3.9 | Unit / boundary | Identifiers are never shown | Same |
| AC-034.3.10 | Unit / boundary | A blank venue note is not shown | Same |
| AC-034.3.11 | Component | Each record shows action, actor, time and change in order | `.../AuditTrailCard.test.tsx` |
| AC-034.3.12 | Component / boundary | An event with no records says so | Same |
| AC-034.3.13 | Component | The trail reloads when the page refreshes | Same |
| AC-034.4.5 | Component / failure | A refused read shows the refusal, not an empty trail | Same |
| AC-034.4.6 | Component / failure | A failed read shows an error, not an empty trail | Same |
| AC-034.3.14 | Page | The assigned Coordinator and the Lead see the card | `features/events/__tests__/AuditTrailPage.test.tsx` |
| AC-034.4.7 | Page / failure | An unassigned Coordinator, Organiser and other roles do not | Same |

Next IDs: AC-034.1.13, .2.3, .3.15, .4.8.

## Results

- Database: full suite passed on 22 October 2026 (`docs/test-evidence/us34/database-audit-log.log`, 21 AC-034 checks).
- Frontend: 177 files / 1,530 tests passed; typecheck, lint and build passed (`frontend-tests.log`, `lint.log`, `build.log`).
- Forced breaks (each failed as expected, exact code restored byte for byte, then passed):
  - AC-034.2.1: the row-level update/delete trigger was never created. `AC-034.2.1-forced-break.log`, `AC-034.2.1-restored-pass.log`.
  - AC-034.4.4 and AC-034.4.5: a refusal (42501) was returned as an empty trail. Two tests failed. `AC-034.4.4-forced-break.log`, `AC-034.4.4-restored-pass.log`.
  No broken code was retained and no test was changed.
- Manual: M1–M3 passed, reported by the tester on 28 October 2026 (see below). Exact event and account IDs were not provided.

## Manual checks (shared Supabase, 0101 applied; all passed)

Use each role's own account. Open the event at `/requests/<id>` and reload after each action.

| Group | Covers | Steps | Expected | Status |
|---|---|---|---|---|
| M1 | AC-034.1 | Organiser submits a draft; the Lead assigns a Coordinator; the assigned Coordinator approves | Audit trail lists "submitted", "coordinator assigned" and "approved" in that order, each with the actor's name and a Singapore-time timestamp | Pass |
| M2 | AC-034.3 | Open the event as the assigned Coordinator, then as the Lead | Both see the Audit trail card with the same entries | Pass |
| M3 | AC-034.4 | Open the event as the Organiser | No Audit trail card | Pass |

Kept to three because the database and frontend tests already cover the triggers (AC-034.1.1–12), immutability (.2.1–2) and every role refusal (.3.4, .4.1–7). The manual pass only shows they work against the shared Supabase with real accounts.

Record results only as Jaydon (or the tester) reports them.
