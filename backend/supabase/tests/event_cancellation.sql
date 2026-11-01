-- US21 Cancel, postpone or reschedule an event (SCRUM-66), slice 1: cancelling properly (0120).
-- Run by run_venue_time_conversion.sh straight after 0120 (which follows 0110). Fixtures roll back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.us21_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users (id, email) values
  ('21a00000-0000-0000-0000-000000000001', 'organiser-21a@example.test'), ('21a00000-0000-0000-0000-000000000002', 'coordinator-21a@example.test'),
  ('21a00000-0000-0000-0000-000000000003', 'other-coordinator-21a@example.test'), ('21a00000-0000-0000-0000-000000000004', 'venue-21a@example.test'), ('21a00000-0000-0000-0000-000000000005', 'tech-21a@example.test'),
  ('21a00000-0000-0000-0000-000000000006', 'attendee-one-21a@example.test'), ('21a00000-0000-0000-0000-000000000007', 'attendee-two-21a@example.test'),
  ('21a00000-0000-0000-0000-000000000008', 'attendee-withdrawn-21a@example.test'), ('21a00000-0000-0000-0000-000000000009', 'attendee-waiting-21a@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '21a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('21a00000-0000-0000-0000-000000000002', '21a00000-0000-0000-0000-000000000003');
update public.profiles set full_name = 'Casey Coordinator' where id = '21a00000-0000-0000-0000-000000000002';
update public.profiles set role = 'venue_staff' where id = '21a00000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '21a00000-0000-0000-0000-000000000005';
update public.profiles set role = 'attendee' where id in ('21a00000-0000-0000-0000-000000000006', '21a00000-0000-0000-0000-000000000007', '21a00000-0000-0000-0000-000000000008', '21a00000-0000-0000-0000-000000000009');

insert into public.venues (id, name, location, capacity, layout, opens_at, closes_at, setup_minutes, turnaround_minutes) values
  ('21a10000-0000-0000-0000-000000000001', 'US21 Main Hall', 'Level 1', 200, 'theatre', '00:00', '24:00', 0, 0),
  ('21a10000-0000-0000-0000-000000000002', 'US21 Breakout', 'Level 2', 50, 'theatre', '00:00', '24:00', 0, 0);

-- E1 is confirmed and fully arranged; E2 belongs to another Coordinator at the same time.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, layout_preference, registration_required) values
  ('21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000002', 'US21 Gala', 'Fixture', '2046-03-10 18:00+08', '2046-03-10 21:00+08', 40, 'confirmed', 'EVT-21A-1', 'Dinner', 'theatre', true),
  ('21a30000-0000-0000-0000-000000000002', '21a00000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000003', 'US21 Other', 'Fixture', '2046-03-10 18:00+08', '2046-03-10 21:00+08', 40, 'planning', 'EVT-21A-2', 'Talks', 'theatre', false),
  ('21a30000-0000-0000-0000-000000000003', '21a00000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000002', 'US21 Unbooked', 'Fixture', '2046-04-10 18:00+08', '2046-04-10 21:00+08', 40, 'planning', 'EVT-21A-3', 'Talks', 'theatre', false);
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('21a50000-0000-0000-0000-000000000001', '21a30000-0000-0000-0000-000000000001', '21a10000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('21a50000-0000-0000-0000-000000000002', '21a30000-0000-0000-0000-000000000001', '21a10000-0000-0000-0000-000000000002', '21a00000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
select b.venue_id, c.slot_date, c.slot, c.kind, b.id
from public.venue_bookings b join public.events e on e.id = b.event_id
cross join lateral public.venue_review_cells(b.venue_id, e.proposed_start, e.proposed_end) c
where b.id in ('21a50000-0000-0000-0000-000000000001', '21a50000-0000-0000-0000-000000000002');

-- Two equipment bookings: EB1 has one item reserved and one already checked out; EB2 one reserved.
insert into public.equipment_types (id, name, category) values ('21a20000-0000-0000-0000-000000000001', 'US21 Speaker', 'Audio');
insert into public.equipment_items (id, type_id, asset_tag, home_venue_id, current_venue_id) values
  ('21a21000-0000-0000-0000-000000000001', '21a20000-0000-0000-0000-000000000001', 'US21-SPK-1', '21a10000-0000-0000-0000-000000000001', '21a10000-0000-0000-0000-000000000001'), ('21a21000-0000-0000-0000-000000000002', '21a20000-0000-0000-0000-000000000001', 'US21-SPK-2', '21a10000-0000-0000-0000-000000000001', '21a10000-0000-0000-0000-000000000001'),
  ('21a21000-0000-0000-0000-000000000003', '21a20000-0000-0000-0000-000000000001', 'US21-SPK-3', '21a10000-0000-0000-0000-000000000001', '21a10000-0000-0000-0000-000000000001');
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to, status) values
  ('21a60000-0000-0000-0000-000000000001', '21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000002', '21a10000-0000-0000-0000-000000000001', '2046-03-10', '2046-03-10', 'confirmed'),
  ('21a60000-0000-0000-0000-000000000002', '21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000002', '21a10000-0000-0000-0000-000000000001', '2046-03-10', '2046-03-10', 'confirmed');
insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested) values
  ('21a61000-0000-0000-0000-000000000001', '21a60000-0000-0000-0000-000000000001', '21a20000-0000-0000-0000-000000000001', 2), ('21a61000-0000-0000-0000-000000000002', '21a60000-0000-0000-0000-000000000002', '21a20000-0000-0000-0000-000000000001', 1);
insert into public.equipment_allocations (id, line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by) values
  ('21a62000-0000-0000-0000-000000000001', '21a61000-0000-0000-0000-000000000001', '21a21000-0000-0000-0000-000000000001', '21a20000-0000-0000-0000-000000000001', '2046-03-10', '2046-03-10', 'reserved', '21a00000-0000-0000-0000-000000000005'),
  ('21a62000-0000-0000-0000-000000000002', '21a61000-0000-0000-0000-000000000001', '21a21000-0000-0000-0000-000000000002', '21a20000-0000-0000-0000-000000000001', '2046-03-10', '2046-03-10', 'checked_out', '21a00000-0000-0000-0000-000000000005'),
  ('21a62000-0000-0000-0000-000000000003', '21a61000-0000-0000-0000-000000000002', '21a21000-0000-0000-0000-000000000003', '21a20000-0000-0000-0000-000000000001', '2046-03-10', '2046-03-10', 'reserved', '21a00000-0000-0000-0000-000000000005');

-- Two registered attendees, one who withdrew, and one on the waiting list.
insert into public.event_registrations (event_id, attendee_id, status, phone, withdrawn_at) values
  ('21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000006', 'registered', '+6590000001', null), ('21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000007', 'registered', '+6590000002', null),
  ('21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000008', 'withdrawn', '+6590000003', now());
insert into public.event_waitlist_entries (event_id, attendee_id, status) values ('21a30000-0000-0000-0000-000000000001', '21a00000-0000-0000-0000-000000000009', 'waiting');
-- A2 hears about cancellations in the app only.
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('21a00000-0000-0000-0000-000000000007', 'event_schedule_change', true, false);

