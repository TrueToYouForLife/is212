-- Migration: 0087_us20_arrangement_review_notice_channels.sql
-- US33 slice 2b (SCRUM-230): arrangement-review notices (US20, US41) follow the Coordinator's in-app choice. Disposable PostgreSQL only; run through the database
-- runner, which applies 0087_us20_arrangement_review_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0870000-0000-0000-0000-000000000001', 'organiser-0087@example.test'), ('a0870000-0000-0000-0000-000000000002', 'coordinator-0087@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0870000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0870000-0000-0000-0000-000000000002';
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0873000-0000-0000-0000-000000000001', 'a0870000-0000-0000-0000-000000000001', 'a0870000-0000-0000-0000-000000000002', '0087 Event', 'Fixture', '2040-08-01 09:00+08', '2040-08-01 11:00+08', 20, 'planning', 'EVT-0087');

insert into public.venues (id, name, location, capacity, layout, status) values ('a0871000-0000-0000-0000-000000000001', '0087 Hall', 'Level 1', 100, 'theatre', 'active');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('a0875000-0000-0000-0000-000000000001', 'a0873000-0000-0000-0000-000000000001', 'a0871000-0000-0000-0000-000000000001', 'a0870000-0000-0000-0000-000000000002', 'confirmed', null);

-- A review is about one booking and names where it came from; here, a planning update (US20).
insert into public.event_planning_updates (id, event_id, changed_by, changed_by_name, changes)
values ('a0876000-0000-0000-0000-000000000001', 'a0873000-0000-0000-0000-000000000001', 'a0870000-0000-0000-0000-000000000002', 'Fixture Coordinator', '{"expected_attendance": 120}');

select public.record_arrangement_review(null, 'a0873000-0000-0000-0000-000000000001', 'a0875000-0000-0000-0000-000000000001', null, 'venue_capacity', 'Attendance now exceeds capacity', 'a0876000-0000-0000-0000-000000000001');
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0870000-0000-0000-0000-000000000002', 'arrangement_review', false, true);
select public.record_arrangement_review(null, 'a0873000-0000-0000-0000-000000000001', 'a0875000-0000-0000-0000-000000000001', null, 'venue_layout_review', 'Layout no longer suits', 'a0876000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select count(*) = 2 from public.arrangement_review_flags where event_id = 'a0873000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.arrangement_review_notifications where event_id = 'a0873000-0000-0000-0000-000000000001' and recipient_id = 'a0870000-0000-0000-0000-000000000002')
  and (select detail = 'Attendance now exceeds capacity' from public.arrangement_review_notifications where event_id = 'a0873000-0000-0000-0000-000000000001'),
  'AC-033.4.23: every arrangement needing review is still flagged; the Coordinator is told in-app unless they turned it off');

rollback;
