-- US38 (SCRUM-291): the 14th status, 'postponed' (0119), and who may reach and leave it.
-- Hiding a button is a courtesy; these are the control.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('b3800000-0000-0000-0000-000000000001', 'l38-organiser@example.test', '{}'),
 ('b3800000-0000-0000-0000-000000000002', 'l38-coord@example.test', '{}');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = 'b3800000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'b3800000-0000-0000-0000-000000000002';

-- 101 confirmed, 102 approved (too early to postpone; a draft cannot have a Coordinator, 0039), 103 completed (closed).
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b3800000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b3800000-0000-0000-0000-000000000001',
       'b3800000-0000-0000-0000-000000000002',
       'Lifecycle fixture', 'Lifecycle event ' || n, 'EVT-L38-' || n,
       '2046-06-01T13:00:00+08'::timestamptz + (n - 101) * interval '2 days',
       '2046-06-01T16:00:00+08'::timestamptz + (n - 101) * interval '2 days',
       40,
       case n when 101 then 'confirmed' when 102 then 'approved' else 'completed' end
from generate_series(101, 103) n;

select pg_temp.assert_true(
 (select count(*) = 1 from pg_constraint
  where conname = 'events_status_valid'
    and pg_get_constraintdef(oid) like '%''postponed''%'),
 'AC-038.1.2: ''postponed'' is an accepted event status');

select pg_temp.assert_true(
 public.is_valid_status_transition('confirmed', 'postponed')
 and public.is_valid_status_transition('in_preparation', 'postponed')
 and public.is_valid_status_transition('planning', 'postponed')
 and public.is_valid_status_transition('postponed', 'planning')
 and public.is_valid_status_transition('postponed', 'cancelled'),
 'AC-038.2.6: a planned event can be postponed, then re-planned or cancelled');

select pg_temp.assert_true(
 not public.is_valid_status_transition('draft', 'postponed')
 and not public.is_valid_status_transition('approved', 'postponed')
 and not public.is_valid_status_transition('completed', 'postponed')
 and not public.is_valid_status_transition('postponed', 'confirmed')
 and not public.is_valid_status_transition('postponed', 'completed'),
 'AC-038.2.7: early or closed events cannot be postponed, and postponed cannot skip back to Confirmed');

set role authenticated;

select pg_temp.as_user('b3800000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$update public.events set status = 'postponed' where id = 'b3800000-0000-0000-0000-000000000101'$q$,
 '42501',
 'AC-038.2.8: the organiser cannot postpone their own confirmed event');

select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
 $q$update public.events set status = 'postponed' where id = 'b3800000-0000-0000-0000-000000000102'$q$,
 '22000',
 'AC-038.2.9: an Approved event cannot be postponed even by its Coordinator');
select pg_temp.expect_error(
 $q$update public.events set status = 'postponed' where id = 'b3800000-0000-0000-0000-000000000103'$q$,
 '22000',
 'AC-038.2.10: a completed event cannot be postponed');

update public.events set status = 'postponed' where id = 'b3800000-0000-0000-0000-000000000101';
select pg_temp.assert_true(
 (select status = 'postponed' from public.events where id = 'b3800000-0000-0000-0000-000000000101'),
 'AC-038.2.11: the Coordinator postpones a confirmed event');

select pg_temp.as_user('b3800000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$update public.events set status = 'planning' where id = 'b3800000-0000-0000-0000-000000000101'$q$,
 '42501',
 'AC-038.2.12: the organiser cannot resume a postponed event');

select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
update public.events set status = 'planning' where id = 'b3800000-0000-0000-0000-000000000101';
select pg_temp.assert_true(
 (select status = 'planning' from public.events where id = 'b3800000-0000-0000-0000-000000000101'),
 'AC-038.2.13: the Coordinator resumes a postponed event into Planning');

-- ===== AC-038.6 completing needs the end to have passed =====
-- 104 confirmed, ended long ago; 105 confirmed, ends in the future; 106 confirmed, ended 3 days ago;
-- 107 confirmed, ended 8 days ago. 105 is the only one that must refuse.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b3800000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b3800000-0000-0000-0000-000000000001',
       'b3800000-0000-0000-0000-000000000002',
       'Completion fixture', 'Completion event ' || n, 'EVT-L38-' || n,
       e - interval '3 hours', e, 40, 'confirmed'
