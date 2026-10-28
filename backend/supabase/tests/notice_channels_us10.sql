-- Migration: 0086_us10_booking_decision_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US10's booking-decision notices follow the Coordinator's in-app choice. Disposable PostgreSQL only; run through the database
-- runner, which applies 0086_us10_booking_decision_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0860000-0000-0000-0000-000000000001', 'organiser-0086@example.test'), ('a0860000-0000-0000-0000-000000000002', 'coordinator-0086@example.test'), ('a0860000-0000-0000-0000-000000000003', 'venue-0086@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0860000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0860000-0000-0000-0000-000000000002';
update public.profiles set role = 'venue_staff' where id = 'a0860000-0000-0000-0000-000000000003';
insert into public.venues (id, name, location, capacity, layout, status) values ('a0861000-0000-0000-0000-000000000001', '0086 Hall', 'Level 1', 100, 'theatre', 'active');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0863000-0000-0000-0000-000000000001', 'a0860000-0000-0000-0000-000000000001', 'a0860000-0000-0000-0000-000000000002', '0086 One', 'Fixture', '2040-07-01 09:00+08', '2040-07-01 11:00+08', 20, 'planning', 'EVT-0086-1'),
  ('a0863000-0000-0000-0000-000000000002', 'a0860000-0000-0000-0000-000000000001', 'a0860000-0000-0000-0000-000000000002', '0086 Two', 'Fixture', '2040-07-02 09:00+08', '2040-07-02 11:00+08', 20, 'planning', 'EVT-0086-2');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('a0865000-0000-0000-0000-000000000001', 'a0863000-0000-0000-0000-000000000001', 'a0861000-0000-0000-0000-000000000001', 'a0860000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('a0865000-0000-0000-0000-000000000002', 'a0863000-0000-0000-0000-000000000002', 'a0861000-0000-0000-0000-000000000001', 'a0860000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days');

select set_config('request.jwt.claim.sub', 'a0860000-0000-0000-0000-000000000003', true);
update public.venue_bookings set status = 'rejected', review_note = 'Closed for repairs', reviewed_by = 'a0860000-0000-0000-0000-000000000003', reviewed_at = now()
  where id = 'a0865000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '', true);
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0860000-0000-0000-0000-000000000002', 'venue_booking_decision', false, true);
select set_config('request.jwt.claim.sub', 'a0860000-0000-0000-0000-000000000003', true);
update public.venue_bookings set status = 'rejected', review_note = 'Double booked', reviewed_by = 'a0860000-0000-0000-0000-000000000003', reviewed_at = now()
  where id = 'a0865000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.venue_booking_decision_notifications where booking_id = 'a0865000-0000-0000-0000-000000000001' and recipient_id = 'a0860000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.venue_booking_decision_notifications where booking_id = 'a0865000-0000-0000-0000-000000000002')
  and (select status = 'rejected' from public.venue_bookings where id = 'a0865000-0000-0000-0000-000000000002'),
  'AC-033.4.22: a booking decision reaches the Coordinator in the app as before, unless they turned it off; the decision itself stands');

rollback;
