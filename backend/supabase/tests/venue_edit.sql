-- US46 Add and edit venue details (SCRUM-241), slice 2 (0067). Disposable PostgreSQL only;
-- run through the database runner. Fixtures run inside a transaction that is rolled back.
-- Auth is simulated; RLS is real. Each action runs in its own statement before it is
-- asserted: a statement cannot see the writes made by functions it calls.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('46e00000-0000-0000-0000-000000000001', 'venue-staff-0067@example.test'),
  ('46e00000-0000-0000-0000-000000000002', 'coordinator-a-0067@example.test'),
  ('46e00000-0000-0000-0000-000000000003', 'coordinator-b-0067@example.test'),
  ('46e00000-0000-0000-0000-000000000004', 'organiser-0067@example.test'),
  ('46e00000-0000-0000-0000-000000000005', 'operations-0067@example.test');
update public.profiles set role = 'venue_staff' where id = '46e00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator'
  where id in ('46e00000-0000-0000-0000-000000000002', '46e00000-0000-0000-0000-000000000003');
update public.profiles set role = 'organiser' where id = '46e00000-0000-0000-0000-000000000004';
update public.profiles set role = 'operations_manager' where id = '46e00000-0000-0000-0000-000000000005';

-- The venue: theatre 100 and classroom 50, wheelchair access and a hearing loop, a projector
-- and Wi-Fi, open 7am to midnight. Added through add_venue as Venue Staff.
set local role authenticated;
select set_config('request.jwt.claim.sub', '46e00000-0000-0000-0000-000000000001', true);
select public.add_venue('0067 Hall', 'Level 5', '07:00', '24:00',
  '{wheelchair_access,hearing_loop}', '{projector,wifi}',
  '[{"layout":"theatre","capacity":100},{"layout":"classroom","capacity":50}]') as us46e_venue \gset
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- E1 theatre for 80, needs wheelchair access and a projector, Coordinator A, confirmed booking
--    using AM and PM. E2 classroom for 40, Coordinator A, live hold. E3 theatre for 90 but
--    already over. E4 theatre for 90, cancelled booking. E5 theatre for 90 with no
--    Coordinator, confirmed booking. E6 theatre for 90, Coordinator B, lapsed hold.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, layout_preference, accessibility_requirements, facility_requirements, status)
values
  ('46e10000-0000-0000-0000-000000000001', '46e00000-0000-0000-0000-000000000004', '46e00000-0000-0000-0000-000000000002',
   '0067 Theatre event', 'Fixture', '2039-05-05 09:00+08', '2039-05-05 17:00+08', 80, 'theatre',
   '{wheelchair_access}', '{projector}', 'planning'),
  ('46e10000-0000-0000-0000-000000000002', '46e00000-0000-0000-0000-000000000004', '46e00000-0000-0000-0000-000000000002',
   '0067 Classroom event', 'Fixture', '2039-05-06 09:00+08', '2039-05-06 11:00+08', 40, 'classroom',
   '{}', '{}', 'approved'),
  ('46e10000-0000-0000-0000-000000000003', '46e00000-0000-0000-0000-000000000004', '46e00000-0000-0000-0000-000000000002',
   '0067 Past event', 'Fixture', '2020-05-05 09:00+08', '2020-05-05 11:00+08', 90, 'theatre',
   '{wheelchair_access}', '{projector}', 'completed'),
  ('46e10000-0000-0000-0000-000000000004', '46e00000-0000-0000-0000-000000000004', '46e00000-0000-0000-0000-000000000002',
   '0067 Cancelled booking event', 'Fixture', '2039-05-08 09:00+08', '2039-05-08 11:00+08', 90, 'theatre',
   '{wheelchair_access}', '{projector}', 'planning'),
  ('46e10000-0000-0000-0000-000000000005', '46e00000-0000-0000-0000-000000000004', null,
   '0067 Unassigned event', 'Fixture', '2039-05-09 09:00+08', '2039-05-09 11:00+08', 90, 'theatre',
   '{}', '{}', 'approved'),
  ('46e10000-0000-0000-0000-000000000006', '46e00000-0000-0000-0000-000000000004', '46e00000-0000-0000-0000-000000000003',
   '0067 Lapsed hold event', 'Fixture', '2039-05-10 09:00+08', '2039-05-10 11:00+08', 90, 'theatre',
   '{wheelchair_access}', '{projector}', 'planning');

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('46e20000-0000-0000-0000-000000000001', '46e10000-0000-0000-0000-000000000001', :'us46e_venue', '46e00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('46e20000-0000-0000-0000-000000000002', '46e10000-0000-0000-0000-000000000002', :'us46e_venue', '46e00000-0000-0000-0000-000000000002', 'held', now() + interval '3 days'),
  ('46e20000-0000-0000-0000-000000000003', '46e10000-0000-0000-0000-000000000003', :'us46e_venue', '46e00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('46e20000-0000-0000-0000-000000000004', '46e10000-0000-0000-0000-000000000004', :'us46e_venue', '46e00000-0000-0000-0000-000000000002', 'cancelled', null),
  ('46e20000-0000-0000-0000-000000000005', '46e10000-0000-0000-0000-000000000005', :'us46e_venue', '46e00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('46e20000-0000-0000-0000-000000000006', '46e10000-0000-0000-0000-000000000006', :'us46e_venue', '46e00000-0000-0000-0000-000000000003', 'held', now() - interval '1 hour');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id) values
  (:'us46e_venue', '2039-05-05', 'AM', 'event', '46e20000-0000-0000-0000-000000000001'),
  (:'us46e_venue', '2039-05-05', 'PM', 'event', '46e20000-0000-0000-0000-000000000001'),
  (:'us46e_venue', '2039-05-06', 'AM', 'event', '46e20000-0000-0000-0000-000000000002');

create temp table us46e_bookings_before on commit drop as
  select id, status, hold_expires_at, event_id, venue_id from public.venue_bookings
  where venue_id = :'us46e_venue';
create temp table us46e_claims_before on commit drop as
  select venue_id, slot_date, slot, kind, booking_id from public.venue_slot_claims
  where venue_id = :'us46e_venue';

-- Runs one statement as a browser user. Returns its result or row count, or the SQLSTATE of
-- a refusal.
create function pg_temp.us46e_as(actor uuid, statement text)
returns text language plpgsql as $$
declare
  affected integer;
  answer   text;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  if statement ilike 'select %' then
    execute statement into answer;
    return coalesce(answer, 'null');
  end if;
  execute statement;
  get diagnostics affected = row_count;
  return 'rows:' || affected;
exception when others then
  return sqlstate;
end $$;

-- Saves the venue as Venue Staff with every detail as it is now, except what the test passes.
-- Returns the number of bookings flagged, or the SQLSTATE of a refusal.
create function pg_temp.us46e_save(
  venue uuid,
  name text default null,
  location text default null,
  opens text default null,
  closes text default null,
  accessibility text default null,
  facilities text default null,
  layouts text default null,
  version text default null,
  actor uuid default '46e00000-0000-0000-0000-000000000001'
) returns text language plpgsql as $$
declare
  current jsonb;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  select jsonb_build_object(
    'name', v.name, 'location', v.location,
    'opens', to_char(v.opens_at, 'HH24:MI'), 'closes', to_char(v.closes_at, 'HH24:MI'),
    'accessibility', v.accessibility::text,
    'facilities', (select coalesce(array_agg(key order by key), '{}')::text from jsonb_each(v.facility) where value = 'true'::jsonb),
    'layouts', (select jsonb_agg(jsonb_build_object('layout', l.layout, 'capacity', l.capacity))::text
                from public.venue_layouts l where l.venue_id = v.id),
    'version', public.venue_edit_version(v.id))
  into current from public.venues v where v.id = venue;
  return pg_temp.us46e_as(actor, format(
    'select public.update_venue(%L, %L, %L, %L, %L::time, %L::time, %L::text[], %L::text[], %L::jsonb)',
    venue, coalesce(version, current ->> 'version'),
    coalesce(name, current ->> 'name'), coalesce(location, current ->> 'location'),
    coalesce(opens, current ->> 'opens'), coalesce(closes, current ->> 'closes'),
    coalesce(accessibility, current ->> 'accessibility'), coalesce(facilities, current ->> 'facilities'),
    coalesce(layouts, current ->> 'layouts')));
end $$;

create function pg_temp.us46e_flags(booking uuid, reason text) returns integer
language sql as $$
  select count(*)::integer from public.arrangement_review_flags
  where venue_booking_id = booking and reason_code = reason and venue_change_id is not null;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.2: Venue Staff can edit any of a venue's details
-- ---------------------------------------------------------------------------
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000001',
  format('select public.get_venue_for_edit(%L)::text', :'us46e_venue')) as us46e_loaded \gset
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000001',
  $sql$select public.get_venue_for_edit('46e9ffff-0000-0000-0000-000000000000')::text$sql$) as us46e_missing \gset
reset role;
select pg_temp.assert_true(
  (:'us46e_loaded')::jsonb - 'id' - 'version' = jsonb_build_object(
    'name', '0067 Hall', 'location', 'Level 5', 'status', 'active', 'opensAt', '07:00', 'closesAt', '24:00',
    'accessibility', '["hearing_loop", "wheelchair_access"]'::jsonb,
    'facilities', '["projector", "wifi"]'::jsonb,
    'layouts', '[{"layout": "theatre", "capacity": 100}, {"layout": "classroom", "capacity": 50}]'::jsonb)
  and length((:'us46e_loaded')::jsonb ->> 'version') = 32
  and :'us46e_missing' = 'P0002',
  'AC-046.2.1: Venue Staff open a venue with every detail they can edit; an unknown venue is reported as not found');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', name => '0067 Grand Hall', location => 'Level 6',
  opens => '07:00', closes => '24:00', accessibility => '{wheelchair_access,hearing_loop,lift_access}',
  facilities => '{projector,wifi,microphone}') as us46e_details \gset