from (values (104, '2020-01-02T16:00:00+08'::timestamptz),
             (105, now() + interval '30 days'),
             (106, now() - interval '3 days'),
             (107, now() - interval '8 days')) v(n, e);

set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
 $q$update public.events set status = 'completed' where id = 'b3800000-0000-0000-0000-000000000105'$q$,
 '22000',
 'AC-038.6.4: the Coordinator cannot complete an event that has not ended');
update public.events set status = 'completed' where id = 'b3800000-0000-0000-0000-000000000104';
select pg_temp.assert_true(
 (select status = 'completed' from public.events where id = 'b3800000-0000-0000-0000-000000000104'),
 'AC-038.6.5: the Coordinator completes an event once it has ended');

-- ===== AC-038.7 automatic completion 7 days after the end =====
reset role;
select set_config('request.jwt.claim.sub', '', false);
select public.complete_overdue_events();
select pg_temp.assert_true(
 (select status = 'confirmed' from public.events where id = 'b3800000-0000-0000-0000-000000000106')
 and (select status = 'confirmed' from public.events where id = 'b3800000-0000-0000-0000-000000000105'),
 'AC-038.7.1: an event that ended 3 days ago, or has not ended, is left Confirmed');
select pg_temp.assert_true(
 (select status = 'completed' from public.events where id = 'b3800000-0000-0000-0000-000000000107'),
 'AC-038.7.2: an event that ended 8 days ago becomes Completed automatically');
select pg_temp.assert_true(
 (select count(*) = 1 from public.event_audit_log
   where event_id = 'b3800000-0000-0000-0000-000000000107'
     and new_values->>'status' = 'completed' and actor_id is null),
 'AC-038.9.1: the automatic completion is in the audit trail with no invented actor');

-- ===== AC-038.9 the audit trail records postponed and completed with who and when =====
select pg_temp.assert_true(
 (select count(*) = 1 from public.event_audit_log
   where event_id = 'b3800000-0000-0000-0000-000000000101' and action = 'status_changed'
     and new_values->>'status' = 'postponed'
     and actor_id = 'b3800000-0000-0000-0000-000000000002'),
 'AC-038.9.2: postponing is recorded once, with the Coordinator as actor');
select pg_temp.assert_true(
 (select count(*) = 1 from public.event_audit_log
   where event_id = 'b3800000-0000-0000-0000-000000000104'
     and new_values->>'status' = 'completed'
     and actor_id = 'b3800000-0000-0000-0000-000000000002'),
 'AC-038.9.3: a Coordinator completion is recorded with the Coordinator as actor');

-- ===== AC-038.5 the Organiser is told when a Confirmed event stops being Confirmed =====
-- 101 was postponed above (a Coordinator moved it off Confirmed); 104 and 107 were completed,
-- which is the expected end and must not be announced.
select pg_temp.assert_true(
 (select count(*) = 1 from public.user_notifications
   where recipient_id = 'b3800000-0000-0000-0000-000000000001'
     and type_code = 'event_status_change'
     and event_id = 'b3800000-0000-0000-0000-000000000101'),
 'AC-038.5.1: postponing a confirmed event notifies its Organiser once');
select pg_temp.assert_true(
 (select count(*) = 0 from public.user_notifications
   where type_code = 'event_status_change'
     and event_id in ('b3800000-0000-0000-0000-000000000104', 'b3800000-0000-0000-0000-000000000107')),
 'AC-038.5.2: completing an event is not announced as it no longer being confirmed');

-- ===== More fixtures: boundaries, closed events, a second Coordinator =====
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, email, raw_user_meta_data) values
 ('b3800000-0000-0000-0000-000000000003', 'l38-coord-other@example.test', '{}');
update public.profiles set role = 'coordinator' where id = 'b3800000-0000-0000-0000-000000000003';
insert into public.equipment_types (id, name, category) values
 ('b3800000-0000-0000-0000-0000000000e1', 'US38 projector', 'Visual');

