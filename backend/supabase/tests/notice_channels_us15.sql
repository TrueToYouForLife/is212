-- Migration: 0090_us15_registration_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US15's registration confirmations follow the Attendee's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0090_us15_registration_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0900000-0000-0000-0000-000000000001', 'organiser-0090@example.test'), ('a0900000-0000-0000-0000-000000000002', 'attendee-0090@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0900000-0000-0000-0000-000000000001';
update public.profiles set role = 'attendee' where id = 'a0900000-0000-0000-0000-000000000002';
insert into public.events (id, organiser_id, name, purpose, proposed_start, proposed_end, expected_attendance, registration_required, status, reference) values
  ('a0903000-0000-0000-0000-000000000001', 'a0900000-0000-0000-0000-000000000001', '0090 Talks', 'Fixture', '2040-11-01 09:00+08', '2040-11-01 11:00+08', 20, true, 'confirmed', 'EVT-0090');

insert into public.event_registrations (event_id, attendee_id, phone) values ('a0903000-0000-0000-0000-000000000001', 'a0900000-0000-0000-0000-000000000002', '91234567');
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox where recipient_id = 'a0900000-0000-0000-0000-000000000002' and notification_type = 'registration_update'
       and subject = 'You are registered for 0090 Talks')
  and (select count(*) = 1 from public.user_notifications where recipient_id = 'a0900000-0000-0000-0000-000000000002' and subject = 'You are registered for 0090 Talks'),
  'AC-033.4.27: a registration confirmation reaches the Attendee by email as before, and in the app');

rollback;