reset role;
select pg_temp.assert_true(
  :'us46e_details' = '0'
  and (select name = '0067 Grand Hall' and location = 'Level 6'
          and accessibility = '{hearing_loop,lift_access,wheelchair_access}'
          and facility = '{"microphone": true, "projector": true, "wifi": true}'::jsonb
       from public.venues where id = :'us46e_venue'),
  'AC-046.2.2: Venue Staff change the name, location, accessibility features and facilities');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue',
  layouts => '[{"layout":"theatre","capacity":100},{"layout":"classroom","capacity":60},{"layout":"banquet","capacity":120}]') as us46e_layouts \gset
reset role;
select pg_temp.assert_true(
  :'us46e_layouts' = '0'
  and (select count(*) = 3 from public.venue_layouts where venue_id = :'us46e_venue')
  and exists (select 1 from public.venue_layouts where venue_id = :'us46e_venue' and layout = 'classroom' and capacity = 60)
  and (select layout = 'banquet' and capacity = 120 from public.venues where id = :'us46e_venue'),
  'AC-046.2.3: Venue Staff add a layout and change a capacity; the largest layout becomes primary');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue',
  layouts => '[{"layout":"theatre","capacity":100},{"layout":"classroom","capacity":60}]') as us46e_drop_banquet \gset