-- 108 confirmed, ended 7 days less a minute ago; 109 confirmed, ended 7 days and a minute ago;
-- 110 cancelled, 111 rejected, 112 withdrawn, 113 postponed, 114 under review (for approval).
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b3800000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b3800000-0000-0000-0000-000000000001',
       'b3800000-0000-0000-0000-000000000002',
       'Closed fixture', 'Closed event ' || n, 'EVT-L38-' || n,
       now() + interval '60 days', now() + interval '60 days 3 hours', 40, st
from (values (108, 'confirmed'), (109, 'confirmed'), (110, 'cancelled'), (111, 'rejected'),
             (112, 'withdrawn'), (113, 'postponed'), (114, 'under_review')) v(n, st);
update public.events set proposed_start = now() - interval '7 days 3 hours' + interval '1 minute',
                         proposed_end = now() - interval '7 days' + interval '1 minute'
 where id = 'b3800000-0000-0000-0000-000000000108';
update public.events set proposed_start = now() - interval '7 days 3 hours' - interval '1 minute',
                         proposed_end = now() - interval '7 days' - interval '1 minute'
 where id = 'b3800000-0000-0000-0000-000000000109';

-- ===== AC-038.1 exactly the agreed statuses =====
select pg_temp.expect_error(
 $q$update public.events set status = 'returned_for_clarification'
    where id = 'b3800000-0000-0000-0000-000000000114'$q$,
 '23514',
 'AC-038.1.3: a status outside the 14 is refused (Returned for Clarification is submitted + a note, not a stored status)');
