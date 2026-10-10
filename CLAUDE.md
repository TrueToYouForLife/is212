# ConnectSphere Event Planning System — Project Context

- US17 coordinator Requests view groups readable requests by coordinatorId:
  Assigned to me first, then Other event requests, preserving service order.
  RequestListItem's optional assignedToYou label is presentation only. No RLS or
  query changes. AC-017.4.6 covers grouping, refreshed assignments and empty states.

## US17 equipment handover follow-up (9 October 2026)
- 0048 changes legacy equipment booking/line coordinator policies to use
  is_assigned_event_coordinator; requested_by remains historical attribution.
- Direct coordinator updates change decision status only. The SECURITY INVOKER
  guard checks current_user so existing SECURITY DEFINER equipment requirement and
  reservation functions retain their checked internal updates.
- AC-017.4.4 is the unchanged handover TDD test; AC-017.4.5 is additional regression
  coverage. Full SQL suite passed locally; CI and equipment-owner review are pending.
- No shared database deployment yet. Keep separate from the 0047 venue-access PR.

## What this is
University project (SMU IS212). Event planning and venue booking for an events company.
Roles: Event Organiser, Event Coordinator, Venue Staff, Technical Support Staff, Attendee.

## Stack
React 18 + TypeScript + Vite · Tailwind · React Hook Form + Zod
Supabase (PostgreSQL + Auth + RLS) · Vitest + React Testing Library · GitHub Actions

## Repository layout
- frontend/ is the React app. Run every npm command from there.
- backend/supabase/migrations/ holds the database schema, RLS policies and triggers.
  There is no API server: the browser talks to Supabase directly, so the database is the
  backend.

## Architecture rules — follow these without being asked
- Feature folders: frontend/src/features/<feature>/ with types.ts, validation.ts,
  <x>Service.ts, components/, __tests__/
- validation.ts holds PURE functions only. No React, no Supabase, no I/O.
- Only <x>Service.ts talks to Supabase. Components never import the Supabase client.
- Business rules are validated in the client (UX) AND constrained in the database
  (integrity). This is deliberate defence in depth.
- Time intervals are half-open [start, end). Touching intervals do not overlap.
- Never use NOT NULL on a field a draft may legitimately omit; use a conditional CHECK
  keyed on status instead.

## Testing
- Every test case ID has the form `AC-00X.Y.Z`:
  X = user story number from the backlog (US1-US15, not the Jira SCRUM key),
  Y = acceptance criterion, numbered in Jira bullet order,
  Z = test case number within that criterion (unpadded: .1, .2 ... .12).
  Example: test('AC-001.2.1: accepts an empty draft', ...)
- Current story numbers: US1 Save Draft (SCRUM-8), US2 Submit Event Request (SCRUM-7),
  US3 View Event Request Status (SCRUM-24), US4 Review and Approve/Reject/Return
  (SCRUM-9), US6 Organiser Requesting Changes (SCRUM-11), US7 Coordinator Reviewing
  Change Requests (SCRUM-12), US13 Record Equipment Requirements (SCRUM-19).
- Z is unique per criterion across the whole story, including parameterised rows and
  tests in different files. Before adding a test, use the next unused Z for that
  criterion (see README allocations); never reuse or renumber an existing ID.
- Within a file, Z must increase top to bottom for each criterion. Group tests by
  criterion and preserve setup/helper scope when rearranging tests.
- Tests with no backlog story (AC-LIFECYCLE, AC-ROLES) are pending tickets; do not add
  more ad-hoc prefixes.
- Every story needs at least one boundary, conflict or failure test.
- We must reach high coverage and be able to trace acceptance criteria to tests.
- CI provides placeholder Supabase URL/key values separately for the Test and Build
  steps. These let the client initialise during imports; they do not connect to a real
  database. US4 ReviewActions tests mock the review function but import the real service
  for its messages. Keep mocked tests from making real network calls; live integration
  tests require a separate test environment, fixtures and cleanup.

## Roles and authorisation
- Roles live in public.profiles.role, never in auth.users. Values: organiser, coordinator, coordinator_lead,
  operations_manager, venue_staff, tech_support, attendee.
- Read the caller's role in SQL with public.current_user_role(). It is SECURITY DEFINER on
  purpose: a policy on profiles that queries profiles recurses infinitely.
- Roles are assigned by an administrator, never chosen by the user. A trigger blocks a
  signed-in user from changing their own role.