reset role;
select pg_temp.assert_true(
  :'us46e_drop_banquet' = '0'
  and not exists (select 1 from public.venue_layouts where venue_id = :'us46e_venue' and layout = 'banquet')
  and (select layout = 'theatre' and capacity = 100 from public.venues where id = :'us46e_venue'),
  'AC-046.2.4: removing a layout no booking needs is saved without a review, and the primary layout moves back');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', name => '0067 Stale', version => 'not-the-current-version') as us46e_stale \gset
reset role;
select pg_temp.assert_true(
  :'us46e_stale' = '40001'
  and (select name = '0067 Grand Hall' from public.venues where id = :'us46e_venue'),
  'AC-046.2.5: an edit made from an out-of-date copy of the venue is refused, so nobody overwrites another''s change');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', layouts => '[{"layout":"theatre","capacity":0}]') as us46e_zero \gset
select pg_temp.us46e_save(:'us46e_venue', layouts => '[]') as us46e_none \gset
select pg_temp.us46e_save(:'us46e_venue', opens => '09:00') as us46e_hours \gset
select pg_temp.us46e_save(:'us46e_venue', name => '   ') as us46e_blank \gset
reset role;
select pg_temp.assert_true(
  :'us46e_zero' = '22023' and :'us46e_none' = '22023' and :'us46e_hours' = '23514' and :'us46e_blank' = '22023'
  and (select count(*) = 2 from public.venue_layouts where venue_id = :'us46e_venue')
  and (select opens_at = '07:00' and name = '0067 Grand Hall' from public.venues where id = :'us46e_venue'),
  'AC-046.2.6: an edit is checked like a new venue, and a refused edit changes nothing at all');

