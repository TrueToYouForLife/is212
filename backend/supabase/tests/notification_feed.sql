-- US32 View in-app notifications (SCRUM-229), slice 1 (0072). Disposable PostgreSQL only;
-- run through the database runner. Fixtures run inside a transaction that is rolled back.
-- Auth is simulated; RLS is real.
--
-- Fixture notifications are written with triggers paused, so each test controls exactly which
-- notifications exist; the features' own triggers are tested in their own files.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('32000000-0000-0000-0000-000000000001', 'organiser-0072@example.test'),
  ('32000000-0000-0000-0000-000000000002', 'coordinator-0072@example.test'),
  ('32000000-0000-0000-0000-000000000003', 'other-coordinator-0072@example.test'),
  ('32000000-0000-0000-0000-000000000004', 'venue-staff-0072@example.test'),
  ('32000000-0000-0000-0000-000000000005', 'tech-0072@example.test'),
  ('32000000-0000-0000-0000-000000000006', 'Attendee-0072@Example.test'),
  ('32000000-0000-0000-0000-000000000007', 'lead-0072@example.test');
update public.profiles set role = 'organiser' where id = '32000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator'
  where id in ('32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000003');
update public.profiles set role = 'venue_staff' where id = '32000000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '32000000-0000-0000-0000-000000000005';
update public.profiles set role = 'attendee' where id = '32000000-0000-0000-0000-000000000006';
update public.profiles set role = 'coordinator_lead' where id = '32000000-0000-0000-0000-000000000007';

set local session_replication_role = replica;

insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference)
values
  ('32100000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002',
   '0072 Gala', 'Fixture', '2039-07-01 09:00+08', '2039-07-01 11:00+08', 50, 'planning', 'EVT-0072-1'),
  ('32100000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003',
   '0072 Other event', 'Fixture', '2039-07-02 09:00+08', '2039-07-02 11:00+08', 50, 'planning', 'EVT-0072-2');

insert into public.venues (id, name, location, capacity, layout, status)
values ('32200000-0000-0000-0000-000000000001', '0072 Hall', 'Level 1', 100, 'theatre', 'active');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('32300000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001', '32200000-0000-0000-0000-000000000001',
   '32000000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('32300000-0000-0000-0000-000000000002', '32100000-0000-0000-0000-000000000002', '32200000-0000-0000-0000-000000000001',
   '32000000-0000-0000-0000-000000000003', 'pending_approval', now() + interval '3 days');

insert into public.event_planning_updates (id, event_id, changed_by, changed_by_name, changes)
values ('32400000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000002', 'Coordinator', '{"expectedAttendance": {"from": 50, "to": 120}}');
insert into public.arrangement_review_flags (id, planning_update_id, event_id, venue_booking_id, reason_code, detail)
values ('32500000-0000-0000-0000-000000000001', '32400000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
        '32300000-0000-0000-0000-000000000001', 'venue_capacity', '0072 Hall: updated attendance is 120; capacity is 100.');
insert into public.event_change_requests (id, event_id, organiser_id, proposed_changes, reason)
values ('32600000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000001', '{"name": "0072 Gala Night"}', 'Rebrand');
insert into public.event_coordinator_assignment_history (id, event_id, previous_coordinator_id, new_coordinator_id, assigned_by)
values ('32700000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001', null,
        '32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000007');

-- Outbox: two emails to the Organiser, one to the Attendee (address in another letter case),
-- one to the Coordinator that the assignment notice already shows in-app, one to a stranger.
insert into public.notification_outbox (id, event_id, recipient_email, subject, body, created_at) values
  ('32800000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001', 'organiser-0072@example.test',
   'Your event request was approved', 'EVT-0072-1 has been approved.', '2039-01-01 09:00+08'),
  ('32800000-0000-0000-0000-000000000002', '32100000-0000-0000-0000-000000000001', 'organiser-0072@example.test',
   'A Coordinator has been assigned', 'Your event now has a Coordinator.', '2039-01-01 09:30+08'),
  ('32800000-0000-0000-0000-000000000003', '32100000-0000-0000-0000-000000000001', 'attendee-0072@example.test',
   'You are registered', 'See you at 0072 Gala.', '2039-01-01 12:00+08'),
  ('32800000-0000-0000-0000-000000000004', '32100000-0000-0000-0000-000000000001', 'coordinator-0072@example.test',
   'You have been assigned EVT-0072-1', 'Duplicate of the in-app notice.', '2039-01-01 10:02+08'),
  ('32800000-0000-0000-0000-000000000005', '32100000-0000-0000-0000-000000000002', 'someone-else@example.test',
   'Not yours', 'Someone else''s email.', '2039-01-01 12:30+08');

