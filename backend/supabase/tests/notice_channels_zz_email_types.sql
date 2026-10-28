-- Migration: 0093_us33_email_for_in_app_only_types.sql
-- US33 slice 2c (SCRUM-230): email for the four types that were in-app only. Disposable
-- PostgreSQL only; run through the database runner, which applies 0093 just before this file.
-- Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Production's rule from 0067 (the runner replays 0063 after it): a venue change can be a source.
alter table public.arrangement_review_flags drop constraint if exists arrangement_review_source;
alter table public.arrangement_review_flags add constraint arrangement_review_source
  check (num_nonnulls(change_request_id, planning_update_id, venue_change_id) = 1);

insert into auth.users (id, email) values
  ('a0930000-0000-0000-0000-000000000001', 'organiser-0093@example.test'), ('a0930000-0000-0000-0000-000000000002', 'coordinator-0093@example.test'),
  ('a0930000-0000-0000-0000-000000000003', 'tech-one-0093@example.test'), ('a0930000-0000-0000-0000-000000000004', 'tech-two-0093@example.test'),
  ('a0930000-0000-0000-0000-000000000005', 'venue-one-0093@example.test'), ('a0930000-0000-0000-0000-000000000006', 'venue-two-0093@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0930000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0930000-0000-0000-0000-000000000002';
update public.profiles set role = 'tech_support' where id in ('a0930000-0000-0000-0000-000000000003', 'a0930000-0000-0000-0000-000000000004');
update public.profiles set role = 'venue_staff' where id in ('a0930000-0000-0000-0000-000000000005', 'a0930000-0000-0000-0000-000000000006');
insert into public.venues (id, name, location, capacity, layout, status) values ('a0931000-0000-0000-0000-000000000001', '0093 Hall', 'Level 1', 100, 'theatre', 'active');
insert into public.equipment_types (id, name, category) values ('a0932000-0000-0000-0000-000000000001', '0093 Projector', 'Visual');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0933000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000002', '0093 One', 'Fixture', '2041-01-01 09:00+08', '2041-01-01 11:00+08', 20, 'planning', 'EVT-0093-1'),
  ('a0933000-0000-0000-0000-000000000002', 'a0930000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000002', '0093 Two', 'Fixture', '2041-01-02 09:00+08', '2041-01-02 11:00+08', 20, 'planning', 'EVT-0093-2'),
  ('a0933000-0000-0000-0000-000000000003', 'a0930000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000002', '0093 Three', 'Fixture', '2041-01-03 09:00+08', '2041-01-03 11:00+08', 20, 'planning', 'EVT-0093-3');
-- Choices: one Technical Support member and one Venue Staff member turned email off.
insert into public.notification_preferences (user_id, type_code, in_app, email) values
  ('a0930000-0000-0000-0000-000000000004', 'equipment_requirement_change', true, false),
  ('a0930000-0000-0000-0000-000000000006', 'venue_booking_request', true, false);

create function pg_temp.us33_emails(recipient uuid, kind text) returns integer language sql as $$
  select count(*)::integer from public.notification_outbox where recipient_id = recipient and notification_type = kind
$$;

-- ---------------------------------------------------------------------------
-- AC-033.3: every type now reaches people by email as well as in the app
-- ---------------------------------------------------------------------------
insert into public.event_equipment_requirements (event_id, type_id, quantity, essential, created_by)
values ('a0933000-0000-0000-0000-000000000001', 'a0932000-0000-0000-0000-000000000001', 2, true, 'a0930000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
  pg_temp.us33_emails('a0930000-0000-0000-0000-000000000003', 'equipment_requirement_change') = 1
  and pg_temp.us33_emails('a0930000-0000-0000-0000-000000000004', 'equipment_requirement_change') = 0
  and (select subject = 'Equipment request added: 0093 Projector' and body not like '%EVT-0093%'
       from public.notification_outbox where recipient_id = 'a0930000-0000-0000-0000-000000000003' and notification_type = 'equipment_requirement_change')
  and (select count(*) = 2 from public.equipment_requirement_notifications where event_id = 'a0933000-0000-0000-0000-000000000001' and recipient_id in ('a0930000-0000-0000-0000-000000000003', 'a0930000-0000-0000-0000-000000000004')),
  'AC-033.3.2: a new equipment request is emailed to each Technical Support member who has email on, without event details, and stays in-app for both');

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('a0935000-0000-0000-0000-000000000001', 'a0933000-0000-0000-0000-000000000001', 'a0931000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days');
select pg_temp.assert_true(
  pg_temp.us33_emails('a0930000-0000-0000-0000-000000000005', 'venue_booking_request') = 1
  and pg_temp.us33_emails('a0930000-0000-0000-0000-000000000006', 'venue_booking_request') = 0
  and (select subject = 'New venue booking request: 0093 Hall' from public.notification_outbox
       where recipient_id = 'a0930000-0000-0000-0000-000000000005' and notification_type = 'venue_booking_request')
  and (select count(*) = 2 from public.venue_booking_notifications where venue_booking_id = 'a0935000-0000-0000-0000-000000000001'
       and recipient_id in ('a0930000-0000-0000-0000-000000000005', 'a0930000-0000-0000-0000-000000000006')),
  'AC-033.3.3: a new booking request is emailed to each Venue Staff member who has email on, and stays in-app for both');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0930000-0000-0000-0000-000000000002', 'venue_booking_decision', false, true);
select set_config('request.jwt.claim.sub', 'a0930000-0000-0000-0000-000000000005', true);
update public.venue_bookings set status = 'rejected', review_note = 'Closed for repairs', review_alternative = '0093 Annex',
  reviewed_by = 'a0930000-0000-0000-0000-000000000005', reviewed_at = now() where id = 'a0935000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select subject = 'Venue booking rejected: 0093 Hall' and body like '%Reason: Closed for repairs%' and body like '%Suggested instead: 0093 Annex%'
   from public.notification_outbox where recipient_id = 'a0930000-0000-0000-0000-000000000002' and notification_type = 'venue_booking_decision')
  and not exists (select 1 from public.venue_booking_decision_notifications where booking_id = 'a0935000-0000-0000-0000-000000000001'),
  'AC-033.3.4: a booking decision is emailed to the Coordinator with its reason and alternative, even with in-app off');

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('a0935000-0000-0000-0000-000000000002', 'a0933000-0000-0000-0000-000000000002', 'a0931000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000002', 'confirmed', null),
  ('a0935000-0000-0000-0000-000000000003', 'a0933000-0000-0000-0000-000000000003', 'a0931000-0000-0000-0000-000000000001', 'a0930000-0000-0000-0000-000000000002', 'confirmed', null);