-- A name another venue uses. 0064's own tests add venues inside their own transaction, so
-- one is added here.
set local role authenticated;
select set_config('request.jwt.claim.sub', '46e00000-0000-0000-0000-000000000001', true);
select public.add_venue('0067 Other Room', 'Level 1', '07:00', '12:00', '{}', '{}',
  '[{"layout":"boardroom","capacity":10}]') is not null as us46e_other \gset
select pg_temp.us46e_save(:'us46e_venue', name => '0067 Other Room') as us46e_duplicate \gset
reset role;
select pg_temp.assert_true(
  :'us46e_duplicate' = '23505',
  'AC-046.2.7: renaming a venue to another venue''s name is refused');

-- ---------------------------------------------------------------------------
-- AC-046.6: only Venue Staff edit venues, and each edit is recorded
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000002',
  format('select public.get_venue_for_edit(%L)::text', :'us46e_venue')) as us46e_coordinator_open \gset
select pg_temp.us46e_save(:'us46e_venue', name => '0067 By Coordinator', actor => '46e00000-0000-0000-0000-000000000002') as us46e_coordinator_save \gset
select pg_temp.us46e_save(:'us46e_venue', name => '0067 By Operations', actor => '46e00000-0000-0000-0000-000000000005') as us46e_operations_save \gset
reset role;
select pg_temp.assert_true(
  :'us46e_coordinator_open' = '42501' and :'us46e_coordinator_save' = '42501' and :'us46e_operations_save' = '42501'
  and (select name = '0067 Grand Hall' from public.venues where id = :'us46e_venue'),
  'AC-046.6.13: only Venue Staff can open a venue for editing or save an edit');

select pg_temp.assert_true(
  exists (select 1 from public.venue_changes where venue_id = :'us46e_venue' and action = 'updated'
          and changed_by = '46e00000-0000-0000-0000-000000000001'
          and details -> 'name' = '{"from": "0067 Hall", "to": "0067 Grand Hall"}'::jsonb)
  and exists (select 1 from public.venue_changes where venue_id = :'us46e_venue' and action = 'layout_removed'
              and details ->> 'layout' = 'banquet' and changed_by = '46e00000-0000-0000-0000-000000000001'),
  'AC-046.6.14: every saved edit is recorded with who made it, when, and what changed');

-- ---------------------------------------------------------------------------
-- AC-046.4: an edit never changes a booking's status; bookings it may have made unsuitable
-- are flagged for review and their Coordinators notified
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue',
  layouts => '[{"layout":"theatre","capacity":95},{"layout":"classroom","capacity":60}]') as us46e_still_fits \gset
reset role;
select pg_temp.assert_true(
  :'us46e_still_fits' = '0'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000001', 'venue_capacity') = 0,
  'AC-046.4.1: lowering a capacity that still fits the event raises no review');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue',
  layouts => '[{"layout":"theatre","capacity":70},{"layout":"classroom","capacity":60}]') as us46e_too_small \gset