-- In-app notices for the Coordinator, one minute apart, plus one switched off in-app.
insert into public.arrangement_review_notifications (id, flag_id, event_id, recipient_id, detail, created_at)
values ('32900000-0000-0000-0000-000000000001', '32500000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000002', '0072 Hall: updated attendance is 120; capacity is 100.', '2039-01-01 10:00+08');
insert into public.change_request_notifications (id, change_request_id, event_id, recipient_id, request_version, in_app_enabled, created_at)
values
  ('32910000-0000-0000-0000-000000000001', '32600000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
   '32000000-0000-0000-0000-000000000002', 1, true, '2039-01-01 10:01+08'),
  ('32910000-0000-0000-0000-000000000002', '32600000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
   '32000000-0000-0000-0000-000000000002', 2, false, '2039-01-01 10:06+08');
insert into public.coordinator_assignment_notifications (id, assignment_history_id, event_id, recipient_id, subject, body,
  in_app_enabled, email_outbox_id, created_at)
values ('32920000-0000-0000-0000-000000000001', '32700000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000002', 'You have been assigned EVT-0072-1', 'You are now the Coordinator for 0072 Gala.',
        true, '32800000-0000-0000-0000-000000000004', '2039-01-01 10:02+08');
insert into public.venue_booking_decision_notifications (id, booking_id, event_id, recipient_id, venue_name, event_reference,
  decision, reason, alternative, reviewed_by, reviewed_at, created_at)
values ('32930000-0000-0000-0000-000000000001', '32300000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000002', '0072 Hall', 'EVT-0072-1', 'rejected', 'The hall is closed that day',
        '0072 Annex', '32000000-0000-0000-0000-000000000004', '2039-01-01 10:03+08', '2039-01-01 10:03+08');
insert into public.equipment_requirement_notifications (id, event_id, recipient_id, action, type_name, quantity,
  quantity_reserved, alternative_type_name, in_app_enabled, created_at)
values
  ('32940000-0000-0000-0000-000000000001', '32100000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002',
   'partially_reserved', 'Projector', 3, 2, 'Large screen TV', true, '2039-01-01 10:04+08'),
  ('32940000-0000-0000-0000-000000000002', '32100000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000005',
   'added', 'Projector', 3, null, null, true, '2039-01-01 08:00+08');
insert into public.venue_booking_notifications (id, venue_booking_id, venue_id, recipient_id, created_at)
values ('32950000-0000-0000-0000-000000000001', '32300000-0000-0000-0000-000000000002', '32200000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000004', '2039-01-01 11:00+08');

set local session_replication_role = origin;

-- Reads a user's feed as one JSON array, so a single statement can be asserted.
create function pg_temp.us32_feed(actor uuid, lim integer default 100) returns jsonb
language plpgsql as $$
declare answer jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) into answer from public.get_my_notifications(lim) f;
  return answer;
exception when others then
  return to_jsonb(sqlstate);
end $$;

create function pg_temp.us32_titles(feed jsonb) returns text[]
language sql as $$ select coalesce(array_agg(t.x ->> 'title' order by t.n), '{}') from jsonb_array_elements(feed) with ordinality as t(x, n) $$;

set local role authenticated;
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000002') as us32_coordinator \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000001') as us32_organiser \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000006') as us32_attendee \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000004') as us32_venue_staff \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000005') as us32_tech \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000003') as us32_other_coordinator \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000002', 2) as us32_coordinator_two \gset
select pg_temp.us32_feed(null) as us32_signed_out \gset
reset role;

