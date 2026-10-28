-- US37 (SCRUM-234): AC-037.3 — the assigned Coordinator is notified when the Organiser
-- answers a clarification request.
--
-- Its own fixtures rather than clarification_response.sql's, because that file resubmits,
-- reassigns and re-returns its events, and a shared fixture would make the order the two
-- files happen to run in part of the result.
--
-- Three of these exist because a new feed source has to be registered in three places and
-- missing one fails quietly: the read-state CHECK, the feed arm, and the outbox exclusion
-- that stops the same notice arriving twice.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('37900000-0000-0000-0000-000000000001', 'us37n-owner@example.test', '{"full_name":"Nina Owner"}'),
 ('37900000-0000-0000-0000-000000000002', 'us37n-coord@example.test', '{"full_name":"Nils Coordinator"}'),
 ('37900000-0000-0000-0000-000000000003', 'us37n-coord-other@example.test', '{"full_name":"Nora Other"}');

update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = '37900000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator'
 where id in ('37900000-0000-0000-0000-000000000002',
              '37900000-0000-0000-0000-000000000003');

-- N1 is returned and assigned. N2 is returned with nobody assigned, which is the case
-- 0097 deliberately does not invent a recipient for.
insert into public.events (id, organiser_id, coordinator_id, reference, name, purpose,
                           event_type, proposed_start, proposed_end, expected_attendance,
                           layout_preference, accessibility_requirements,
                           facility_requirements, status, review_note, reviewed_by,
                           reviewed_at)
values
 ('37900000-1111-0000-0000-000000000001', '37900000-0000-0000-0000-000000000001',
  '37900000-0000-0000-0000-000000000002', 'EVT-US37N-1', 'Alumni Dinner',
  'Reconnect with alumni', 'Dinner', '2046-12-01T10:00:00+08', '2046-12-01T18:00:00+08',
  90, 'banquet', array[]::text[], array[]::text[], 'submitted',
  'How many guests need step-free access?',
  '37900000-0000-0000-0000-000000000002', '2046-11-01T09:00:00+08'),
 ('37900000-1111-0000-0000-000000000002', '37900000-0000-0000-0000-000000000001',
  null, 'EVT-US37N-2', 'Unassigned Request', 'Nobody holds this yet', 'Meeting',
  '2046-12-02T10:00:00+08', '2046-12-02T12:00:00+08', 10,
  'u_shape', array[]::text[], array[]::text[], 'submitted',
  'Returned before anyone picked it up.', null, null);

create or replace function pg_temp.us37n_respond(
  event_number integer, updates jsonb, reply text
) returns uuid language plpgsql as $$
declare
  target uuid := ('37900000-1111-0000-0000-' || lpad(event_number::text, 12, '0'))::uuid;
begin
  return public.respond_to_clarification(
    target, updates, reply,
    (select updated_at from public.events where id = target));
end $$;

set role authenticated;

-- ===== AC-037.3 the assigned Coordinator is notified =====

select pg_temp.as_user('37900000-0000-0000-0000-000000000001');
select pg_temp.us37n_respond(1, '{"accessibility_requirements": ["lift_access"]}'::jsonb,
  'Six guests need step-free access, so lift access is required.');

-- Read from outside any session: the notice is the Coordinator's to see, so the Organiser
-- who triggered it cannot check their own work here.
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select count(*) = 1 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'
     and recipient_id = '37900000-0000-0000-0000-000000000002'),
 'AC-037.3.1: answering a clarification notifies the assigned Coordinator');

