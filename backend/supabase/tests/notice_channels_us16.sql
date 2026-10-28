-- Migration: 0092_us16_waitlist_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US16's waiting-list notices follow the Attendee's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0092_us16_waitlist_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0920000-0000-0000-0000-000000000001', 'organiser-0092@example.test'), ('a0920000-0000-0000-0000-000000000002', 'attendee-0092@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0920000-0000-0000-0000-000000000001';
update public.profiles set role = 'attendee' where id = 'a0920000-0000-0000-0000-000000000002';
insert into public.events (id, organiser_id, name, purpose, proposed_start, proposed_end, expected_attendance, registration_required, status, reference) values
  ('a0923000-0000-0000-0000-000000000001', 'a0920000-0000-0000-0000-000000000001', '0092 Talks', 'Fixture', '2040-11-01 09:00+08', '2040-11-01 11:00+08', 20, true, 'confirmed', 'EVT-0092');

insert into public.event_waitlist_entries (id, event_id, attendee_id) values ('a0927000-0000-0000-0000-000000000001', 'a0923000-0000-0000-0000-000000000001', 'a0920000-0000-0000-0000-000000000002');
select (select count(*) = 1 from public.notification_outbox where recipient_id = 'a0920000-0000-0000-0000-000000000002' and notification_type = 'waitlist_update'
        and subject = 'You are on the waiting list for 0092 Talks')
   and (select count(*) = 1 from public.user_notifications where recipient_id = 'a0920000-0000-0000-0000-000000000002' and subject = 'You are on the waiting list for 0092 Talks')
   as us33_joined \gset
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0920000-0000-0000-0000-000000000002', 'waitlist_update', false, true);
update public.event_waitlist_entries set status = 'offered', offered_at = now(), offer_expires_at = now() + interval '3 days'
  where id = 'a0927000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  :'us33_joined'
  and (select count(*) = 1 from public.notification_outbox where recipient_id = 'a0920000-0000-0000-0000-000000000002' and subject = 'A place is available for 0092 Talks')
  and not exists (select 1 from public.user_notifications where recipient_id = 'a0920000-0000-0000-0000-000000000002' and subject = 'A place is available for 0092 Talks'),
  'AC-033.4.29: joining reaches the Attendee in both channels as before; with in-app off, an offer is only emailed');

rollback;
