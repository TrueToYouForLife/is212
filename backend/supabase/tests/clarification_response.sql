-- US37 (SCRUM-234): AC-037.1, AC-037.2, AC-037.4, AC-037.5 — answering a clarification
-- request and resubmitting.
--
-- AC-037.3 (notifying the assigned Coordinator) is the next slice and has no cases here.
--
-- The point of most of these is not that the new entry point works, but that the two guards
-- it goes through are still shut to everyone else: 0008 still refuses a browser detail edit,
-- and 0004 still refuses a browser status change. A hole that only the RPC can use is the
-- whole design, so it is asserted from both sides.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('37000000-0000-0000-0000-000000000001', 'us37-owner@example.test', '{"full_name":"Omar Owner"}'),
 ('37000000-0000-0000-0000-000000000002', 'us37-other@example.test', '{"full_name":"Olive Other"}'),
 ('37000000-0000-0000-0000-000000000003', 'us37-coord@example.test', '{"full_name":"Cara Coordinator"}'),
 ('37000000-0000-0000-0000-000000000004', 'us37-coord-other@example.test', '{"full_name":"Colin Other"}');

update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id in ('37000000-0000-0000-0000-000000000001',
              '37000000-0000-0000-0000-000000000002');
update public.profiles set role = 'coordinator'
 where id in ('37000000-0000-0000-0000-000000000003',
              '37000000-0000-0000-0000-000000000004');

-- Seven events, because almost every case here mutates the row it tests and a shared
-- fixture would make the order of assertions part of the result.
--
-- reviewed_by is pre-set to the Coordinator on the returned ones: AC-037.5.6 checks that
-- the Organiser's own resubmission does not overwrite it with themselves.
insert into public.events (id, organiser_id, coordinator_id, reference, name, purpose,
                           event_type, proposed_start, proposed_end, expected_attendance,
                           layout_preference, accessibility_requirements,
                           facility_requirements, status, review_note, reviewed_by,
                           reviewed_at)
values
 -- E1: returned, the main path.
 ('37000000-1111-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000003', 'EVT-US37-1', 'Annual Showcase',
  'Show this year''s work', 'Showcase', '2046-11-01T10:00:00+08', '2046-11-01T18:00:00+08',
  80, 'theatre', array['hearing_loop'], array['projector'], 'submitted',
  'Please confirm the expected attendance and the layout.',
  '37000000-0000-0000-0000-000000000003', '2046-10-01T09:00:00+08'),
 -- E2: under review and never returned, so there is no question to answer.
 ('37000000-1111-0000-0000-000000000002', '37000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000003', 'EVT-US37-2', 'Quiet Review', 'Being read now',
  'Workshop', '2046-11-02T10:00:00+08', '2046-11-02T12:00:00+08', 20,
  'classroom', array[]::text[], array[]::text[], 'under_review', null, null, null),
 -- E3: submitted, waiting to be picked up. Also no question.
 ('37000000-1111-0000-0000-000000000003', '37000000-0000-0000-0000-000000000001',
  null, 'EVT-US37-3', 'Fresh Request', 'Just submitted', 'Workshop',
  '2046-11-03T10:00:00+08', '2046-11-03T12:00:00+08', 20,
  'classroom', array[]::text[], array[]::text[], 'submitted', null, null, null),
 -- E4: returned, used for a reply with no revision.
 ('37000000-1111-0000-0000-000000000004', '37000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000003', 'EVT-US37-4', 'Standing Booking',
  'Nothing to change', 'Meeting', '2046-11-04T10:00:00+08', '2046-11-04T12:00:00+08', 10,
  'u_shape', array[]::text[], array[]::text[], 'submitted',
  'Is the room already confirmed with the venue?',
  '37000000-0000-0000-0000-000000000003', '2046-10-01T09:00:00+08'),
 -- E5: approved, long past the point of clarification.
 ('37000000-1111-0000-0000-000000000005', '37000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000003', 'EVT-US37-5', 'Settled Event', 'Already approved',
  'Meeting', '2046-11-05T10:00:00+08', '2046-11-05T12:00:00+08', 10,
  'u_shape', array[]::text[], array[]::text[], 'approved', null,
  '37000000-0000-0000-0000-000000000003', '2046-10-01T09:00:00+08'),
 -- E6: returned, used for the refusals and then the full round trip to a decision.
 ('37000000-1111-0000-0000-000000000006', '37000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000003', 'EVT-US37-6', 'Round Trip', 'Answer then decide',
  'Conference', '2046-11-06T10:00:00+08', '2046-11-06T18:00:00+08', 50,
  'banquet', array[]::text[], array[]::text[], 'submitted',
  'Which accessibility requirements apply?',
  '37000000-0000-0000-0000-000000000003', '2046-10-01T09:00:00+08'),
 -- E7: returned, used for a field resubmitted unchanged.
 ('37000000-1111-0000-0000-000000000007', '37000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000003', 'EVT-US37-7', 'Unchanged Answer',
  'Confirming as-is', 'Meeting', '2046-11-07T10:00:00+08', '2046-11-07T12:00:00+08', 30,
  'u_shape', array[]::text[], array[]::text[], 'submitted',
  'Is thirty still the right headcount?',
  '37000000-0000-0000-0000-000000000003', '2046-10-01T09:00:00+08');

