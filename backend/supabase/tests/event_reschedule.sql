-- US21 Cancel, postpone or reschedule an event (SCRUM-66), slice 2: rescheduling and postponement
-- notices (0122). Run by run_venue_time_conversion.sh straight after 0122. Fixtures roll back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.us21b_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users (id, email) values
  ('21b00000-0000-0000-0000-000000000001', 'organiser-21b@example.test'), ('21b00000-0000-0000-0000-000000000002', 'coordinator-21b@example.test'),
  ('21b00000-0000-0000-0000-000000000003', 'other-coordinator-21b@example.test'), ('21b00000-0000-0000-0000-000000000004', 'venue-21b@example.test'), ('21b00000-0000-0000-0000-000000000005', 'tech-21b@example.test'),
  ('21b00000-0000-0000-0000-000000000006', 'attendee-one-21b@example.test'), ('21b00000-0000-0000-0000-000000000007', 'attendee-waiting-21b@example.test'), ('21b00000-0000-0000-0000-000000000008', 'attendee-withdrawn-21b@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '21b00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('21b00000-0000-0000-0000-000000000002', '21b00000-0000-0000-0000-000000000003');
update public.profiles set role = 'venue_staff' where id = '21b00000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '21b00000-0000-0000-0000-000000000005';
update public.profiles set role = 'attendee' where id in ('21b00000-0000-0000-0000-000000000006', '21b00000-0000-0000-0000-000000000007', '21b00000-0000-0000-0000-000000000008');

insert into public.venues (id, name, location, capacity, layout, opens_at, closes_at, setup_minutes, turnaround_minutes)
  values ('21b10000-0000-0000-0000-000000000001', 'US21 Concert Hall', 'Level 1', 200, 'theatre', '00:00', '24:00', 0, 0);

-- E1 confirmed and arranged; E2 in preparation; E3 postponed; E4 approved; E5 cancelled;
-- E6 in planning, to be postponed; E7 in planning, for the refusals.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, layout_preference, registration_required) values
  ('21b30000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 1', 'Fixture', '2047-05-10 18:00+08', '2047-05-10 21:00+08', 40, 'confirmed', 'EVT-21B-1', 'Talks', 'theatre', true),
  ('21b30000-0000-0000-0000-000000000002', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 2', 'Fixture', '2047-05-11 18:00+08', '2047-05-11 21:00+08', 40, 'in_preparation', 'EVT-21B-2', 'Talks', 'theatre', false),
  ('21b30000-0000-0000-0000-000000000003', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 3', 'Fixture', '2047-05-12 18:00+08', '2047-05-12 21:00+08', 40, 'postponed', 'EVT-21B-3', 'Talks', 'theatre', false),
  ('21b30000-0000-0000-0000-000000000004', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 4', 'Fixture', '2047-05-13 18:00+08', '2047-05-13 21:00+08', 40, 'approved', 'EVT-21B-4', 'Talks', 'theatre', false),
  ('21b30000-0000-0000-0000-000000000005', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 5', 'Fixture', '2047-05-14 18:00+08', '2047-05-14 21:00+08', 40, 'cancelled', 'EVT-21B-5', 'Talks', 'theatre', false),
  ('21b30000-0000-0000-0000-000000000006', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 6', 'Fixture', '2047-05-15 18:00+08', '2047-05-15 21:00+08', 40, 'planning', 'EVT-21B-6', 'Talks', 'theatre', true),
  ('21b30000-0000-0000-0000-000000000007', '21b00000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'US21 Event 7', 'Fixture', '2047-05-16 18:00+08', '2047-05-16 21:00+08', 40, 'planning', 'EVT-21B-7', 'Talks', 'theatre', false);
update public.events set name = 'US21 Concert' where id = '21b30000-0000-0000-0000-000000000001';
update public.events set name = 'US21 Workshop' where id = '21b30000-0000-0000-0000-000000000006';
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status) values ('21b50000-0000-0000-0000-000000000001', '21b30000-0000-0000-0000-000000000001', '21b10000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', 'confirmed');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
select b.venue_id, c.slot_date, c.slot, c.kind, b.id
from public.venue_bookings b join public.events e on e.id = b.event_id
cross join lateral public.venue_review_cells(b.venue_id, e.proposed_start, e.proposed_end) c
where b.id = '21b50000-0000-0000-0000-000000000001';
insert into public.equipment_types (id, name, category) values ('21b20000-0000-0000-0000-000000000001', 'US21 Microphone', 'Audio');
insert into public.equipment_items (id, type_id, asset_tag, home_venue_id, current_venue_id) values ('21b21000-0000-0000-0000-000000000001', '21b20000-0000-0000-0000-000000000001', 'US21-MIC-1', '21b10000-0000-0000-0000-000000000001', '21b10000-0000-0000-0000-000000000001');
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to, status)
  values ('21b60000-0000-0000-0000-000000000001', '21b30000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000002', '21b10000-0000-0000-0000-000000000001', '2047-05-10', '2047-05-10', 'confirmed');
insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested) values ('21b61000-0000-0000-0000-000000000001', '21b60000-0000-0000-0000-000000000001', '21b20000-0000-0000-0000-000000000001', 1);
insert into public.equipment_allocations (id, line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by)
  values ('21b62000-0000-0000-0000-000000000001', '21b61000-0000-0000-0000-000000000001', '21b21000-0000-0000-0000-000000000001', '21b20000-0000-0000-0000-000000000001', '2047-05-10', '2047-05-10', 'reserved', '21b00000-0000-0000-0000-000000000005');
insert into public.event_registrations (event_id, attendee_id, status, phone, withdrawn_at) values
  ('21b30000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000006', 'registered', '+6591000001', null), ('21b30000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000008', 'withdrawn', '+6591000003', now()),
  ('21b30000-0000-0000-0000-000000000006', '21b00000-0000-0000-0000-000000000006', 'registered', '+6591000001', null);
insert into public.event_waitlist_entries (event_id, attendee_id, status) values ('21b30000-0000-0000-0000-000000000001', '21b00000-0000-0000-0000-000000000007', 'waiting');

create function pg_temp.us21b_as(actor uuid, statement text) returns text language plpgsql as $$
declare result text;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement into result;
  perform set_config('request.jwt.claim.sub', '', true);
  return coalesce(result, 'ok');
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;
create function pg_temp.us21b_reschedule(event uuid, starts text, ends text, reason text default null) returns text language sql as $$
  select format('select public.reschedule_event(%L, %L::timestamptz, %L::timestamptz, %L)', event, starts, ends, reason) $$;
create function pg_temp.us21b_status(event uuid) returns text language sql as $$ select status from public.events where id = event $$;
create function pg_temp.us21b_notices(event uuid, kind text) returns bigint language sql as $$
  select count(*) from public.user_notifications where event_id = event and type_code = kind $$;

-- ---------------------------------------------------------------------------
-- AC-021.1 / AC-021.2: rescheduling a confirmed event
-- ---------------------------------------------------------------------------
select pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000001', '2047-06-12 19:00+08', '2047-06-12 22:00+08', 'Headliner delayed')) as us21b_e1 \gset
select pg_temp.us21b_assert(
  :'us21b_e1' = 'planning' and pg_temp.us21b_status('21b30000-0000-0000-0000-000000000001') = 'planning'
  and (select proposed_start = '2047-06-12 19:00+08' and proposed_end = '2047-06-12 22:00+08' from public.events where id = '21b30000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.event_reschedules where event_id = '21b30000-0000-0000-0000-000000000001' and previous_status = 'confirmed'
         and previous_start = '2047-05-10 18:00+08' and new_start = '2047-06-12 19:00+08'
         and reason = 'Headliner delayed' and rescheduled_by = '21b00000-0000-0000-0000-000000000002'),
  'AC-021.1.7: the Coordinator reschedules a confirmed event: it takes the new date, returns to Planning, and the change is recorded with the old date');

select pg_temp.us21b_assert(
  (select status from public.venue_bookings where id = '21b50000-0000-0000-0000-000000000001') = 'confirmed'
  and exists (select 1 from public.venue_slot_claims where booking_id = '21b50000-0000-0000-0000-000000000001')
  and (select status from public.equipment_allocations where id = '21b62000-0000-0000-0000-000000000001') = 'reserved'
  and (select count(*) = 1 from public.arrangement_review_flags where venue_booking_id = '21b50000-0000-0000-0000-000000000001' and reason_code = 'event_rescheduled'
         and status = 'open' and event_reschedule_id is not null and detail like 'The event moved from 10 May 2047, 6:00 PM to 12 Jun 2047, 7:00 PM.%')
  and (select count(*) = 1 from public.arrangement_review_flags where equipment_booking_id = '21b60000-0000-0000-0000-000000000001' and reason_code = 'event_rescheduled'),
  'AC-021.2.1: its venue booking and equipment reservation are kept, each flagged for the Coordinator to confirm or replace at the new time');

-- ---------------------------------------------------------------------------
-- AC-021.3 / AC-021.4: attendees get the new date
-- ---------------------------------------------------------------------------
select pg_temp.us21b_assert(
  (select count(*) = 1 from public.notification_outbox where event_id = '21b30000-0000-0000-0000-000000000001' and recipient_id = '21b00000-0000-0000-0000-000000000006'
     and notification_type = 'event_schedule_change' and subject = 'Event rescheduled: US21 Concert'
     and body = 'US21 Concert has moved to 12 Jun 2047, 7:00 PM (it was 10 May 2047, 6:00 PM). Your registration is kept; if the new time does not suit you, you can withdraw under My registrations.')
  and exists (select 1 from public.user_notifications where event_id = '21b30000-0000-0000-0000-000000000001' and recipient_id = '21b00000-0000-0000-0000-000000000007' and type_code = 'event_schedule_change')
  and not exists (select 1 from public.user_notifications where event_id = '21b30000-0000-0000-0000-000000000001' and recipient_id = '21b00000-0000-0000-0000-000000000008' and type_code = 'event_schedule_change')
  and (select status from public.event_registrations where event_id = '21b30000-0000-0000-0000-000000000001' and attendee_id = '21b00000-0000-0000-0000-000000000006') = 'registered',
  'AC-021.4.1: attendees registered or waiting are told the new date and time (and the old one); those who withdrew are not, and registrations are kept');

-- ---------------------------------------------------------------------------
-- AC-021.1: rescheduling at other stages, and who may
-- ---------------------------------------------------------------------------
select pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000002', '2047-07-01 18:00+08', '2047-07-01 21:00+08')) as us21b_e2,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000003', '2047-07-02 18:00+08', '2047-07-02 21:00+08')) as us21b_e3,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000004', '2047-07-03 18:00+08', '2047-07-03 21:00+08')) as us21b_e4 \gset
select pg_temp.us21b_assert(
  :'us21b_e2' = 'planning' and pg_temp.us21b_status('21b30000-0000-0000-0000-000000000002') = 'planning'
  and :'us21b_e3' = 'planning' and pg_temp.us21b_status('21b30000-0000-0000-0000-000000000003') = 'planning'
  and :'us21b_e4' = 'approved' and pg_temp.us21b_status('21b30000-0000-0000-0000-000000000004') = 'approved'
  and (select proposed_start from public.events where id = '21b30000-0000-0000-0000-000000000004') = '2047-07-03 18:00+08',
  'AC-021.1.8: an event in preparation or postponed is rescheduled back to Planning; an approved event keeps its status with the new date');

select pg_temp.us21b_as('21b00000-0000-0000-0000-000000000003', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000007', '2047-08-01 18:00+08', '2047-08-01 21:00+08')) as us21b_other,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000001', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000007', '2047-08-01 18:00+08', '2047-08-01 21:00+08')) as us21b_organiser,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000007', '2047-08-01 21:00+08', '2047-08-01 18:00+08')) as us21b_backwards,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000007', '2020-08-01 18:00+08', '2020-08-01 21:00+08')) as us21b_past,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000007', '2047-05-16 18:00+08', '2047-05-16 21:00+08')) as us21b_same,
       pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', pg_temp.us21b_reschedule('21b30000-0000-0000-0000-000000000005', '2047-08-01 18:00+08', '2047-08-01 21:00+08')) as us21b_cancelled \gset
