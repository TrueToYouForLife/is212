# US17 - Assign / Reassign an Event Coordinator

## Coordinator request grouping — us17-assigned-requests-ui

The coordinator Requests page separates **Assigned to me** from **Other event
requests**, with personal assignments first and an **Assigned to you** label.
Both groups preserve the service's ordering; refresh and normal polling update
membership after reassignment. Empty sections show an explanatory message.
Lead, organiser and Operations Manager views retain their existing presentation.
This is a frontend presentation change, not a new access policy or migration.

AC-017.4.6 is one grouped UI TDD case covering section order, stable request order,
labels, links, reassignment after refresh and empty results. Jaydon confirmed the
red CI stage; the green implementation keeps the test unchanged. Green validation
is pending and must be recorded separately from the previous red evidence.

## Equipment access follow-up — us17-equipment-access

Scope: AC4 / SCRUM-160, transferring legacy equipment booking and line management
to the current coordinator. Yuanlong owns the equipment feature and should review
before merge. Migration 0048 is claimed; it is not deployed. The separate 0047 venue
PR is not part of this branch.

- AC-017.4.4 (TDD): red allowed the previous coordinator to cancel after reassignment.
  The unchanged test now verifies old/unrelated coordinators cannot cancel, respond
  to alternatives, create bookings or add lines, while the current coordinator can.
  Original requester attribution remains intact.
- Green implementation: 0048 replaces six legacy RLS policies, reusing the existing
  assigned-coordinator helper. Two triggers protect non-status fields from direct
  coordinator edits. Technical Support/manager reads remain available; reservation
  functions and stock-allocation rules are unchanged.
- AC-017.4.5 (additional regression, not TDD): direct decisions cannot overwrite
  the original requester or staff-reserved quantities.
- Validation: full disposable SQL suite passed on 9 October 2026. An initial guard
  also blocked US13's internal quantity update (AC-013.6.10); making it invoker-based
  and limiting it to direct authenticated coordinator updates fixed that interaction.
  Both new cases and existing equipment regressions pass. CI is pending; frontend
  files are unchanged and frontend checks were not rerun locally for this DB change.

Record AC-017.4.4 under TDD and AC-017.4.5 in the automated test-case documentation.
Earlier totals below describe their historical checkpoints.

Owner: Jaydon. Jira: SCRUM-61. Slice 1 branch: `us17slice1`.

## Slice 1 scope

Backend support for AC1's Lead-only assignment and event reading, and AC2's valid
coordinator assignment rules. The application recognises a Coordinator Lead profile
and displays the role label. The assignment queue and picker UI are not implemented.

`0038_coordinator_lead_assignment.sql` extends the profile role constraint, adds a
non-draft event SELECT policy and replaces the existing assignment function and guard.
It preserves the existing role restrictions against self-service profile changes.
It does not alter existing users' roles or unrelated venue/equipment permissions.

## Tests and documentation

Frontend: `frontend/src/features/auth/__tests__/coordinatorLeadProfile.test.ts`.
Database: `backend/supabase/tests/coordinator_assignment.sql`, included in the existing
Docker runner. Fixtures run inside a transaction that is rolled back. Auth interfaces
are simulated, but PostgreSQL constraints, role checks and RLS are real.

- AC-017.1.1: application recognises a Lead profile (frontend).
- AC-017.1.2: administrator can provision a Lead profile (SQL).
- AC-017.1.3-4: organiser denied assignment through RPC and direct update.
- AC-017.1.5-6: coordinator denied self-assignment through RPC and direct update.
- AC-017.1.7-8: legacy Operations Manager denied assignment through both routes.
- AC-017.1.9: Lead reads an unassigned submitted event's details; another organiser's
  draft is not exposed by the new policy.
- AC-017.2.1: Lead assigns a submitted event; organiser and status remain unchanged.
- AC-017.2.2: draft assignment rejected.
- AC-017.2.3: missing coordinator selection rejected.
- AC-017.2.4: organiser cannot be selected as coordinator.
- AC-017.2.5: nonexistent coordinator rejected.
- AC-017.2.6: one coordinator can hold multiple submitted events.
- AC-017.2.7: nonexistent event rejected.

AC2 rejection checks also verify that the draft and existing assignment stay unchanged.
IDs are unique across SQL and frontend; next available IDs are AC-017.1.10 and AC-017.2.8.