reset role;
select pg_temp.assert_true(
  :'us46e_too_small' = '2'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000001', 'venue_capacity') = 1
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000005', 'venue_capacity') = 1
  and (select detail = '0067 Grand Hall: capacity for the theatre layout is now 70; this event expects 80. The booking is unchanged.'
       from public.arrangement_review_flags
       where venue_booking_id = '46e20000-0000-0000-0000-000000000001' and reason_code = 'venue_capacity')
  and exists (select 1 from public.arrangement_review_notifications n join public.arrangement_review_flags f on f.id = n.flag_id
              where f.venue_booking_id = '46e20000-0000-0000-0000-000000000001' and n.recipient_id = '46e00000-0000-0000-0000-000000000002'),
  'AC-046.4.2: lowering a requested layout below an event''s attendance flags its booking and notifies its Coordinator');

select pg_temp.assert_true(
  pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000002', 'venue_capacity') = 0
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000003', 'venue_capacity') = 0
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000004', 'venue_capacity') = 0
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000006', 'venue_capacity') = 0,
  'AC-046.4.3: bookings for another layout, past events, cancelled bookings and lapsed holds are not flagged');

select pg_temp.assert_true(
  exists (select 1 from public.arrangement_review_flags where venue_booking_id = '46e20000-0000-0000-0000-000000000005'
          and reason_code = 'venue_capacity')
  and not exists (select 1 from public.arrangement_review_notifications n join public.arrangement_review_flags f on f.id = n.flag_id
                  where f.venue_booking_id = '46e20000-0000-0000-0000-000000000005'),
  'AC-046.4.4: an event with no Coordinator yet is still flagged, for whoever is assigned, with no one to notify');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue',
  layouts => '[{"layout":"theatre","capacity":65},{"layout":"classroom","capacity":60}]') as us46e_smaller_again \gset
reset role;
select pg_temp.assert_true(
  :'us46e_smaller_again' = '0'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000001', 'venue_capacity') = 1,
  'AC-046.4.5: a further edit of the same kind adds no second review while the first is still open');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', layouts => '[{"layout":"theatre","capacity":65}]') as us46e_no_classroom \gset
reset role;
select pg_temp.assert_true(
  :'us46e_no_classroom' = '1'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000002', 'venue_layout_review') = 1
  and (select detail like '0067 Grand Hall no longer offers the classroom layout this event requested.%'
       from public.arrangement_review_flags
       where venue_booking_id = '46e20000-0000-0000-0000-000000000002' and reason_code = 'venue_layout_review'),
  'AC-046.4.6: removing a layout a booked event requested flags that booking');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', accessibility => '{wheelchair_access,lift_access}') as us46e_drop_loop \gset
select pg_temp.us46e_save(:'us46e_venue', accessibility => '{lift_access}') as us46e_drop_wheelchair \gset
reset role;
select pg_temp.assert_true(
  :'us46e_drop_loop' = '0' and :'us46e_drop_wheelchair' = '1'
  and (select detail like '0067 Grand Hall no longer lists wheelchair_access, which this event requires.%'
       from public.arrangement_review_flags
       where venue_booking_id = '46e20000-0000-0000-0000-000000000001' and reason_code = 'venue_accessibility_review')
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000003', 'venue_accessibility_review') = 0,
  'AC-046.4.7: removing an accessibility feature a booked event requires flags it; removing one nobody needs does not');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', facilities => '{projector}') as us46e_drop_wifi \gset
select pg_temp.us46e_save(:'us46e_venue', facilities => '{}') as us46e_drop_projector \gset
reset role;
select pg_temp.assert_true(
  :'us46e_drop_wifi' = '0' and :'us46e_drop_projector' = '1'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000001', 'venue_facility_review') = 1,
  'AC-046.4.8: removing a facility a booked event requires flags it; removing one nobody needs does not');

