-- Migration: 0085_us9_booking_request_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US9's booking-request notices follow each Venue Staff member's in-app choice. Disposable PostgreSQL only; run through the database
-- runner, which applies 0085_us9_booking_request_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0850000-0000-0000-0000-000000000001', 'organiser-0085@example.test'), ('a0850000-0000-0000-0000-000000000002', 'coordinator-0085@example.test'),
  ('a0850000-0000-0000-0000-000000000003', 'venue-one-0085@example.test'), ('a0850000-0000-0000-0000-000000000004', 'venue-two-0085@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0850000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0850000-0000-0000-0000-000000000002';
update public.profiles set role = 'venue_staff' where id in ('a0850000-0000-0000-0000-000000000003', 'a0850000-0000-0000-0000-000000000004');
insert into public.venues (id, name, location, capacity, layout, status) values ('a0851000-0000-0000-0000-000000000001', '0085 Hall', 'Level 1', 100, 'theatre', 'active');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0853000-0000-0000-0000-000000000001', 'a0850000-0000-0000-0000-000000000001', 'a0850000-0000-0000-0000-000000000002', '0085 Event', 'Fixture', '2040-06-01 09:00+08', '2040-06-01 11:00+08', 20, 'planning', 'EVT-0085');
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0850000-0000-0000-0000-000000000004', 'venue_booking_request', false, true);

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('a0855000-0000-0000-0000-000000000001', 'a0853000-0000-0000-0000-000000000001', 'a0851000-0000-0000-0000-000000000001', 'a0850000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days');
select pg_temp.assert_true(
  (select count(*) = 1 from public.venue_booking_notifications where venue_booking_id = 'a0855000-0000-0000-0000-000000000001' and recipient_id = 'a0850000-0000-0000-0000-000000000003')
  and not exists (select 1 from public.venue_booking_notifications where venue_booking_id = 'a0855000-0000-0000-0000-000000000001' and recipient_id = 'a0850000-0000-0000-0000-000000000004'),
  'AC-033.4.21: a new booking request reaches each Venue Staff member who has it on in-app, and not one who turned it off');

rollback;