Recorded red-green cycles: AC-017.1.1, .1.2, .1.9 and .2.1. The remaining twelve tests
passed when added and are additional regression coverage, not TDD cycles. The shared
Google Docs TDD tab and PR hold red/green CI evidence. The automated test-case tracker
holds additional coverage. This document is a code/test index, not a substitute for CI logs.

Local final checks: 762 frontend tests pass, one TODO; the full database runner passes,
including all 15 US17 SQL cases. Typecheck, lint and build pass. Existing React test
warnings and the build bundle-size warning remain. CI must pass on the final PR head.

## Existing tests affected

US7 assignment checks now use a separate Lead fixture. The Manager fixture stays for
unrelated revalidation/history checks. US13 reassignment setup similarly uses a new
Lead fixture, retaining its Manager checks. The database runner reapplies 0038 after
the historical 0008 replay so subsequent tests exercise current assignment rules.

## Deployment and remaining slices

After review/merge, apply 0038 after 0037 using the team's deployment process. No shared
Supabase migration was performed by these tests. Administrators must provision the
appropriate Lead account explicitly; old Manager accounts lose assignment authority.
Do not rerun older migrations to change a user's role.

Once deployed, treat 0038 as immutable: future changes need a newly claimed migration.
Coordinate retirement or conversion of legacy Manager accounts with owners of other
features; no bulk conversion is included here.

## Slice 2 — reassignment rules, event access and history

Branch: `us17slice2`. Claimed migration: `0039_coordinator_reassignment.sql`.
Three grouped SQL tests were added through separate red/green cycles:

- AC-017.3.1: immediate active-event reassignment; completed/cancelled events refuse
  reassignment without changing their existing coordinator. Red: completed event allowed it.
- AC-017.4.1: old coordinator cannot approve after reassignment, denied approval leaves
  the event unchanged, and new coordinator can approve. Red: old coordinator could approve.
- AC-017.6.1: Lead reads actor, previous/new coordinator and time for assignment and
  reassignment, with no extra entries for failed attempts or unchanged selections.
  Red: history was not stored.

All three unchanged tests pass locally. Full database runner passes; frontend has 762
passed and one TODO. No additional non-TDD tests were added in this slice.
CI links belong in the shared TDD record and PR. Total US17: one frontend and 18 SQL cases.

0039 guards coordinator updates on the events table, covering original-request review
through the RPC and direct updates. Existing US4/US7 review fixtures now assign their
reviewer; their assertions are unchanged. This does not claim a full audit of all venue
and equipment actions in other stories. Existing US7 assigned-review checks remain.

History is trigger-written in the assignment transaction. Only Leads can read it through
authenticated access; browser writes are revoked. No backfill or invented administrator
identity is recorded. Referenced events/profiles cannot be deleted while history references
them. History UI is not included. The runner reapplies 0039 after historical 0008/0038 replay.

Jaydon confirmed 0039 was applied to shared Supabase on 6 October 2026. Do not edit it
after deployment. The AC's withdrawn-event wording needs confirming against
the team's withdrawal workflow: there is no separate withdrawn event status in the schema.
Remaining: queue/picker UI, notification triggers, cross-feature integration and live
acceptance checks. Do not mark the whole story complete.

## Slice 3 — assignment queue and coordinator dropdown

Branch: `us17slice3`. Scope: Lead queue/basic details (AC1), coordinator selection and
assignment counts/assignment (AC2), and reassignment of eligible events (AC3), with
clear save success/error feedback. Notifications remain slice 4.

First cycle: AC-017.1.10 in `CoordinatorAssignmentQueue.test.tsx`.
Red: no unassigned queue for the Lead. Green: `/requests` renders a Lead-specific
queue containing only submitted requests with an explicitly null coordinator ID.
The shared query now loads that ID; a missing ID is not treated as unassigned.
The queue shows reference/name/purpose/type/start/end/attendance, with Singapore times.
Navigation and the home page link to it; existing polling, refresh/error/loading handling
are reused, and an empty queue has an explicit message. Other roles retain their views.

Local checks: 763 frontend tests passed, one TODO; full database suite, typecheck, lint
and build passed. Existing bundle-size warning remains. No additional non-TDD tests.
The new test mocks the service: it verifies queue presentation, not a live Supabase flow.
Subsequent cycles:

- AC-017.2.8 (SQL): Lead-only coordinator dropdown data, names and active counts including
  zero. Red: function missing. Green: claimed 0041 adds `list_assignment_coordinators()`.
  Active means submitted/under_review/approved/planning/confirmed; no workload limit imposed.
- AC-017.2.9 (frontend): coordinator selection/counts, disabled save without selection,
  failed save retaining selection, successful retry with exact RPC IDs and queue refresh.
  Red: dropdown missing. Green: real UI/service with mocked Supabase RPC boundary passes.

`coordinatorAssignmentService.ts` validates response shapes and IDs, maps errors and sends
only event/coordinator IDs. `CoordinatorAssignmentForm` prevents duplicate pending saves
and keeps selection after failure. Queue loads coordinator options once per mounted queue,
refreshes them periodically/on focus and after success; errors/empty/loading have explicit
messages. Success refreshes the event list too. Nothing auto-retries assignment writes.

Latest local checks: 764 frontend tests pass, one TODO; full database suite, typecheck,
lint and build pass. No new tests outside the three slice 3 TDD cycles so far. Existing
bundle-size warning remains. Total US17 is three frontend tests and 19 SQL cases.
0041 is not confirmed deployed. Apply through the team's migration process before live
testing. Notification work remains slice 4.

Final planned cycle: AC-017.3.2 verifies the current assignee, replacement selection,
failed save preserving the assignment/selection, successful retry and refreshed name/count,
with no completed/cancelled reassignment controls. Red: assigned-events section missing.
Green: shared assignment form/card now supports assigned active events and rejects an
unchanged coordinator selection. Forms reset if a refreshed event has a different assignee.
No extra tests were added outside TDD. Final local suites: 765 frontend passed, one TODO;
full database suite, typecheck, lint and build passed (existing bundle-size warning).
US17 totals: four frontend tests and 19 SQL cases. Slice 3 adds three frontend tests and
one SQL test across four red/green cycles. CI links remain in PR/shared TDD documentation.

### Live acceptance before merging

Confirm 0041 is deployed through the team's migration process (0039 already confirmed).
Run the app from frontend and sign in with an administrator-provisioned Coordinator Lead.
Use separate browser sessions for Lead/Coordinator accounts.

1. Submit a new organiser request. As Lead, open Assignments: verify basic details in
   Unassigned requests, coordinator names/counts and disabled save until selection.
2. Assign it. Verify success, its move to Assigned events, current name and updated count.
3. Select a different coordinator and reassign. Verify updated name/counts, and confirm
   the old coordinator cannot review while the new coordinator can.
4. Verify completed/cancelled events have no reassignment controls. Check assignment
   history in Supabase for both actions; history UI is outside this slice.

These live checks are not yet reported complete. Dropdown errors/failed-save retries are
covered by automated tests; do not disrupt shared Supabase to manufacture failures.

## Slice 4 — assignment notifications (TDD)

Branch: `us17slice4`. Jaydon claimed migration **0046** for this work.
US17 continues with TDD by explicit agreement; the team's code-first approach does
not replace the red/green process for this remaining slice.

### AC-017.5.1 — notify the new coordinator and organiser on assignment

- File: `backend/supabase/tests/coordinator_assignment_notifications.sql`.
- Runs a real assignment as an authenticated Lead in disposable PostgreSQL.
- Checks exactly one pending email with nonblank content for each recipient, and
  an in-app notification record for each. This verifies queued notifications, not
  live email delivery or inbox UI.
- Red (9 October 2026): the existing full SQL suite passed before this test was
  added. With this test appended last, the suite fails because assignment queues
  no emails: `received <NULL>`. The runner exits with code 3 at AC-017.5.1.
- Green (local): 0046 adds `coordinator_assignment_notifications` and its history
  trigger, storing recipient notices and queuing email through the existing outbox.
  The unchanged test and full SQL suite pass. No live email is sent by these tests.
- At the red checkpoint, two frontend runs stalled at startup and were stopped.
  Jaydon subsequently reported frontend CI green and database CI red. No frontend
  files changed. The green checkpoint run with two workers completed five files, but
  progressed very slowly and was stopped without a full result. Verify frontend CI
  on the green commit; the earlier passing CI is not a result for this new commit.
- Green CI evidence goes in the shared TDD record and PR once pushed and verified.