-- ---------------------------------------------------------------------------
-- AC-032.1: a user sees their notifications, newest first, with what, which event and when
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us32_titles(:'us32_coordinator') = array[
    'Equipment partly reserved', 'Venue booking rejected', 'You have been assigned EVT-0072-1',
    'A change request is ready for review', 'An arrangement needs review']
  and (select bool_and(x ->> 'event_name' = '0072 Gala' and x ->> 'event_reference' = 'EVT-0072-1')
       from jsonb_array_elements(:'us32_coordinator'::jsonb) x)
  and (:'us32_coordinator')::jsonb -> 0 ->> 'created_at' like '2039-01-01%',
  'AC-032.1.1: a Coordinator sees every kind of notice addressed to them, newest first, each naming its event');

select pg_temp.assert_true(
  (select x ->> 'detail' from jsonb_array_elements(:'us32_coordinator'::jsonb) x where x ->> 'source' = 'venue_decision')
    = '0072 Hall. The hall is closed that day. Suggested instead: 0072 Annex'
  and (select x ->> 'detail' from jsonb_array_elements(:'us32_coordinator'::jsonb) x where x ->> 'source' = 'equipment')
    = 'Projector × 3. 2 reserved. Alternative offered: Large screen TV'
  and (select x ->> 'detail' from jsonb_array_elements(:'us32_coordinator'::jsonb) x where x ->> 'source' = 'arrangement_review')
    = '0072 Hall: updated attendance is 120; capacity is 100.',
  'AC-032.1.2: each notice says what happened in words: a decision with its reason and alternative, a partial reservation, a review');

select pg_temp.assert_true(
  pg_temp.us32_titles(:'us32_organiser') = array['A Coordinator has been assigned', 'Your event request was approved']
  and (select bool_and(x ->> 'source' = 'email' and x ->> 'event_name' = '0072 Gala') from jsonb_array_elements(:'us32_organiser'::jsonb) x),
  'AC-032.1.3: an Organiser sees the decisions that were only emailed to them, in the app, with their event');

select pg_temp.assert_true(
  pg_temp.us32_titles(:'us32_attendee') = array['You are registered']
  and (:'us32_attendee')::jsonb -> 0 ->> 'event_name' = '0072 Gala',
  'AC-032.1.4: an Attendee sees their emailed notices even when the address differs in letter case, and the event is named');

select pg_temp.assert_true(
  pg_temp.us32_titles(:'us32_venue_staff') = array['New venue booking request']
  and (:'us32_venue_staff')::jsonb -> 0 ->> 'detail' = '0072 Hall',
  'AC-032.1.5: Venue Staff see a new booking request, named by its venue');

select pg_temp.assert_true(
  pg_temp.us32_titles(:'us32_tech') = array['Equipment requirement added']
  and (:'us32_tech')::jsonb -> 0 ->> 'detail' = 'Projector × 3',
  'AC-032.1.6: Technical Support see equipment requirement changes');

select pg_temp.assert_true(
  pg_temp.us32_titles(:'us32_coordinator_two') = array['Equipment partly reserved', 'Venue booking rejected'],
  'AC-032.1.7: asking for a few notifications returns the newest ones');

-- ---------------------------------------------------------------------------
-- AC-032.5: a user only ever sees their own notifications
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (:'us32_other_coordinator')::jsonb = '[]'::jsonb,
  'AC-032.5.1: another Coordinator sees none of the first Coordinator''s notices');

select pg_temp.assert_true(
  not exists (select 1 from jsonb_array_elements(:'us32_coordinator'::jsonb) x
              where x ->> 'id' = '32910000-0000-0000-0000-000000000002'),
  'AC-032.5.2: a notice the user has switched off in-app is not shown');

select pg_temp.assert_true(
  (select count(*) = 1 from jsonb_array_elements(:'us32_coordinator'::jsonb) x
   where x ->> 'title' = 'You have been assigned EVT-0072-1'),
  'AC-032.5.3: an email that a feature also recorded in-app appears once, not twice');

select pg_temp.assert_true(
  not exists (select 1 from jsonb_array_elements(:'us32_organiser'::jsonb || :'us32_attendee'::jsonb || :'us32_coordinator'::jsonb) x
              where x ->> 'title' = 'Not yours')
  and (:'us32_signed_out')::jsonb = '"42501"'::jsonb,
  'AC-032.5.4: emails to other addresses are never shown, and a signed-out request is refused');

set local role authenticated;
select pg_temp.expect_error($q$select * from public.notification_outbox$q$, '42501',
  'AC-032.5.5: the email outbox itself stays unreadable from the app');
reset role;

rollback;