create function pg_temp.us21_as(actor uuid, statement text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate || ' ' || sqlerrm;
end $$;

-- The Coordinator cancels the confirmed event.
select pg_temp.us21_as('21a00000-0000-0000-0000-000000000002', $sql$update public.events set status = 'cancelled' where id = '21a30000-0000-0000-0000-000000000001'$sql$) as us21_cancel \gset

-- ---------------------------------------------------------------------------
-- AC-021.1: cancelling releases the arrangements and keeps the record
-- ---------------------------------------------------------------------------
select pg_temp.us21_assert(
  :'us21_cancel' = 'ok'
  and (select status = 'cancelled' and name = 'US21 Gala' and reference = 'EVT-21A-1' from public.events where id = '21a30000-0000-0000-0000-000000000001')
  and (select bool_and(status = 'cancelled') and count(*) = 2 from public.venue_bookings where event_id = '21a30000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.venue_slot_claims where booking_id in ('21a50000-0000-0000-0000-000000000001', '21a50000-0000-0000-0000-000000000002'))
  and (select count(*) = 2 and bool_and(reason = 'The event was cancelled.' and cancelled_by = '21a00000-0000-0000-0000-000000000002' and actor_name = 'Casey Coordinator')
         from public.venue_booking_cancellations where event_id = '21a30000-0000-0000-0000-000000000001')
  and (select previous_status from public.venue_booking_cancellations where booking_id = '21a50000-0000-0000-0000-000000000001') = 'confirmed'
  and (select previous_status from public.venue_booking_cancellations where booking_id = '21a50000-0000-0000-0000-000000000002') = 'pending_approval',
  'AC-021.1.1: cancelling a confirmed event releases its confirmed and pending venue bookings, recorded as cancelled with the reason, and keeps the event record');

select pg_temp.us21_as('21a00000-0000-0000-0000-000000000003', $sql$select public.hold_venue('21a30000-0000-0000-0000-000000000002', '21a10000-0000-0000-0000-000000000001')$sql$) as us21_other_hold \gset
select pg_temp.us21_assert(
  :'us21_other_hold' = 'ok' and exists (select 1 from public.venue_bookings where event_id = '21a30000-0000-0000-0000-000000000002' and venue_id = '21a10000-0000-0000-0000-000000000001'),
  'AC-021.1.2: the venue''s time is free again: another Coordinator can now hold it for the same time');

select pg_temp.us21_assert(
  (select count(*) = 2 from public.notification_outbox where recipient_id = '21a00000-0000-0000-0000-000000000004' and event_id = '21a30000-0000-0000-0000-000000000001'
     and notification_type = 'venue_booking_cancelled' and body like 'Casey Coordinator cancelled EVT-21A-1, so its booking for %'),
  'AC-021.1.3: Venue Staff are told about each booking the cancellation released');

select pg_temp.us21_assert(
  (select status from public.equipment_allocations where id = '21a62000-0000-0000-0000-000000000001') = 'cancelled'
  and (select status from public.equipment_allocations where id = '21a62000-0000-0000-0000-000000000003') = 'cancelled'
  and (select status from public.equipment_allocations where id = '21a62000-0000-0000-0000-000000000002') = 'checked_out'
  and (select status from public.equipment_bookings where id = '21a60000-0000-0000-0000-000000000002') = 'cancelled'
  and (select status from public.equipment_bookings where id = '21a60000-0000-0000-0000-000000000001') = 'confirmed',
  'AC-021.1.4: reserved equipment is released; an item already checked out stays out for its return, and keeps its booking open');

select pg_temp.us21_as('21a00000-0000-0000-0000-000000000002', $sql$update public.events set status = 'cancelled' where id = '21a30000-0000-0000-0000-000000000003'$sql$) as us21_unbooked \gset
select pg_temp.us21_assert(
  :'us21_unbooked' = 'ok' and (select status from public.events where id = '21a30000-0000-0000-0000-000000000003') = 'cancelled'
  and not exists (select 1 from public.notification_outbox where event_id = '21a30000-0000-0000-0000-000000000003'),
  'AC-021.1.5: an event with nothing booked and nobody registered is simply cancelled');

-- ---------------------------------------------------------------------------
-- AC-021.3: registered and waiting attendees are told
-- ---------------------------------------------------------------------------
select pg_temp.us21_assert(
  -- Only the cancellation notice counts: the fixtures' registrations sent their own confirmations (US15).
  (select count(*) = 3 from public.user_notifications where event_id = '21a30000-0000-0000-0000-000000000001' and type_code = 'event_schedule_change'
     and recipient_id in ('21a00000-0000-0000-0000-000000000006', '21a00000-0000-0000-0000-000000000007', '21a00000-0000-0000-0000-000000000009'))
  and (select count(*) = 1 from public.notification_outbox where event_id = '21a30000-0000-0000-0000-000000000001' and recipient_id = '21a00000-0000-0000-0000-000000000006'
         and notification_type = 'event_schedule_change' and subject = 'Event cancelled: US21 Gala'
         and body = 'US21 Gala (10 Mar 2046, 6:00 PM) has been cancelled. Your registration stays on record; there is nothing you need to do.')
  and not exists (select 1 from public.user_notifications where event_id = '21a30000-0000-0000-0000-000000000001' and type_code = 'event_schedule_change' and recipient_id = '21a00000-0000-0000-0000-000000000008')
  and (select count(*) = 2 from public.event_registrations where event_id = '21a30000-0000-0000-0000-000000000001' and status = 'registered'),
  'AC-021.3.1: attendees registered or waiting for a place are told the event was cancelled; those who withdrew are not, and registrations are kept');

select pg_temp.us21_assert(
  not exists (select 1 from public.notification_outbox where event_id = '21a30000-0000-0000-0000-000000000001'
                and notification_type = 'event_schedule_change' and recipient_id = '21a00000-0000-0000-0000-000000000007')
  and exists (select 1 from public.user_notifications where event_id = '21a30000-0000-0000-0000-000000000001' and type_code = 'event_schedule_change' and recipient_id = '21a00000-0000-0000-0000-000000000007'),
  'AC-021.3.2: an attendee who turned these emails off is told in the app only');

rollback;