This checkpoint adds one SQL test case (24 US17 cases in total: four frontend,
20 SQL). The green checkpoint adds no tests and does not modify the red test.
0046 remains undeployed. Shared delivery and inbox integration are still unverified.

Implementation: notifications are keyed by history entry and recipient, with a linked
email outbox ID. Both channels default on; administrator-only settings affect future
entries. Browser reads require recipient identity and current event access; writes are
revoked. Generic mail bodies avoid exposing event details after reassignment. No-email
accounts retain the in-app record. Failed notification writes roll back assignment too.
Reassignment/no-op behaviour and permission checks need explicit coverage in the next
checkpoint; supporting code is not itself evidence that those cases were verified.

Historical correction: Jaydon reported the slice 3 UI checks passed before its
merge. The earlier pending-check wording above describes that slice's original
checkpoint; repeat relevant live checks after slice 4 and record actual results.

### Additional regression coverage — AC-017.5.2–3

Jaydon reported green CI for AC-017.5.1 and recorded its TDD result. Two grouped
cases were then added to the same SQL file to verify the existing implementation:

- **AC-017.5.2:** a real reassignment records linked in-app/email notices for the
  replacement coordinator and organiser. Re-selecting the current coordinator,
  selecting an invalid organiser target, and a coordinator attempting self-assignment
  produce no additional notices/history or unintended assignment changes.
- **AC-017.5.3:** authenticated queries verify the owning organiser and current
  coordinator can read their own notices; the previous coordinator, unrelated
  organiser and Lead cannot read them. Browser inserts/updates/deletes, outbox reads
  and channel-setting changes are denied. Anonymous reads are denied too.

Both passed on their first run; the complete disposable SQL suite exited 0.
No implementation changes were needed, and AC-017.5.1 remains unchanged. These
are regression coverage, not manufactured red/green cycles. Record them in the
automated test-case tracker and PR; a short cross-reference in the TDD record is
optional. Frontend files are unchanged; run normal CI on this checkpoint.

### Additional regression coverage — AC-017.5.4–5

Jaydon confirmed CI passed for AC-017.5.2–3. Two further grouped cases verify:

- **AC-017.5.4:** in-app-only, email-only and both-disabled settings control future
  assignment notices and email queue entries. Email-only notices are hidden from
  the coordinator's in-app reads, and earlier records remain unchanged. The
  both-enabled path is already covered by AC-017.5.1.
- **AC-017.5.5:** replaying 0046 preserves the complete settings, notifications,
  assignment history and email outbox. A subsequent reassignment creates exactly
  two notices and no emails, respecting the saved in-app-only setting.

The channel case is in `coordinator_assignment_notifications.sql`; the replay
case is in `coordinator_assignment_notifications_replay.sql`. The runner commits
the notification fixtures within the disposable Docker database, reapplies 0046,
then checks the snapshots and trigger. It never connects to shared Supabase.

Validation on 9 October 2026: the initial run caught a syntax error in the new
test's CASE expression. After correcting the test syntax, the full SQL suite
passed (exit 0). No implementation or migration changes were needed. This is
regression coverage, not a feature red–green cycle; record these cases in the
automated test-case tracker and PR. CI for this new checkpoint is still pending.

Current US17 total: 28 cases (four frontend, 24 SQL), including five notification
cases in slice 4. Actual delivery remains unverified. Whole-story completion also
requires the outstanding cross-feature assignment-access and withdrawn-status
checks described above.

## Follow-up — venue booking access after reassignment

Slice 4 merged in PR #72; Jaydon confirmed its final CI passed and migration 0046
was applied to shared Supabase. This supersedes the earlier deployment/CI-pending
notes. Live notification delivery has not yet been reported verified.

Jaydon authorised local work on the venue handover adjustment, with Nicole's
agreement required before it reaches main. US17 AC4 / SCRUM-160 requires access
to follow the current assignment; US11 AC8 currently names the person who placed
the hold, so the two stories need consistent wording. Migration **0047** is claimed
for the fix but has not been created or applied.

### AC-017.4.2 — venue booking management follows reassignment

- File: `backend/supabase/tests/coordinator_assignment_venue_access.sql`.
- One grouped SQL case creates a hold as Coordinator A and reassigns the event
  to B through the real Lead function. A and an unrelated coordinator must not
  submit/cancel the booking or delete its slots. B must be able to submit and
  release it, preserving the original requester, event and venue.