-- The notice is tied to the answered round, which is what makes it exactly-once.
select pg_temp.assert_true(
 (select n.response_id = r.id
    from public.clarification_response_notifications n
    join public.event_clarification_responses r on r.id = n.response_id
   where n.event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.2: the notice is keyed to the answer it reports');

-- Mail leaves our control, so neither the question nor the reply travels in it. Asserted
-- rather than trusted to review: a future edit to the wording would otherwise leak quietly.
select pg_temp.assert_true(
 (select subject not like '%step-free%' and body not like '%step-free%'
     and body not like '%Six guests%'
    from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.3: the notice carries neither the question nor the reply');

select pg_temp.assert_true(
 (select count(*) = 1 from public.notification_outbox o
    join public.clarification_response_notifications n on n.email_outbox_id = o.id
   where o.recipient_email = 'us37n-coord@example.test'
     and o.status = 'pending'
     and n.event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.4: the notice is queued for email to the Coordinator''s own address');

-- Nobody is assigned, so there is nobody to tell. Inventing a recipient here would be
-- worse than silence; US17 assignment is the dependency.
set role authenticated;
select pg_temp.as_user('37900000-0000-0000-0000-000000000001');
select pg_temp.us37n_respond(2, '{}'::jsonb, 'Nothing to change, just confirming.');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select count(*) = 0 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000002')
 and (select count(*) = 1 from public.event_clarification_responses
       where event_id = '37900000-1111-0000-0000-000000000002'),
 'AC-037.3.5: an unassigned request is still answered, but notifies nobody');

-- ===== AC-037.3 in the Coordinator's feed =====

set role authenticated;
select pg_temp.as_user('37900000-0000-0000-0000-000000000002');

select pg_temp.assert_true(
 (select count(*) = 1 from public.get_my_notifications(200) f
   where f.source = 'clarification_response'
     and f.event_id = '37900000-1111-0000-0000-000000000001'
     and f.event_reference = 'EVT-US37N-1'
     and f.read_at is null),
 'AC-037.3.6: the notice appears unread in the Coordinator''s feed');

-- The outbox exclusion. Without it the same notice arrives twice — once as itself and once
-- as a bare email — and the unread count is wrong for every user with mail enabled.
select pg_temp.assert_true(
 (select count(*) = 1 from public.get_my_notifications(200) f
   where f.event_id = '37900000-1111-0000-0000-000000000001'
     and f.title = 'An organiser has answered your clarification request'),
 'AC-037.3.7: the queued email is not also listed as a separate notice');

select pg_temp.assert_true(
 public.count_my_unread_notifications() >= 1,
 'AC-037.3.8: the notice counts towards the Coordinator''s unread total');

-- Needs the extended source CHECK on notification_reads. Without it this raises instead
-- of marking, which is the quiet failure the three-place registration invites.
select public.mark_notification_read('clarification_response',
  (select id from public.clarification_response_notifications
    where event_id = '37900000-1111-0000-0000-000000000001'));

select pg_temp.assert_true(
 (select count(*) = 1 from public.get_my_notifications(200) f
   where f.source = 'clarification_response'
     and f.event_id = '37900000-1111-0000-0000-000000000001'
     and f.read_at is not null),
 'AC-037.3.9: opening the notice marks it read');

-- ===== AC-037.3 nobody else =====

select pg_temp.as_user('37900000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
 (select count(*) = 0 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.10: the Organiser who answered cannot read the Coordinator''s notice');

select pg_temp.as_user('37900000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
 (select count(*) = 0 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.11: a Coordinator who is not the assignee cannot read it');

select pg_temp.expect_error(
  $q$insert into public.clarification_response_notifications
      (response_id, event_id, recipient_id, subject, body, in_app_enabled)
     values ((select id from public.event_clarification_responses
               where event_id = '37900000-1111-0000-0000-000000000001'),
             '37900000-1111-0000-0000-000000000001',
             '37900000-0000-0000-0000-000000000003', 's', 'b', true)$q$,
  '42501', 'AC-037.3.12: a notice cannot be written from the browser');

select pg_temp.expect_error(
  $q$select * from public.clarification_response_notification_settings$q$,
  '42501', 'AC-037.3.13: the channel settings are administrator-only');

-- What reassignment does to a notice already sent. 0046 settled this shape and 0097 keeps
-- it: a notice belongs to the person it was addressed to, and only for as long as they
-- still hold the event. It is not re-addressed to their successor, just as queued mail is
-- not re-routed. What does transfer is the answer itself, which is the thing the new
-- Coordinator actually needs, so the pair below states the limitation and its mitigation
-- together.
-- Reassigned as an administrator would: 0039 lets a coordinator change only the event they
-- hold, and resetting the role is not enough on its own — the claim has to go too, or
-- auth.uid() is still whoever was last signed in.
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.events set coordinator_id = '37900000-0000-0000-0000-000000000003'
 where id = '37900000-1111-0000-0000-000000000001';

set role authenticated;
select pg_temp.as_user('37900000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
 (select count(*) = 0 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.14: the new Coordinator inherits no notice addressed to their predecessor');

-- The mitigation: 0096's own read rule is keyed on the current assignment rather than on a
-- recipient, so the new Coordinator reads every answer given so far on the request itself.
select pg_temp.assert_true(
 (select count(*) >= 1 from public.event_clarification_responses
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.15: but does read the answers themselves on the request');

select pg_temp.as_user('37900000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
 (select count(*) = 0 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.16: and the Coordinator who no longer holds it keeps nothing');

-- A second round is a second occasion, so it gets its own notice rather than updating the
-- first — the Coordinator needs to know they have been answered again.
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.events set coordinator_id = '37900000-0000-0000-0000-000000000002'
 where id = '37900000-1111-0000-0000-000000000001';

set role authenticated;
select pg_temp.as_user('37900000-0000-0000-0000-000000000002');
update public.events set status = 'submitted',
       review_note = 'And how many need a hearing loop?'
 where id = '37900000-1111-0000-0000-000000000001';

select pg_temp.as_user('37900000-0000-0000-0000-000000000001');
select pg_temp.us37n_respond(1,
  '{"accessibility_requirements": ["lift_access", "hearing_loop"]}'::jsonb,
  'Two more need a hearing loop.');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select count(*) = 2 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'
     and recipient_id = '37900000-0000-0000-0000-000000000002'),
 'AC-037.3.17: a second answered round produces its own notice');

-- An administrator repairing data in the SQL editor has no auth.uid(), and should not send
-- anyone mail. Same exclusion 0046 makes for administrator assignment fixes.
insert into public.event_clarification_responses
  (event_id, round, responded_by, review_note, reply, before_values, after_values,
   answered_updated_at)
values ('37900000-1111-0000-0000-000000000001', 99,
        '37900000-0000-0000-0000-000000000001', 'repaired', 'repaired', '{}', '{}',
        '2046-01-01T00:00:00+08');

select pg_temp.assert_true(
 (select count(*) = 2 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'),
 'AC-037.3.18: an administrator repair records no notice');

delete from public.event_clarification_responses
 where event_id = '37900000-1111-0000-0000-000000000001' and round = 99;

-- Boundary on the channel settings: with in-app off the notice is still recorded and still
-- emailed, but it does not appear in the feed. The row keeps in_app_enabled as it was when
-- written, so turning the channel off later cannot retrospectively hide what was sent.
update public.clarification_response_notification_settings
   set in_app_enabled = false where notification_type = 'clarification_response';

set role authenticated;
select pg_temp.as_user('37900000-0000-0000-0000-000000000002');
update public.events set status = 'submitted', review_note = 'One last question.'
 where id = '37900000-1111-0000-0000-000000000001';

select pg_temp.as_user('37900000-0000-0000-0000-000000000001');
select pg_temp.us37n_respond(1, '{}'::jsonb, 'Nothing further.');

select pg_temp.as_user('37900000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
 (select count(*) = 0 from public.get_my_notifications(200) f
   where f.source = 'clarification_response'
     and f.id = (select id from public.clarification_response_notifications
                  where event_id = '37900000-1111-0000-0000-000000000001'
                    and in_app_enabled = false)),
 'AC-037.3.19: with the in-app channel off the notice stays out of the feed');

reset role;
select pg_temp.assert_true(
 (select count(*) = 1 from public.clarification_response_notifications
   where event_id = '37900000-1111-0000-0000-000000000001'
     and in_app_enabled = false
     and email_outbox_id is not null),
 'AC-037.3.20: it is still recorded and still emailed');

-- Regression guards for what 0097 replaces. 0079 (US33) is the latest definition of the
-- email list, the feed and the read-state CHECK; a replacement restated from 0072/0073
-- reverts it, which is exactly what happened here and what AC-033.4.1 caught.
select pg_temp.assert_true(
 (select prosrc like '%o.notification_type is null%'
    from pg_catalog.pg_proc
   where oid = 'public.my_email_notifications()'::regprocedure),
 'AC-037.3.22: replacing the email list keeps 0079''s typed-email filter');

select pg_temp.assert_true(
 (select prosrc like '%my_in_app_notices()%'
    from pg_catalog.pg_proc
   where oid = 'public.get_my_notifications(integer)'::regprocedure)
 and (select pg_get_constraintdef(oid) like '%''notice''%'
        from pg_catalog.pg_constraint
       where conname = 'notification_reads_source_check'),
 'AC-037.3.23: and the feed keeps 0079''s in-app notice source, read state included');

-- Restored, so later files in the run see the configured default rather than this file's
-- boundary case.
update public.clarification_response_notification_settings
   set in_app_enabled = true where notification_type = 'clarification_response';

select set_config('request.jwt.claim.sub', '', false);