- Hiding UI from a role is a courtesy. The RLS policy is the control. Every role-gated
  screen must have a matching policy, or it is not actually protected.
- There is no in-app role switcher. dev_set_my_role() was dropped in 0014; test each role
  with its own account (README "Test accounts"). Do not reintroduce a self-service role change.

## Organiser status presentation
- Use status/organiserStatusLabel.ts for event badges and submission results: submitted
  and under_review display In review; submitted with a nonblank review note displays
  Clarification required. Pass organiserView on shared badges/panels only for organisers.
- Internal states remain unchanged. US4 submitted-request decisions use the atomic
  review_submitted_event RPC from 0012 instead of a Start review button. It runs the
  existing transitions and triggers together; older under_review rows retain their
  existing path. Apply 0012 before deploying this UI. Change-request submitted
  displays In review via changeRequestDisplay.ts. Replies will return to that same label.

## Event status values
draft, submitted, under_review, approved, planning, confirmed, completed, cancelled,
rejected. Review transitions belong in eventReviewService. Explicit draft submission
belongs in eventService so validated details and status change atomically on the same
owned Draft row. Both paths use expected-status filters and database transition triggers.
Draft saves in eventDraftService must never change an existing request's status.

## Change-request database baseline
- Shared Supabase used `event_change_requests_status_valid`, not just the fresh
  baseline's `event_change_requests_status_check`. Apply `0011` after `0010` to
  consolidate these into the six-status rule. Without it, clarification and partial
  approval fail even with the current RPC. The runner reproduces the mismatch and
  checks the fix; the reply increment brings the runner to 86 database checks. Never rerun 0007 after later migrations
  as a deployment shortcut: it restores the older, broader access policies.
- `0007_event_change_requests.sql` captures the shared US6 table, policies and timestamp
  trigger. It preserves existing rows and does not implement US7 review decisions.
- US7 is Event Coordinator Reviewing Change Requests; its tests follow the standard
  `AC-00X.Y.Z` format with criteria in the agreed Jira order.
- Follow-up work must cover assigned-coordinator access, per-change decisions and
  reasons, and atomic application of accepted changes. Existing request policies are
  a baseline, not proof of secure review or withdrawal. See README for known gaps.
- Both `0005` migrations precede `0006`; their duplicate version prefix needs resolving
  before relying on CLI migration discovery. Do not silently renumber applied files.
- `changeRequestReviewValidation.ts` is pure US7 review preparation.
  Decisions cover each proposed field once; rejected fields require explanations and
  clarification_requested fields require questions. Any unresolved field makes all
  approvals provisional: no event changes apply until every field is resolved.
  Do not treat prepared values as a validated event or bypass database permissions.
  README records the 27 validator test IDs using the supplied Jira AC order.
- `changeRequestReviewService.ts` calls that validator and the existing review RPC;
  the coordinator detail page now uses it through ChangeRequestReviewPanel/Form.
  Pass the exact event `updated_at` shown to the reviewer,
  never refresh it just before saving. Only decisions/notes go to the RPC, not proposed
  values or reviewer identity. Do not automatically retry a lost review response.
  Its 23 mocked tests continue the existing AC allocations; see README. Choose the
  RPC payload by the presence of decisions, not by status: field-level clarification
  also uses action=decide. Legacy whole-request action=clarify remains supported.
- `0008_change_request_review.sql` adds coordinator assignment and the atomic review
  RPC. Originally Operations Managers assigned; 0038 moves assignment to Coordinator Lead.
  Only the assigned coordinator reviews a
  pending request with a matching event updated_at. Values come from the stored
  proposal. Submitted event details cannot be edited directly by the browser;
  US4 status transitions and US1 draft edits still work. Never apply this migration
  silently to shared Supabase. Notifications/revalidation are pending.
- `0010_change_request_field_clarification.sql` replaces the review RPC to save mixed
  provisional decisions/questions without changing the event. It still accepts only
  submitted requests. Organiser replies/resubmission are implemented in 0013, and the reply UI/history are now connected. The browser loop still needs live
  verification; never bypass the reply operation with direct status updates.
  reviewed_at/by record the review action even if clarification is still outstanding.
  Per-field questions are in field_decisions.note, not the legacy review_note.
