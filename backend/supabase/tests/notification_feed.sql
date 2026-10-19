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


-- ===========================================================================
-- Slice 2 (0073): read and unread
-- ===========================================================================
-- Runs one statement as a user and returns its single value, or the SQLSTATE of a refusal.
create function pg_temp.us32_as(actor uuid, statement text) returns text
language plpgsql as $$
declare answer text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  execute statement into answer;
  -- A function that returns nothing comes back as an empty value: report it as ok.
  return coalesce(nullif(answer, ''), 'ok');
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us32_unread(actor uuid) returns text
language sql as $$ select pg_temp.us32_as(actor, 'select public.count_my_unread_notifications()::text') $$;

create function pg_temp.us32_read_at(actor uuid, wanted_source text, wanted_id uuid) returns text
language sql as $$
  select pg_temp.us32_as(actor, format(
    'select coalesce(read_at::text, ''unread'') from public.get_my_notifications(100) where source = %L and id = %L',
    wanted_source, wanted_id));
$$;

-- Feeds are read while signed in as each user: run as the superuser, RLS would not apply.
set local role authenticated;
select pg_temp.us32_unread('32000000-0000-0000-0000-000000000002') as us32_coord_unread \gset
select pg_temp.us32_unread('32000000-0000-0000-0000-000000000001') as us32_org_unread \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000002') as us32_coord_feed2 \gset
select pg_temp.us32_feed('32000000-0000-0000-0000-000000000004') as us32_staff_feed2 \gset
reset role;

-- ---------------------------------------------------------------------------
-- AC-032.2: unread notifications stand out, with an unread count
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  :'us32_coord_unread' = '5' and :'us32_org_unread' = '2'
  and jsonb_array_length(:'us32_coord_feed2'::jsonb) = 5
  and (select bool_and(x -> 'read_at' = 'null'::jsonb) from jsonb_array_elements(:'us32_coord_feed2'::jsonb) x),
  'AC-032.2.1: every notification starts unread, and the unread count is how many there are');

select pg_temp.assert_true(
  (select x ->> 'item_id' from jsonb_array_elements(:'us32_coord_feed2'::jsonb) x
   where x ->> 'source' = 'venue_decision') = '32300000-0000-0000-0000-000000000001'
  and (select x ->> 'item_id' from jsonb_array_elements(:'us32_staff_feed2'::jsonb) x
       where x ->> 'source' = 'venue_request') = '32300000-0000-0000-0000-000000000002',
  'AC-032.2.2: a venue notification carries the booking it is about, so it can be opened');

-- ---------------------------------------------------------------------------
-- AC-032.3: opening a notification marks it read
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us32_as('32000000-0000-0000-0000-000000000002',
  $sql$select public.mark_notification_read('venue_decision', '32930000-0000-0000-0000-000000000001')::text$sql$) as us32_mark \gset
select pg_temp.us32_read_at('32000000-0000-0000-0000-000000000002', 'venue_decision', '32930000-0000-0000-0000-000000000001') as us32_marked_at \gset
select pg_temp.us32_read_at('32000000-0000-0000-0000-000000000002', 'change_request', '32910000-0000-0000-0000-000000000001') as us32_other_at \gset
select pg_temp.us32_unread('32000000-0000-0000-0000-000000000002') as us32_after_one \gset
reset role;
select pg_temp.assert_true(
  :'us32_mark' = 'ok' and :'us32_marked_at' <> 'unread' and :'us32_other_at' = 'unread' and :'us32_after_one' = '4',
  'AC-032.3.1: opening a notification marks that one read and lowers the count by one');

set local role authenticated;
select pg_temp.us32_as('32000000-0000-0000-0000-000000000002',
  $sql$select public.mark_notification_read('venue_decision', '32930000-0000-0000-0000-000000000001')::text$sql$) as us32_mark_again \gset
select pg_temp.us32_unread('32000000-0000-0000-0000-000000000002') as us32_after_again \gset
reset role;
select pg_temp.assert_true(
  :'us32_mark_again' = 'ok' and :'us32_after_again' = '4',
  'AC-032.3.2: opening an already-read notification again changes nothing');

set local role authenticated;
select pg_temp.us32_as('32000000-0000-0000-0000-000000000003',
  $sql$select public.mark_notification_read('change_request', '32910000-0000-0000-0000-000000000001')::text$sql$) as us32_mark_others \gset