- Red, local (9 October 2026): the full database runner reaches this test after
  the earlier suites, then exits 3: the previous coordinator can still perform
  `pending_approval` on the reassigned booking.
- No production code or migration changes yet. This is one new TDD case; the
  frontend list/action adjustment will need its own focused coverage.
- Existing full frontend suite: 88 files passed, 864 tests passed and one TODO.
  No frontend tests were added or changed at this checkpoint.

The checkpoint runs last in the runner. Existing regression tests are unchanged.

### AC-017.4.2 — green implementation

Jaydon reported the red branch CI had verify green and database red. Migration
`0047_venue_booking_assignment_access.sql` now changes booking UPDATE and slot
INSERT/DELETE permissions to follow the event's current coordinator. A guard
prevents coordinator edits from rewriting the original requester or moving the
booking to a different event/venue. No stored booking or slot data is rewritten.

The first full regression run exposed the existing US12 unassigned-event fixture.
0036 explicitly supports that path, so 0047 preserves original-requester authority
only while the event has no assigned coordinator. An assigned event always uses its
current coordinator. Venue Staff policies, calendar reading and shared lapsed-hold
cleanup remain unchanged.

Local green (9 October 2026): the unchanged AC-017.4.2 and full SQL suite passed.
The full frontend suite passed: 88 files, 864 tests, one TODO. No new tests were
added in this green step and no earlier assertions were weakened. The identity
guard and slot-insert rule do not yet have dedicated additional negative tests;
do not treat the grouped test as coverage of every write path.

0047 is not deployed, and the green CI result is pending. Frontend submit/release/list
filters still use the original requester, so the follow-up is not complete. Add a
focused frontend red checkpoint next. Nicole's approval remains required before
merging the proposed US11/US17 integration change.

### AC-017.4.3 — frontend handover, red checkpoint

Jaydon confirmed green CI for the AC-017.4.2 database implementation. One grouped
frontend test now checks that B can list, submit and release A's existing booking
after reassignment, while A no longer lists or manages it. It also checks the
original requester is preserved and slots are retained on submission and freed
on release. File: `frontend/src/features/venues/__tests__/venueBookingAssignment.test.ts`.

The service-boundary fake applies the query filters to a booking whose original
requester differs from its current coordinator. It models the database's current
assignee write rule; actual RLS is covered separately by AC-017.4.2 in PostgreSQL.
It is not a browser end-to-end test.

Local red (9 October 2026): expected booking `booking-17`, received an empty list
for the new coordinator. Full frontend suite: one intended failure, 864 passed,
one TODO. Full database suite passed. Production frontend code remains unchanged.
Next: capture red CI before replacing the obsolete original-requester filters.
Lint passed. Local typecheck stalled without diagnostics both in the sandbox and
on retry outside it; both attempts were stopped. Typecheck is unverified locally:
confirm GitHub reaches the intended test assertion rather than failing earlier.

### AC-017.4.3 — frontend green implementation

Jaydon confirmed verify failed at the red checkpoint while database passed.
`venueBookingService.ts` now lists bookings using an inner event join filtered by
the signed-in coordinator's current assignment. Submit/release no longer exclude
bookings created by someone else: database policies from 0047 decide write access.
Status/expiry checks and release-before-slot-cleanup ordering remain in place.
The original requester is never overwritten.

The list intentionally excludes unassigned or unreadable events. 0047 retains the
legacy unassigned-event requester fallback at database level, but the coordinator's
assigned-bookings screen is scoped to current assignments.

The red test AC-017.4.3 remains unchanged. Four existing expectations in
`venueBookingService.test.ts` were aligned with the proposed handover rule:

- AC-009.4.1: submit no longer filters by original requester.
- AC-010.8.5: release no longer filters by original requester.
- AC-009.9.2: list filters through the current event assignment with an inner join.
- AC-009.9.5: missing venue details still have a fallback, but the event must be
  visible and assigned (an unreadable event no longer qualifies for this list).

No additional tests were added during green. Local full-suite results on 9 October:
865 frontend tests passed, one TODO; full database suite, typecheck, lint and build
passed. The existing large-bundle build warning remains. No visual redesign,
commit, push, merge or shared migration application was performed by the assistant.
Nicole's agreement and live acceptance still remain before completing this follow-up.