- `changeRequestReviewQueryService.ts` loads the event, exact version and embedded
  requests together, restricted to the signed-in assigned coordinator. Review forms
  do not poll: manual reload discards unsaved choices; failed saves require reloading.
  ChangeRequestSummary exposes per-field questions/reasons and provisional decisions
  to the organiser. Status wording is shared in changeRequestDisplay.ts.
  See `docs/us7-review-ui.md` for all 37 new test cases and the file-by-file change log.
  Existing US6 confirmed-event eligibility remains a recorded follow-up.
- Database checks live in `backend/supabase/tests/`; run
  `bash backend/supabase/tests/run_change_request_review.sh` with Docker running. Synthetic
  fixtures and Auth helpers are for the disposable container only, not shared Supabase.
  82 US7 SQL case IDs continue the unit-test allocations (see README), with four
  additional cross-story regression checks. These tests are separate from Vitest/CI.

## Review decisions and email (US4)
- `0009_review_decisions.sql`: `event_review_decisions` is the retained AC-004.5 record and
  `notification_outbox` queues AC-004.4 emails. Both are written only by the AFTER UPDATE
  trigger `record_event_review_decision`, using auth.uid() as the actor. Never add a
  client insert path or a write policy to either table.
- The decision log is staff-only (coordinator, operations_manager); reviewer identity stays
  internal. The outbox is service-role only.
- Emails are sent by the Edge Function `backend/supabase/functions/send-review-notifications`
  (Deno, not part of the Vite build). Provider keys live in Supabase secrets, never `VITE_`.
- Database checks: `backend/supabase/tests/review_decisions_test.sql`, disposable databases only.

## US17 slice 1 (current assignment rules)

- Latest: slice 4 merged in PR #72; Jaydon confirmed CI green and 0046 deployed.
  Treat 0046 as immutable. Follow-up venue handover is local-only pending Nicole's
  agreement: US11 AC8 original-placer wording conflicts with US17 AC4/SCRUM-160.
  Jaydon claimed 0047, now implemented locally but not deployed. AC-017.4.2 failed
  because the old coordinator could submit a reassigned hold; unchanged test now
  passes with the full SQL suite. Frontend: 864 passed, one TODO. Existing unassigned
  booking behaviour from 0036 is preserved via requester fallback only when no
  coordinator is assigned. Venue Staff/expired-hold cleanup remain unchanged.
  Jaydon confirmed database green CI. Frontend AC-017.4.3 is now red: new assignee
  received an empty booking list. Jaydon confirmed red CI, then service filters
  changed: assigned-event inner join for listing, RLS for inherited submit/release.
  Unchanged .4.3 now passes; full frontend 865 passed/one TODO and full SQL passed.
  Four existing venue test expectations updated for the proposed rule; no new
  tests in green. Next unused AC4 ID is .4. No extra regression cases. Nicole's
  approval, green CI and live acceptance remain pending; 0047 is not deployed.

- Slice 4 green checkpoint: 0046 (claimed by Jaydon, not deployed) adds recipient
  assignment notifications and queues mail through the unchanged US4 sender. Trigger
  runs from assignment-history insertion in the same transaction. Both channels default
  on; admin-only per-type settings, recipient/current-event RLS, no browser writes.
  AC-017.5.1 passes unchanged after its red/green cycle. AC-017.5.2–3 are additional
  regression tests: reassignment/no-op/refused changes and recipient/current-assignment
  RLS/write restrictions. Both passed immediately, not TDD cycles. AC-017.5.4–5 cover
  channel settings and 0046 replay; full SQL suite passed after correcting test syntax,
  with no feature changes. These are regression coverage too. Live delivery remains
  unverified. Do not claim a shared inbox. Next AC5 test ID: .6.
  Continue TDD for US17 at Jaydon's explicit request and flag any additional regression tests.

- `0038_coordinator_lead_assignment.sql` accepts coordinator_lead and grants SELECT on
  non-draft events. The existing assignment RPC and guard now require that role.
- Do not convert existing Manager accounts automatically or grant Leads unrelated
  venue/equipment management rights. Admin provisioning remains required.
- Keep later migration replacements after historical replay in the database runner:
  replaying 0008 alone restores obsolete Manager-only assignment.
- Test IDs: AC-017.1.1 app, .1.2-9 and .2.1-7 SQL. Next IDs: .1.10 and .2.8.
  Red-green cycles: .1.1, .1.2, .1.9, .2.1. Other cases are additional coverage,
  not retrospectively claimed TDD. See docs/us17-assignment.md.
- Slice 1 has no queue UI, assignment history, notifications or terminal-event
  reassignment rules. Those are future increments; do not mark the whole story complete.