select pg_temp.assert_true(
 (select count(*) = 14 from unnest(array['draft','submitted','under_review','approved','planning',
   'awaiting_safety_review','safety_changes_requested','in_preparation','confirmed','postponed',
   'completed','cancelled','rejected','withdrawn']) s
  where exists (select 1 from pg_constraint c where c.conname = 'events_status_valid'
                  and pg_get_constraintdef(c.oid) like '%''' || s || '''%')),
 'AC-038.1.4: all 14 statuses are in the CHECK constraint');

-- ===== AC-038.2 closed statuses are terminal =====
select pg_temp.assert_true(
 not exists (
   select 1 from unnest(array['completed','cancelled','rejected','withdrawn']) f,
                 unnest(array['draft','submitted','under_review','approved','planning',
                   'awaiting_safety_review','safety_changes_requested','in_preparation','confirmed',
                   'postponed','completed','cancelled','rejected','withdrawn']) t
   where public.is_valid_status_transition(f, t)),
 'AC-038.2.14: a completed, cancelled, rejected or withdrawn event cannot move to any status');

set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
 $q$update public.events set status = 'confirmed' where id = 'b3800000-0000-0000-0000-000000000111'$q$,
 '22000',
 'AC-038.2.15: a rejected event cannot be revived to Confirmed by the database');
select pg_temp.expect_error(
 $q$update public.events set status = 'planning' where id = 'b3800000-0000-0000-0000-000000000110'$q$,
 '22000',
 'AC-038.2.16: a cancelled event cannot move back to Planning');
select pg_temp.expect_error(
 $q$update public.events set status = 'confirmed' where id = 'b3800000-0000-0000-0000-000000000113'$q$,
 '22000',
 'AC-038.2.17: a postponed event cannot jump straight back to Confirmed');

-- Only the assigned Coordinator acts on the event (0039), so a different Coordinator cannot postpone it.
select pg_temp.as_user('b3800000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
 $q$update public.events set status = 'postponed' where id = 'b3800000-0000-0000-0000-000000000108'$q$,
 '42501',
 'AC-038.2.18: a Coordinator who is not assigned to the event cannot postpone it');

-- ===== AC-038.3 approving creates no booking and no reservation =====
reset role;
select set_config('request.jwt.claim.sub', '', false);
create temporary table l38_before as
 select (select count(*) from public.venue_bookings) as all_venue_rows,
        (select count(*) from public.equipment_bookings) as all_equipment_rows;
set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
update public.events set status = 'approved' where id = 'b3800000-0000-0000-0000-000000000114';
reset role;
select pg_temp.assert_true(
 (select status = 'approved' from public.events where id = 'b3800000-0000-0000-0000-000000000114')
 and (select count(*) from public.venue_bookings where event_id = 'b3800000-0000-0000-0000-000000000114') = 0
 and (select count(*) from public.equipment_bookings where event_id = 'b3800000-0000-0000-0000-000000000114') = 0
 and (select count(*) from public.venue_bookings) = (select all_venue_rows from l38_before)
 and (select count(*) from public.equipment_bookings) = (select all_equipment_rows from l38_before),
 'AC-038.3.1: approving an event creates no venue booking and no equipment booking');

-- ===== AC-038.4 closed events (and postponed ones) take no planning actions =====
set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
 $q$insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('b3800000-0000-0000-0000-000000000103', 'b3800000-0000-0000-0000-0000000000e1', 1)$q$,
 '22000', 'AC-038.4.1: no equipment requirement can be added to a Completed event');
select pg_temp.expect_error(
 $q$insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('b3800000-0000-0000-0000-000000000110', 'b3800000-0000-0000-0000-0000000000e1', 1)$q$,
 '22000', 'AC-038.4.2: no equipment requirement can be added to a Cancelled event');
select pg_temp.expect_error(
 $q$insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('b3800000-0000-0000-0000-000000000111', 'b3800000-0000-0000-0000-0000000000e1', 1)$q$,
 '22000', 'AC-038.4.3: no equipment requirement can be added to a Rejected event');
select pg_temp.expect_error(
 $q$insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('b3800000-0000-0000-0000-000000000112', 'b3800000-0000-0000-0000-0000000000e1', 1)$q$,
 '22000', 'AC-038.4.4: no equipment requirement can be added to a Withdrawn event');
select pg_temp.expect_error(
 $q$insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('b3800000-0000-0000-0000-000000000113', 'b3800000-0000-0000-0000-0000000000e1', 1)$q$,
 '22000', 'AC-038.4.5: a Postponed event takes no planning actions until it is resumed');

-- ===== AC-038.8 completed events are read-only =====
select pg_temp.expect_error(
 $q$update public.events set name = 'Edited after completion' where id = 'b3800000-0000-0000-0000-000000000103'$q$,
 '42501', 'AC-038.8.1: the Coordinator cannot edit the details of a Completed event');
select pg_temp.as_user('b3800000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$update public.events set name = 'Edited by organiser' where id = 'b3800000-0000-0000-0000-000000000103'$q$,
 '42501', 'AC-038.8.2: the Organiser cannot edit the details of a Completed event');
select pg_temp.assert_true(
 (select count(*) = 1 from public.events where id = 'b3800000-0000-0000-0000-000000000103' and status = 'completed'),
 'AC-038.8.3: a Completed event stays readable as a historical record');

-- ===== AC-038.7 the 7-day boundary =====
reset role;
select set_config('request.jwt.claim.sub', '', false);
select public.complete_overdue_events();
select pg_temp.assert_true(
 (select status = 'confirmed' from public.events where id = 'b3800000-0000-0000-0000-000000000108')
 and (select status = 'completed' from public.events where id = 'b3800000-0000-0000-0000-000000000109'),
 'AC-038.7.3: ended 7 days less a minute ago stays Confirmed; ended 7 days and a minute ago becomes Completed');
select pg_temp.assert_true(
 public.complete_overdue_events() = 0,
 'AC-038.7.4: running the job again completes nothing more (idempotent)');
select pg_temp.assert_true(
 (select status = 'postponed' from public.events where id = 'b3800000-0000-0000-0000-000000000113'),
 'AC-038.7.5: only Confirmed events auto-complete; a Postponed one is left alone');

-- ===== AC-038.5 more notification cases =====
set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
update public.events set status = 'cancelled' where id = 'b3800000-0000-0000-0000-000000000108';
reset role;
select pg_temp.assert_true(
 (select count(*) = 1 from public.user_notifications
   where recipient_id = 'b3800000-0000-0000-0000-000000000001'
     and type_code = 'event_status_change'
     and event_id = 'b3800000-0000-0000-0000-000000000108'),
 'AC-038.5.3: cancelling a confirmed event notifies its Organiser');
select pg_temp.assert_true(
 (select count(*) = 0 from public.user_notifications
   where type_code = 'event_status_change' and event_id = 'b3800000-0000-0000-0000-000000000110'),
 'AC-038.5.4: an event that was never Confirmed (cancelled from another status) sends no such notice');

-- ===== AC-038.5 an approved significant change takes a Confirmed event out of Confirmed (0121) =====
-- 115 confirmed + significant change, 116 confirmed + ordinary change, 117 planning + significant
-- change, 118 confirmed with no change request (direct move attempt), 119 confirmed + significant
-- change that is rejected.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b3800000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b3800000-0000-0000-0000-000000000001',
       'b3800000-0000-0000-0000-000000000002',
       'Change fixture', 'Change event ' || n, 'EVT-L38-' || n,
       now() + interval '90 days', now() + interval '90 days 3 hours', 40, st
from (values (115, 'confirmed'), (116, 'confirmed'), (117, 'planning'),
             (118, 'confirmed'), (119, 'confirmed')) v(n, st);
insert into public.event_change_requests (id, event_id, organiser_id, proposed_changes, reason)
select ('b3800000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
       ('b3800000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b3800000-0000-0000-0000-000000000001', proposal, 'US38 change'
from (values (115, '{"expectedAttendance":"80"}'::jsonb), (116, '{"name":"Renamed only"}'::jsonb),
             (117, '{"expectedAttendance":"80"}'::jsonb), (119, '{"expectedAttendance":"80"}'::jsonb)) v(n, proposal);
create function pg_temp.l38_review(n integer, decisions jsonb) returns text language sql as $$
 select public.review_event_change_request(
  ('b3800000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
  (select updated_at from public.events where id = ('b3800000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid),
  jsonb_build_object('action', 'decide', 'decisions', decisions));
$$;

set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
select pg_temp.l38_review(115, '[{"field":"expectedAttendance","decision":"approved"}]');
select pg_temp.l38_review(116, '[{"field":"name","decision":"approved"}]');
select pg_temp.l38_review(117, '[{"field":"expectedAttendance","decision":"approved"}]');
select pg_temp.l38_review(119, '[{"field":"expectedAttendance","decision":"rejected","note":"Keep as is"}]');
reset role;

select pg_temp.assert_true(
 (select status = 'planning' and expected_attendance = 80 from public.events where id = 'b3800000-0000-0000-0000-000000000115'),
 'AC-038.5.5: approving a significant change moves a Confirmed event back to Planning, with the change applied');
select pg_temp.assert_true(
 (select count(*) = 1 from public.user_notifications
   where recipient_id = 'b3800000-0000-0000-0000-000000000001'
     and type_code = 'event_status_change'
     and event_id = 'b3800000-0000-0000-0000-000000000115'),
 'AC-038.5.6: the Organiser is notified when the approved change takes the event out of Confirmed');
select pg_temp.assert_true(
 (select count(*) = 1 from public.event_audit_log
   where event_id = 'b3800000-0000-0000-0000-000000000115'
     and action = 'status_changed' and new_values->>'status' = 'planning'
     and actor_id = 'b3800000-0000-0000-0000-000000000002'),
 'AC-038.5.7: the move is in the audit trail with the approving Coordinator as actor');
select pg_temp.assert_true(
 (select status = 'confirmed' from public.events where id = 'b3800000-0000-0000-0000-000000000116'),
 'AC-038.5.8: approving an ordinary change leaves the event Confirmed');
select pg_temp.assert_true(
 (select status = 'confirmed' from public.events where id = 'b3800000-0000-0000-0000-000000000119'),
 'AC-038.5.9: rejecting a significant change leaves the event Confirmed');
select pg_temp.assert_true(
 (select status = 'planning' from public.events where id = 'b3800000-0000-0000-0000-000000000117')
 and (select count(*) = 0 from public.user_notifications
       where type_code = 'event_status_change' and event_id = 'b3800000-0000-0000-0000-000000000117'),
 'AC-038.5.10: an event not yet Confirmed is not moved and sends no such notice');

set role authenticated;
select pg_temp.as_user('b3800000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
 $q$update public.events set status = 'planning' where id = 'b3800000-0000-0000-0000-000000000118'$q$,
 '42501',
 'AC-038.5.11: nobody moves a Confirmed event back to Planning by hand');
reset role;
