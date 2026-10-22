-- Migration: 0088_us46_venue_change_review_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US46's venue-change review notices follow the Coordinator's in-app choice. Disposable PostgreSQL only; run through the database
-- runner, which applies 0088_us46_venue_change_review_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Production's rule from 0067: a venue change can be a review's source. The runner replays
-- 0063 after 0067, which puts back the older rule, so restore it for this test.
alter table public.arrangement_review_flags drop constraint if exists arrangement_review_source;
alter table public.arrangement_review_flags add constraint arrangement_review_source
  check (num_nonnulls(change_request_id, planning_update_id, venue_change_id) = 1);

insert into auth.users (id, email) values
  ('a0880000-0000-0000-0000-000000000001', 'organiser-0088@example.test'), ('a0880000-0000-0000-0000-000000000002', 'coordinator-0088@example.test'), ('a0880000-0000-0000-0000-000000000003', 'venue-0088@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0880000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0880000-0000-0000-0000-000000000002';
update public.profiles set role = 'venue_staff' where id = 'a0880000-0000-0000-0000-000000000003';
insert into public.venues (id, name, location, capacity, layout, status) values ('a0881000-0000-0000-0000-000000000001', '0088 Hall', 'Level 1', 100, 'theatre', 'active');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0883000-0000-0000-0000-000000000001', 'a0880000-0000-0000-0000-000000000001', 'a0880000-0000-0000-0000-000000000002', '0088 Event', 'Fixture', '2040-09-01 09:00+08', '2040-09-01 11:00+08', 20, 'planning', 'EVT-0088');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('a0885000-0000-0000-0000-000000000001', 'a0883000-0000-0000-0000-000000000001', 'a0881000-0000-0000-0000-000000000001', 'a0880000-0000-0000-0000-000000000002', 'confirmed', null);
insert into public.venue_changes (id, venue_id, action, changed_by) values ('a0886000-0000-0000-0000-000000000001', 'a0881000-0000-0000-0000-000000000001', 'updated', 'a0880000-0000-0000-0000-000000000003');

select public.record_venue_change_review('a0886000-0000-0000-0000-000000000001', 'a0883000-0000-0000-0000-000000000001', 'a0885000-0000-0000-0000-000000000001', 'venue_layout_review', 'Layout removed from the venue');
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0880000-0000-0000-0000-000000000002', 'arrangement_review', false, true);
select public.record_venue_change_review('a0886000-0000-0000-0000-000000000001', 'a0883000-0000-0000-0000-000000000001', 'a0885000-0000-0000-0000-000000000001', 'venue_capacity', 'Capacity reduced');
select pg_temp.assert_true(
  (select count(*) = 2 from public.arrangement_review_flags where event_id = 'a0883000-0000-0000-0000-000000000001' and venue_change_id = 'a0886000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.arrangement_review_notifications where event_id = 'a0883000-0000-0000-0000-000000000001' and recipient_id = 'a0880000-0000-0000-0000-000000000002')
  and (select detail = 'Layout removed from the venue' from public.arrangement_review_notifications where event_id = 'a0883000-0000-0000-0000-000000000001'),
  'AC-033.4.24: a venue change still flags affected bookings; the Coordinator is told in-app unless they turned it off');

rollback;