## House style
- US17 slice 3 in progress: Leads use /requests for the unassigned submitted queue.
  listEventRequests loads coordinator_id; only explicit null denotes unassigned.
  AC-017.1.10 covers queue presentation; AC-017.2.9 covers selection/save failure/retry.
  coordinatorAssignmentService.ts alone calls dropdown/assignment RPCs. Apply 0041 before
  live dropdown testing (deployment unconfirmed); AC-017.2.8 covers its Lead-only counts.
  AC-017.3.2 covers reassignment with retry and closed-event controls excluded. Active
  counts and reassignment UI exclude draft/completed/cancelled/rejected. Live checks remain.
  Jaydon confirmed 0039 deployed on 6 October 2026: do not edit that migration further.
- US17 slice 2: 0039 blocks completed/cancelled reassignment and guards coordinator
  event updates using the current assignee. US4 review fixtures must have an assignment.
  Assignment history is trigger-written, Lead-readable, with no browser writes/backfill.
  Reapply 0039 after the runner's historical 0008/0038 replay. Three SQL TDD cases:
  AC-017.3.1, .4.1, .6.1. See docs/us17-assignment.md for deployment and open scope.
- Shared event date/time displays use Asia/Singapore explicitly in formatters.ts;
  do not depend on the browser or CI machine timezone.
- No `any`. Prefer explicit types.
- Comment *why*, not *what*. We are examined orally on our design decisions.
- Small components. Extract when a file passes ~150 lines.

## Out of scope for the first release
Reporting, analytics, recurring events, multi-session events, dashboards.

## Organiser clarification reply increment
- `0013_change_request_replies.sql` follows 0011; 0012 is reserved in another PR and
  is not a dependency. Apply 0013 before deploying the readers of review_version.
  Jaydon reported applying 0013 to shared Supabase on 27 September. Live UI checks remain.
- Only the owning organiser may call reply_to_change_request. All outstanding field
  questions require answers; legacy whole-request questions accept a note. Answers
  cannot edit proposed values. The request returns to submitted, the event stays unchanged.
- review_version increments on every request update. Pass the displayed version to
  reply and review calls; never refresh it silently before writing. Requests with reply
  history cannot be reviewed by an old client that omits the version.
- reply_history retains questions/answers/actors/times per reply round. It is not yet
  the complete US7 activity log. Reply form/history UI are connected; live verification remains pending.
- See docs/us7-reply-preparation.md for each changed file and new test case.
  Reply validation: AC-007.7.37–47; reply service: .48–56; SQL replies: .57–66,
  plus AC-007.2.32–35, .8.3, .9.17, .13.7–8. Review-service tests: .5.39–40.

- Reply UI: ChangeRequestReplyForm is owner-only in ChangeRequestList, for clarification
  status only. No polling/focus refresh in that list while typing. Explicit reload discards
  text; failed writes retain text and lock retry until reload. Other status panels still poll.
- ChangeRequestReplyHistory is shared through ChangeRequestSummary by organiser and
  coordinator. Query services select reply_history and map missing fixture values to [].
  Do not replace retained questions with the latest field_decisions when rendering history.
- UI tests: AC-007.7.67–74 form, .75–77 list; AC-007.13.9 coordinator panel,
  .13.10–11 shared history. Existing AC-007.3.1 also verifies history mapping.
  349 app tests; database suite unchanged at 86. See docs/us7-reply-preparation.md.

## Significant-change display (US7 AC11)
- classifyChangeRequest in changeRequestSignificance.ts is pure and derived from the
  stored proposal keys. Significant: proposedStart, proposedEnd, expectedAttendance,
  layoutPreference, accessibilityRequirements, equipmentRequirements. Layout/accessibility
  represent venue requirements in the current model. Other supported fields alone are ordinary.
- A blank optional requirement still counts as a change. No free-text inference, size
  threshold or comparison against current event values. Historical outcome does not change
  the classification. Show the affected fields through ChangeRequestSignificance in the
  shared request summary, separately from the request status badge.
- This is a UI flag, not an enforcement mechanism or persisted database flag. AC12 must
  derive revalidation needs from accepted fields in the database; do not trust this label.
- Tests AC-007.11.1–10 in changeRequestSignificance.test.ts; .11–13 in
  ChangeRequestSignificance.test.tsx. 368 app tests total; no new SQL tests/migration.
  See docs/us7-significance.md. Notifications, AC12 and complete review audit history remain.

