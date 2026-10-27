-- Migration: 0095_us4_decision_keeps_withdrawal.sql
-- US33 slice 2b (SCRUM-230): US4's decision notices follow the Organiser's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0095_us4_decision_keeps_withdrawal.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0800000-0000-0000-0000-000000000001', 'organiser-0080@example.test'), ('a0800000-0000-0000-0000-000000000002', 'coordinator-0080@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0800000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0800000-0000-0000-0000-000000000002';
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('08000003-0000-0000-0000-000000000001', 'a0800000-0000-0000-0000-000000000001', 'a0800000-0000-0000-0000-000000000002', '0080 One', 'Fixture', '2040-01-01 09:00+08', '2040-01-01 11:00+08', 20, 'under_review', 'EVT-0080-1'),
  ('08000003-0000-0000-0000-000000000002', 'a0800000-0000-0000-0000-000000000001', 'a0800000-0000-0000-0000-000000000002', '0080 Two', 'Fixture', '2040-01-02 09:00+08', '2040-01-02 11:00+08', 20, 'under_review', 'EVT-0080-2');

select set_config('request.jwt.claim.sub', 'a0800000-0000-0000-0000-000000000002', true);
update public.events set status = 'approved', review_note = 'Looks good' where id = '08000003-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox o
   join public.event_review_decisions d on d.id = o.decision_id
   where o.recipient_id = 'a0800000-0000-0000-0000-000000000001' and o.notification_type = 'event_request_decision'
     and o.subject = 'Your event request EVT-0080-1 was approved' and d.event_id = '08000003-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.user_notifications
       where recipient_id = 'a0800000-0000-0000-0000-000000000001' and type_code = 'event_request_decision' and event_id = '08000003-0000-0000-0000-000000000001'),
  'AC-033.4.12: a decision reaches the Organiser by email as before, still linked to its decision, and in the app');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0800000-0000-0000-0000-000000000001', 'event_request_decision', true, false);
select set_config('request.jwt.claim.sub', 'a0800000-0000-0000-0000-000000000002', true);
update public.events set status = 'rejected', review_note = 'Venue too small' where id = '08000003-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  not exists (select 1 from public.notification_outbox where event_id = '08000003-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.user_notifications where recipient_id = 'a0800000-0000-0000-0000-000000000001' and event_id = '08000003-0000-0000-0000-000000000002'),
  'AC-033.4.13: an Organiser who turns decision emails off gets decisions only in the app');

-- A withdrawal is still logged as its own outcome (US22, AC-022.2.11). 0080 had lost this; 0095
-- restores it. Withdrawals are logged, not notified, as before.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('08000003-0000-0000-0000-000000000003', 'a0800000-0000-0000-0000-000000000001', 'a0800000-0000-0000-0000-000000000002',
   '0080 Three', 'Fixture', '2040-01-03 09:00+08', '2040-01-03 11:00+08', 20, 'under_review', 'EVT-0080-3');
select set_config('request.jwt.claim.sub', 'a0800000-0000-0000-0000-000000000002', true);
update public.events set status = 'withdrawn', review_note = 'Organiser asked to stop' where id = '08000003-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.event_review_decisions
   where event_id = '08000003-0000-0000-0000-000000000003' and decision = 'withdrawn' and reason = 'Organiser asked to stop')
  and not exists (select 1 from public.notification_outbox where event_id = '08000003-0000-0000-0000-000000000003')
  and not exists (select 1 from public.user_notifications where event_id = '08000003-0000-0000-0000-000000000003'),
  'AC-033.4.30: a withdrawal is still logged as its own outcome with its reason, and is not notified, as before');

rollback;