create or replace function pg_temp.us37_respond(
  event_number integer, updates jsonb, reply text
) returns uuid language plpgsql as $$
declare
  target uuid := ('37000000-1111-0000-0000-' || lpad(event_number::text, 12, '0'))::uuid;
begin
  -- The caller passes the updated_at it was shown. Reading it here is what a browser does
  -- between loading the page and submitting the form, so the helper mirrors that rather
  -- than smuggling a fresher value in.
  return public.respond_to_clarification(
    target, updates, reply,
    (select updated_at from public.events where id = target));
end $$;

set role authenticated;

-- ===== AC-037.1 the Organiser can update the requested information and add a reply =====

select pg_temp.as_user('37000000-0000-0000-0000-000000000001');

select pg_temp.us37_respond(1,
  '{"expected_attendance": 140, "layout_preference": "banquet"}'::jsonb,
  'Attendance is now 140 after the faculty invite, so banquet seating suits it better.');

select pg_temp.assert_true(
 (select expected_attendance = 140 and layout_preference = 'banquet'
    from public.events where id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.1.1: the revised fields are applied to the request');

select pg_temp.assert_true(
 (select reply = 'Attendance is now 140 after the faculty invite, so banquet seating suits it better.'
    from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.1.2: the reply is recorded against the request');

-- A reply on its own is a real answer: "nothing needs to change, and here is why". Making
-- an edit compulsory would only teach Organisers to invent one.
select pg_temp.us37_respond(4, '{}'::jsonb,
  'Yes — the venue confirmed the room on 2 October, so no change is needed.');

select pg_temp.assert_true(
 (select status = 'under_review' from public.events
   where id = '37000000-1111-0000-0000-000000000004')
 and (select before_values = '{}'::jsonb and after_values = '{}'::jsonb
        from public.event_clarification_responses
       where event_id = '37000000-1111-0000-0000-000000000004'),
 'AC-037.1.3: a reply with no revision is accepted and recorded as revising nothing');

select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(6, '{"expected_attendance": 60}'::jsonb, '   ')$q$,
  '22023', 'AC-037.1.4: a blank reply is refused');

-- Named rather than counted, so the Organiser is told which field was refused. status is
-- the one that matters most: it is how a request would otherwise approve itself.
select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(6, '{"status": "approved"}'::jsonb, 'Approving it myself')$q$,
  '22000', 'AC-037.1.5: a field outside the editable set is refused');

select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(6, '{"reference": "EVT-MINE-1"}'::jsonb, 'Renaming it')$q$,
  '22000', 'AC-037.1.6: the reference cannot be changed when answering');

-- Closed assertion: this fails if a field is added as well as if one is removed, so
-- widening what an Organiser may change mid-review cannot happen quietly.
select pg_temp.assert_true(
 (select array_agg(f order by f) from unnest(public.clarification_editable_fields()) f)
   = array['accessibility_requirements', 'description', 'equipment_requirements',
           'event_type', 'expected_attendance', 'facility_requirements',
           'layout_preference', 'name', 'programme', 'proposed_end', 'proposed_start',
           'purpose', 'registration_required', 'special_arrangements']::text[],
 'AC-037.1.7: the editable set is exactly the Organiser''s own request fields');

-- Another Organiser's request is not theirs to answer. "Request unavailable" rather than
-- "not yours": the row is already invisible to them under 0005, and saying which it is
-- would confirm the request exists.
select pg_temp.as_user('37000000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(6, '{"expected_attendance": 60}'::jsonb, 'Answering for them')$q$,
  '22000', 'AC-037.1.8: another Organiser cannot answer someone else''s request');

-- The Coordinator asked the question; answering it on the Organiser's behalf would make
-- the clarification a formality.
select pg_temp.as_user('37000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(6, '{"expected_attendance": 60}'::jsonb, 'Filling it in myself')$q$,
  '42501', 'AC-037.1.9: a Coordinator cannot answer on the Organiser''s behalf');

-- ===== AC-037.2 resubmission returns to Under Review, same request =====

select pg_temp.as_user('37000000-0000-0000-0000-000000000001');

select pg_temp.assert_true(
 (select status = 'under_review' and reference = 'EVT-US37-1'
    from public.events where id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.2.1: the request is back under review under its original reference');

select pg_temp.assert_true(
 (select review_note is null from public.events
   where id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.2.2: the answered question no longer stands against the request');

-- Boundary on the concurrency check: the Coordinator returning it a second time with a
-- different question must not let the Organiser's in-flight answer land on the new one.
select pg_temp.as_user('37000000-0000-0000-0000-000000000003');
update public.events set review_note = 'Second thoughts: which layout?'
 where id = '37000000-1111-0000-0000-000000000006';

select pg_temp.as_user('37000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
  $q$select public.respond_to_clarification('37000000-1111-0000-0000-000000000006',
      '{"expected_attendance": 60}'::jsonb, 'Answering the old question',
      '2046-10-01T09:00:00+08'::timestamptz)$q$,
  '22000', 'AC-037.2.3: an answer carrying a stale version of the request is refused');

select pg_temp.expect_error(
  $q$select public.respond_to_clarification('37000000-1111-0000-0000-000000000006',
      '{"expected_attendance": 60}'::jsonb, 'No version at all', null)$q$,
  '22000', 'AC-037.2.4: an answer with no version at all is refused');

-- ===== AC-037.4 no edits while under review and not returned =====

select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(2, '{"expected_attendance": 25}'::jsonb, 'Slipping a change in')$q$,
  '22000', 'AC-037.4.1: a request under review with no question cannot be edited');

select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(3, '{"expected_attendance": 25}'::jsonb, 'Editing after submitting')$q$,
  '22000', 'AC-037.4.2: a submitted request that was never returned cannot be edited');

select pg_temp.expect_error(
  $q$select pg_temp.us37_respond(5, '{"expected_attendance": 25}'::jsonb, 'Editing an approved event')$q$,
  '22000', 'AC-037.4.3: an approved event cannot be answered as a clarification');

-- The other side of the hole. E6 is genuinely returned, so the only thing standing between
-- the Organiser and a direct edit is 0008 — and it still stands.
select pg_temp.expect_error(
  $q$update public.events set expected_attendance = 999
     where id = '37000000-1111-0000-0000-000000000006'$q$,
  '42501', 'AC-037.4.4: a returned request still cannot be edited directly from the browser');

-- And 0004 still refuses the status move, which is why the carve-out tests current_user
-- rather than auth.uid(): the Organiser is auth.uid() in both cases.
select pg_temp.expect_error(
  $q$update public.events set status = 'under_review'
     where id = '37000000-1111-0000-0000-000000000006'$q$,
  '42501', 'AC-037.4.5: an Organiser still cannot put their own request under review directly');

select pg_temp.expect_error(
  $q$insert into public.event_clarification_responses
      (event_id, round, responded_by, review_note, reply, before_values, after_values)
     values ('37000000-1111-0000-0000-000000000006', 99,
             '37000000-0000-0000-0000-000000000001', 'q', 'a', '{}', '{}')$q$,
  '42501', 'AC-037.4.6: the response record cannot be written from the browser');

-- review_note is one of the columns 0008 lets through, so until this slice an Organiser
-- could rewrite or clear the question they were asked. AC-037.4 is only as strong as
-- "this request is returned" is trustworthy, so the question is now the reviewer's alone.
select pg_temp.expect_error(
  $q$update public.events set review_note = null
     where id = '37000000-1111-0000-0000-000000000006'$q$,
  '42501', 'AC-037.4.7: an Organiser cannot clear the question they were asked');

select pg_temp.expect_error(
  $q$update public.events set review_note = 'Something easier'
     where id = '37000000-1111-0000-0000-000000000006'$q$,
  '42501', 'AC-037.4.8: an Organiser cannot rewrite the question they were asked');

-- Regression guard for the function this migration replaces. 0006 tightened the organiser
-- branch of enforce_event_status_transition to require the organiser ROLE as well as
-- ownership, so someone moved off that role keeps no control over the events they used to
-- own. Postgres cannot add a case to a function, so a replacement must carry every earlier
-- change forward — and a replacement restated from 0004 reverts this one. That is exactly
-- the mistake that produced this test.
--
-- Asserted against the definition rather than by behaviour, deliberately: events_update_own
-- already requires the organiser role, so a non-organiser owner is filtered out by RLS
-- before the trigger runs and no reachable browser path tells the two versions apart. The
-- tightening is defence in depth for a SECURITY DEFINER caller, and the claim being made
-- here is about the definition, so that is what is checked.
select pg_temp.assert_true(
 (select prosrc like '%actor_role = ''organiser'' and old.organiser_id = auth.uid()%'
    from pg_catalog.pg_proc
   where oid = 'public.enforce_event_status_transition()'::regprocedure),
 'AC-037.4.16: replacing the transition guard keeps 0006''s organiser-role requirement');

-- ===== AC-037.5 before and after are both kept =====

select pg_temp.assert_true(
 (select before_values = '{"expected_attendance": 80, "layout_preference": "theatre"}'::jsonb
     and after_values = '{"expected_attendance": 140, "layout_preference": "banquet"}'::jsonb
    from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.1: both the values before and the values after the revision are kept');

select pg_temp.assert_true(
 (select review_note = 'Please confirm the expected attendance and the layout.'
     and responded_by = '37000000-0000-0000-0000-000000000001'
    from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.2: the record keeps the question it answers and who answered it');

-- Only the fields that were submitted. A whole-row snapshot every round would bury the
-- answer among columns nobody asked about.
select pg_temp.assert_true(
 (select not (before_values ? 'name') and not (before_values ? 'purpose')
    from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.3: the record holds only the fields the Organiser submitted');

-- Boundary: a field answered with the value it already had. Recording it is deliberate —
-- "I checked this and it is still thirty" is an answer, and the record should show it was
-- looked at rather than skipped.
select pg_temp.us37_respond(7, '{"expected_attendance": 30}'::jsonb,
  'Checked with the department — thirty is still right.');

select pg_temp.assert_true(
 (select before_values = after_values
     and after_values = '{"expected_attendance": 30}'::jsonb
    from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000007'),
 'AC-037.5.4: a field resubmitted unchanged is still recorded, before and after alike');

-- A second round keeps its own record rather than overwriting the first, which is the
-- difference between a history and a current value.
select pg_temp.as_user('37000000-0000-0000-0000-000000000003');
update public.events set status = 'submitted',
       review_note = 'One more thing: how many need hearing support?'
 where id = '37000000-1111-0000-0000-000000000001';

select pg_temp.as_user('37000000-0000-0000-0000-000000000001');
select pg_temp.us37_respond(1, '{"accessibility_requirements": ["hearing_loop", "lift_access"]}'::jsonb,
  'Four people need hearing support, and two need lift access.');

select pg_temp.assert_true(
 (select count(*) = 2 from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001')
 and (select round = 2
        and before_values = '{"accessibility_requirements": ["hearing_loop"]}'::jsonb
        and after_values = '{"accessibility_requirements": ["hearing_loop", "lift_access"]}'::jsonb
        from public.event_clarification_responses
       where event_id = '37000000-1111-0000-0000-000000000001' and round = 2),
 'AC-037.5.5: a second round is kept as its own record, numbered after the first');

-- The assigned Coordinator reads the answers, because they are reviewing them.
select pg_temp.as_user('37000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
 (select count(*) = 2 from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.6: the assigned Coordinator can read the Organiser''s answers');

-- A Coordinator who is not the assignee is just another signed-in user, as everywhere
-- else since 0048.
select pg_temp.as_user('37000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
 (select count(*) = 0 from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.7: a Coordinator who is not the assignee reads nothing');

select pg_temp.as_user('37000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
 (select count(*) = 0 from public.event_clarification_responses
   where event_id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.8: another Organiser reads nothing');

-- ===== The resubmitted request is still reviewable =====
-- AC-037.2 lands the request in under_review rather than submitted, which means 0012's
-- review_submitted_event no longer applies to it. That is fine — 0004 allows the direct
-- transition for the assigned Coordinator — but it is the kind of thing that is only fine
-- until it isn't, so the round trip is asserted end to end.

select pg_temp.as_user('37000000-0000-0000-0000-000000000001');
select pg_temp.us37_respond(6, '{"accessibility_requirements": ["wheelchair_access"]}'::jsonb,
  'Wheelchair access is the only requirement.');

select pg_temp.as_user('37000000-0000-0000-0000-000000000003');
update public.events set status = 'approved'
 where id = '37000000-1111-0000-0000-000000000006';

select pg_temp.assert_true(
 (select status = 'approved' from public.events
   where id = '37000000-1111-0000-0000-000000000006'),
 'AC-037.2.5: the assigned Coordinator can decide a resubmitted request');

-- reviewed_by is revoked from authenticated (0005), so this is asserted from outside any
-- session. The Organiser moved the request into under_review themselves; before this slice
-- 0004's stamp would have recorded them as its reviewer.
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select reviewed_by = '37000000-0000-0000-0000-000000000003'
    from public.events where id = '37000000-1111-0000-0000-000000000001'),
 'AC-037.5.9: answering a clarification never records the Organiser as the reviewer');
