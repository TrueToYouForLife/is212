-- Migration: 0091_us23_withdrawal_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US23's withdrawal confirmations follow the Attendee's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0091_us23_withdrawal_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0910000-0000-0000-0000-000000000001', 'organiser-0091@example.test'), ('a0910000-0000-0000-0000-000000000002', 'attendee-0091@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0910000-0000-0000-0000-000000000001';
update public.profiles set role = 'attendee' where id = 'a0910000-0000-0000-0000-000000000002';
insert into public.events (id, organiser_id, name, purpose, proposed_start, proposed_end, expected_attendance, registration_required, status, reference) values
  ('a0913000-0000-0000-0000-000000000001', 'a0910000-0000-0000-0000-000000000001', '0091 Talks', 'Fixture', '2040-11-01 09:00+08', '2040-11-01 11:00+08', 20, true, 'confirmed', 'EVT-0091');

insert into public.event_registrations (id, event_id, attendee_id, phone) values ('a0917000-0000-0000-0000-000000000001', 'a0913000-0000-0000-0000-000000000001', 'a0910000-0000-0000-0000-000000000002', '91234567');
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0910000-0000-0000-0000-000000000002', 'registration_update', true, false);
update public.event_registrations set status = 'withdrawn', withdrawn_at = now() where id = 'a0917000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  not exists (select 1 from public.notification_outbox where recipient_id = 'a0910000-0000-0000-0000-000000000002' and subject like 'You have withdrawn from %')
  and (select count(*) = 1 from public.user_notifications where recipient_id = 'a0910000-0000-0000-0000-000000000002' and subject = 'You have withdrawn from 0091 Talks'),
  'AC-033.4.28: an Attendee who turns registration emails off gets the withdrawal confirmation only in the app');

rollback;