select pg_temp.us21b_assert(
  :'us21b_other' = '42501' and :'us21b_organiser' = '42501' and :'us21b_backwards' = '22023'
  and :'us21b_past' = '22023' and :'us21b_same' = '22023' and :'us21b_cancelled' = '22000'
  and not exists (select 1 from public.event_reschedules where event_id in ('21b30000-0000-0000-0000-000000000005', '21b30000-0000-0000-0000-000000000007'))
  and (select proposed_start from public.events where id = '21b30000-0000-0000-0000-000000000007') = '2047-05-16 18:00+08',
  'AC-021.1.9: only the assigned Coordinator reschedules, to a real future time that differs, and not a cancelled event; refusals record nothing');

-- ---------------------------------------------------------------------------
-- AC-021.3: postponing tells attendees (US38's postponement keeps the bookings)
-- ---------------------------------------------------------------------------
select pg_temp.us21b_as('21b00000-0000-0000-0000-000000000002', $sql$update public.events set status = 'postponed' where id = '21b30000-0000-0000-0000-000000000006' returning 'ok'$sql$) as us21b_postpone \gset
select pg_temp.us21b_assert(
  :'us21b_postpone' = 'ok' and pg_temp.us21b_status('21b30000-0000-0000-0000-000000000006') = 'postponed'
  and (select count(*) = 1 from public.notification_outbox where event_id = '21b30000-0000-0000-0000-000000000006' and recipient_id = '21b00000-0000-0000-0000-000000000006'
         and notification_type = 'event_schedule_change' and subject = 'Event postponed: US21 Workshop'
         and body = 'US21 Workshop (15 May 2047, 6:00 PM) has been postponed. A new date will follow; your registration is kept.')
  and (select status from public.event_registrations where event_id = '21b30000-0000-0000-0000-000000000006' and attendee_id = '21b00000-0000-0000-0000-000000000006') = 'registered',
  'AC-021.3.3: when an event is postponed, its registered attendees are told a new date will follow, and their registrations are kept');

rollback;