## US7 AC12 revalidation hook
- 0015_change_request_revalidation.sql adds event_change_revalidations, populated by an
  AFTER UPDATE trigger within the existing final-review transaction. Only accepted significant
  fields count. No queue for rejection, ordinary-only approval or provisional clarification.
- Dates/attendance flag both arrangements; layout/accessibility venue only; equipment fields
  equipment only. Derive from stored decisions/proposal, not a client classification flag.
- Assigned coordinator and Operations Manager have RLS SELECT; browser writes are revoked.
  One row per request. Queue failure rolls back event and review. No historical backfill.
- This is a pending integration hook, not real booking/equipment checks. No completion API,
  worker or automatic lifecycle transition. Downstream owners must implement those separately.
- Jaydon applied 0015 to shared Supabase and reported a successful equipment-approval
  revalidation record on 27 September. Other live paths still need verification.
  Tests AC-007.12.1–18 in change_request_revalidation.sql,
  .19 replay in runner. See docs/us7-revalidation.md. Notifications/full review audit remain.

## US7 notification trigger (AC1 / SCRUM-54)
- 0016_change_request_notifications.sql is trigger-only by Jaydon's scope decision. No
  shared notification UI or new sender. It records assigned-coordinator notifications
  on initial submission and clarification reply -> submitted; unique request/version/recipient.
- change_request_notification_settings controls this type's channels: in-app true, email
  false by default. Only admin configuration; no browser write grants. Email uses the
  existing notification_outbox and unchanged send-review-notifications worker.
- RLS limits in-app reads to recipient + current assigned coordinator. No recipient
  details/proposals in the generic email body; queued mail is not rerouted on reassignment.
- Unassigned requests create no notification; US17 later assignment/backlog remains a
  dependency. No existing-data backfill. Record failure rolls back submission.
- AC-007.1.1–17 in change_request_notifications.sql; .18 migration replay in runner.
  No live emails sent; migration not applied to shared Supabase. UI/delivery evidence
  is still required for AC1, separately from this trigger subtask. See docs/us7-notification-trigger.md.

## US7 retained review history (latest increment)
- 0017 records future review actions in event_change_review_history in the same transaction
  as the review. Snapshot proposal, decisions, actor name/ID and time; never derive history
  from mutable current request fields. No historical backfill or browser writes.
- Staff identity history is restricted to current assigned coordinator / Operations Manager.
  Only coordinator query embeds it; organiser query and shared summary do not expose it.
- ChangeRequestReviewHistory displays entries below each coordinator request summary,
  newest version first. Clarification decisions are explicitly provisional.
- Apply 0017 before updated coordinator queries. Not applied to shared Supabase this round.
- AC-007.13.12–26 SQL/runner; .27–31 UI/query. See docs/us7-review-history.md.
- Progress correction to older sections: reply flow and revalidation were user-tested;
  0016 was applied and email queuing reported by Jaydon. Actual notification delivery is
  still unverified. Organiser notifications are deferred; do not reconfigure the shared sender.

## US13 equipment requirements (SCRUM-19)
- 0024_event_equipment_requirements.sql follows 0023 and does not modify 0019's tables.
  Requirements are the Coordinator's list; reserving is US14 through 0019 booking lines and
  allocations, linked back by booking_line_id. Recording must never create a booking or
  allocation (AC-013.5). Applied to shared Supabase on 3 October; there, 0019 had no
  equipment_types policies, so types_select_staff was re-created from 0019 (see docs).
- Only the assigned coordinator (events.coordinator_id) writes, and only while the event is
  approved/planning/confirmed (trigger, errcode 22000). Column grants let the browser write
  only type_id, quantity, technical_notes and essential; never grant status, booking_line_id,
  created_by or event_id. Reads: assigned coordinator and all tech_support.
- A type/quantity change on a reserved/partially_reserved line resets it to pending_review
  and cancels its 'reserved' allocations; deletion cancels them too. Cancel, never delete;
  checked_out/returned stay. Notes/essential edits keep the reservation.
- Notifications: trigger-written equipment_requirement_notifications, one per tech_support
  user, for added/changed/removed Coordinator fields only. No browser write path.
- equipmentRequirementService.ts is the only Supabase access; equipmentRows.ts maps rows.
  Tests AC-013.1–6: 57 app tests, 56 SQL checks in equipment_requirements.sql. Totals: 446 app
  tests; 203 database checks. Next IDs and the US14 contract: docs/us13-equipment-requirements.md.