insert into public.event_planning_updates (id, event_id, changed_by, changed_by_name, changes)
values ('a0937000-0000-0000-0000-000000000001', 'a0933000-0000-0000-0000-000000000002', 'a0930000-0000-0000-0000-000000000002', 'Fixture Coordinator', '{"expected_attendance": 150}');
select public.record_arrangement_review(null, 'a0933000-0000-0000-0000-000000000002', 'a0935000-0000-0000-0000-000000000002', null, 'venue_capacity', 'Attendance now exceeds capacity', 'a0937000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select subject = 'An arrangement needs review for EVT-0093-2' and body like 'Attendance now exceeds capacity%'
   from public.notification_outbox where recipient_id = 'a0930000-0000-0000-0000-000000000002' and notification_type = 'arrangement_review' and event_id = 'a0933000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.arrangement_review_notifications where event_id = 'a0933000-0000-0000-0000-000000000002'),
  'AC-033.3.5: an arrangement needing review after a planning change is emailed to the Coordinator, and stays in-app');

insert into public.venue_changes (id, venue_id, action, changed_by) values ('a0936000-0000-0000-0000-000000000001', 'a0931000-0000-0000-0000-000000000001', 'updated', 'a0930000-0000-0000-0000-000000000005');
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0930000-0000-0000-0000-000000000002', 'arrangement_review', true, false);
select public.record_venue_change_review('a0936000-0000-0000-0000-000000000001', 'a0933000-0000-0000-0000-000000000003', 'a0935000-0000-0000-0000-000000000003', 'venue_layout_review', 'Layout removed from the venue');
select pg_temp.assert_true(
  not exists (select 1 from public.notification_outbox where recipient_id = 'a0930000-0000-0000-0000-000000000002' and notification_type = 'arrangement_review' and event_id = 'a0933000-0000-0000-0000-000000000003')
  and (select count(*) = 1 from public.arrangement_review_notifications where event_id = 'a0933000-0000-0000-0000-000000000003'),
  'AC-033.3.6: a venue change needing review follows the Coordinator''s choice: with email off it is only in the app');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0930000-0000-0000-0000-000000000003', true);
select count(*) as us33_tech_feed from public.get_my_notifications(100) f where f.event_id = 'a0933000-0000-0000-0000-000000000001' \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(:'us33_tech_feed' = 1,
  'AC-033.3.7: a notice that is both in-app and emailed appears once in the feed, not twice');

rollback;