set local role authenticated;
select pg_temp.us46e_save(:'us46e_venue', opens => '07:00', closes => '18:00') as us46e_still_open \gset
select pg_temp.us46e_save(:'us46e_venue', opens => '13:00', closes => '18:00') as us46e_closed_mornings \gset
reset role;
select pg_temp.assert_true(
  :'us46e_still_open' = '0' and :'us46e_closed_mornings' = '2'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000002', 'venue_hours_review') = 1
  and (select detail = '0067 Grand Hall now opens 13:00 to 18:00, which no longer covers this booking''s 2039-05-05 AM. Check the arrangement; the booking is unchanged.'
       from public.arrangement_review_flags
       where venue_booking_id = '46e20000-0000-0000-0000-000000000001' and reason_code = 'venue_hours_review'),
  'AC-046.4.9: hours that no longer cover a booked slot flag the booking; hours that still cover it do not');

set local role authenticated;
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000002',
  $sql$select count(*)::text from public.arrangement_review_flags where venue_change_id is not null and event_id = '46e10000-0000-0000-0000-000000000001'$sql$) as us46e_a_sees \gset
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000003',
  $sql$select count(*)::text from public.arrangement_review_flags where event_id = '46e10000-0000-0000-0000-000000000001'$sql$) as us46e_b_sees \gset
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000001',
  $sql$select count(*)::text from public.arrangement_review_flags where venue_change_id is not null$sql$) as us46e_staff_sees \gset
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000002',
  $sql$select count(*)::text from public.arrangement_review_notifications where event_id = '46e10000-0000-0000-0000-000000000001'$sql$) as us46e_a_notices \gset
reset role;
select pg_temp.assert_true(
  :'us46e_a_sees' = '4' and :'us46e_b_sees' = '0' and :'us46e_staff_sees' = '0' and :'us46e_a_notices' = '4',
  'AC-046.4.10: only the event''s assigned Coordinator sees its reviews and notices');

set local role authenticated;
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000002', format(
  $sql$select public.resolve_arrangement_review(%L, 'confirmed_valid', 'Spoke to the organiser, 70 confirmed attendees')::text$sql$,
  (select id from public.arrangement_review_flags where venue_booking_id = '46e20000-0000-0000-0000-000000000001' and reason_code = 'venue_capacity'))) as us46e_resolved \gset
reset role;
select pg_temp.assert_true(
  :'us46e_resolved' <> '42501' and :'us46e_resolved' <> '22023'
  and (select status = 'resolved' and resolution_method = 'confirmed_valid'
       from public.arrangement_review_flags
       where venue_booking_id = '46e20000-0000-0000-0000-000000000001' and reason_code = 'venue_capacity')
  and (select status = 'confirmed' from public.venue_bookings where id = '46e20000-0000-0000-0000-000000000001'),
  'AC-046.4.11: the Coordinator resolves a venue review like any other arrangement review, and the booking stays confirmed');

-- Once the first review is resolved, a further reduction is new information and is flagged again.
set local role authenticated;
select pg_temp.us46e_as('46e00000-0000-0000-0000-000000000001', format(
  $sql$update public.venue_layouts set capacity = 50 where venue_id = %L and layout = 'theatre'$sql$, :'us46e_venue')) as us46e_direct \gset
reset role;
select pg_temp.assert_true(
  :'us46e_direct' = 'rows:1'
  and pg_temp.us46e_flags('46e20000-0000-0000-0000-000000000001', 'venue_capacity') = 2
  and exists (select 1 from public.arrangement_review_flags
              where venue_booking_id = '46e20000-0000-0000-0000-000000000001' and reason_code = 'venue_capacity'
                and status = 'open' and detail like '%capacity for the theatre layout is now 50%'),
  'AC-046.4.12: a change made directly to the venue tables is reviewed the same way, once the earlier review is resolved');

select pg_temp.assert_true(
  not exists ((select id, status, hold_expires_at, event_id, venue_id from public.venue_bookings where venue_id = :'us46e_venue')
              except select * from us46e_bookings_before)
  and not exists ((select venue_id, slot_date, slot, kind, booking_id from public.venue_slot_claims where venue_id = :'us46e_venue')
                  except select * from us46e_claims_before)
  and not exists (select * from us46e_claims_before
                  except select venue_id, slot_date, slot, kind, booking_id from public.venue_slot_claims where venue_id = :'us46e_venue'),
  'AC-046.4.13: after every edit, no booking''s status, hold or reserved slots have changed');

rollback;