## US14 equipment reservations (SCRUM-20)
- 0025_equipment_reservations.sql follows 0024 and builds on 0019's units, booking lines and
  allocations; never add a parallel catalogue. Not yet applied to shared Supabase.
- Reserve only through reserve_equipment (rpc). Never check availability in the browser and
  write separately. Technical Support's direct writes on allocations, lines and bookings were
  removed (agreed with Nicole); keep it that way. Every SECURITY DEFINER function must call
  require_tech_support() and set search_path = ''.
- Windows are per unit, in whole Singapore days: collection = first day - 1, minus one more
  day when the unit is not at an approved (confirmed) venue booking of the event; through
  the return day, which defaults to the last day and can't be earlier. Only operational units
  count. Per-type advisory lock (lock_equipment_type) for every reserve and return-date change.
- Outcome notices reuse equipment_requirement_notifications (coordinator recipient) plus
  notification_outbox; channels in equipment_notification_settings. One per requirement outcome.
- Tests AC-014.1–13: 22 app tests, 82 SQL checks in equipment_reservations.sql. In SQL tests,
  run actions as separate statements before asserting (a statement can't see its own function
  calls' writes). Totals: 468 app tests; 285 database checks. See docs/us14-equipment-reservations.md.

## US29 attendee sign-up (SCRUM-227)
- 0042_attendee_self_signup.sql replaces handle_new_user: every new account is an Attendee,
  whatever the sign-up metadata says. Never read a role from raw_user_meta_data. Not yet
  applied to shared Supabase.
- SQL fixtures: inserting into auth.users now creates an attendee. Set organiser (and every
  other role) explicitly as administrator after the insert, as five existing files now do.
- No organiser sign-up (team decision, 7 October): organisers and staff are seed data, with
  the role set by an administrator. Do not reintroduce a role or organiser choice on /signup.
- Supabase "Confirm email" stays on: no session until the link is clicked. Sign-up sets
  emailRedirectTo to /events/open, which must be listed in the dashboard's Redirect URLs.
  A duplicate shows as a user with no identities; signUp reports it (team accepted the
  account-enumeration trade-off).
- /signup (React Hook Form + Zod) replaced the sign-in page's in-page sign-up mode.
  /events/open became the US15 open-events list (see the US15 section).
- Tests AC-029.1–4: 29 app tests, 8 SQL checks in attendee_signup.sql plus a 0042 replay in
  the runner; 3 manual. Organiser-request IDs (.3.2, .3.3, .3.7–.3.12, .3.14) are withdrawn,
  never reuse them; next AC-029.3 ID is .3.18. Totals: 793 app tests; 418 database checks.
  See docs/test-cases/US29_test_cases.md.

## US15 register for a confirmed event (SCRUM-22)
- 0043_event_registrations.sql follows 0042. Not yet applied to shared Supabase.
- "Registration enabled" is the existing events.registration_required (US52 adds the
  coordinator toggle later). Open = confirmed + registration_required + proposed_start in the
  future, defined once in event_is_open_for_registration and enforced in register_for_event.
- Register only through register_for_event (rpc): caller must be an Attendee (42501); event
  must be open (22000); answers checked (22023, same phone rule as the form: 8-15 digits).
  Browsers have no insert/update/delete on event_registrations; owners SELECT their rows only.
- One active registration per attendee and event: partial unique index where status =
  'registered' (23505). 'withdrawn' is allowed for US23, which must withdraw through its own
  function and may let the person register again.
- Attendees never read events, venues or venue_bookings directly: list_open_events,
  get_open_event and list_my_registrations return public fields only. Venue = confirmed
  bookings only. Do not add an Attendee policy on events (RLS cannot hide columns).
- Confirmation email: AFTER INSERT trigger queues notification_outbox in the same transaction
  (existing US4 sender, unchanged). Queue failure rolls the registration back.
- events.registration_prerequisites is shown to Attendees; no edit screen yet (US52).
- Tests AC-015.1-7: 36 app tests, 34 SQL cases (44 checks) in event_registrations.sql, which
  must stay after equipment_reservations.sql (reuses pg_temp.us14_race). Totals: 831 app
  tests; 462 database checks. Next IDs: AC-015.6.13, AC-015.7.12.
- US29 Home defect (8 October): Attendees get their own Home (Browse events, My registrations).
  Tests AC-029.4.11-12 and AC-015.7.11 in pages/__tests__/SignedInHome.test.tsx. See docs/test-cases/US15_test_cases.md.