select pg_temp.us32_as('32000000-0000-0000-0000-000000000001',
  $sql$select public.mark_notification_read('email', '32800000-0000-0000-0000-000000000005')::text$sql$) as us32_mark_strangers_email \gset
select pg_temp.us32_read_at('32000000-0000-0000-0000-000000000002', 'change_request', '32910000-0000-0000-0000-000000000001') as us32_still_unread \gset
reset role;
select pg_temp.assert_true(
  :'us32_mark_others' = 'P0002' and :'us32_mark_strangers_email' = 'P0002' and :'us32_still_unread' = 'unread',
  'AC-032.3.3: nobody can mark a notification that is not in their own feed');

-- A second booking-request notice, already marked read on US9's booking-requests page.
set local session_replication_role = replica;
insert into public.venue_booking_notifications (id, venue_booking_id, venue_id, recipient_id, created_at, read_at)
values ('32950000-0000-0000-0000-000000000002', '32300000-0000-0000-0000-000000000001', '32200000-0000-0000-0000-000000000001',
        '32000000-0000-0000-0000-000000000004', '2039-01-01 11:30+08', '2039-01-01 11:45+08');
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.us32_read_at('32000000-0000-0000-0000-000000000004', 'venue_request', '32950000-0000-0000-0000-000000000002') as us32_read_elsewhere \gset
select pg_temp.us32_as('32000000-0000-0000-0000-000000000004',
  $sql$select public.mark_notification_read('venue_request', '32950000-0000-0000-0000-000000000001')::text$sql$) as us32_staff_mark \gset
reset role;
select pg_temp.assert_true(
  :'us32_read_elsewhere' <> 'unread' and :'us32_staff_mark' = 'ok'
  and (select read_at is not null from public.venue_booking_notifications where id = '32950000-0000-0000-0000-000000000001'),
  'AC-032.3.4: a booking request read on the booking-requests page shows as read, and reading one here marks it read there too');

-- ---------------------------------------------------------------------------
-- AC-032.4: mark all as read
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us32_as('32000000-0000-0000-0000-000000000001', 'select public.mark_all_notifications_read()::text') as us32_all \gset
select pg_temp.us32_unread('32000000-0000-0000-0000-000000000001') as us32_org_after_all \gset
select pg_temp.us32_as('32000000-0000-0000-0000-000000000001', 'select public.mark_all_notifications_read()::text') as us32_all_again \gset
select pg_temp.us32_unread('32000000-0000-0000-0000-000000000002') as us32_coord_untouched \gset
reset role;
select pg_temp.assert_true(
  :'us32_all' = '2' and :'us32_org_after_all' = '0' and :'us32_all_again' = '0' and :'us32_coord_untouched' = '4',
  'AC-032.4.1: marking all as read clears the user''s own unread notices only, and says how many there were');

-- ---------------------------------------------------------------------------
-- AC-032.5: each user's read state is their own
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us32_as('32000000-0000-0000-0000-000000000003',
  $sql$select count(*)::text from public.notification_reads$sql$) as us32_others_reads \gset
select pg_temp.us32_as('32000000-0000-0000-0000-000000000003',
  $sql$insert into public.notification_reads (user_id, source, notification_id)
       values ('32000000-0000-0000-0000-000000000002', 'change_request', '32910000-0000-0000-0000-000000000001') returning 'x'$sql$) as us32_forge_read \gset
reset role;
select pg_temp.assert_true(
  :'us32_others_reads' = '0' and :'us32_forge_read' = '42501',
  'AC-032.5.9: another user can neither see someone''s read state nor mark their notifications read');

set local role authenticated;
select pg_temp.us32_as(null, $sql$select public.mark_notification_read('email', '32800000-0000-0000-0000-000000000001')::text$sql$) as us32_out_mark \gset
select pg_temp.us32_as(null, 'select public.mark_all_notifications_read()::text') as us32_out_all \gset
select pg_temp.us32_unread(null) as us32_out_count \gset
reset role;
select pg_temp.assert_true(
  :'us32_out_mark' = '42501' and :'us32_out_all' = '42501' and :'us32_out_count' = '42501',
  'AC-032.5.10: signed out, nothing can be marked or counted');

rollback;
