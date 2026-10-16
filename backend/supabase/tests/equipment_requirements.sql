-- US13 Record Equipment Requirements. Disposable local database only (see the runner).
-- Every write is attempted through pg_temp.us13_try as a signed-in browser user, so RLS,
-- column grants and triggers all apply. It returns 'rows:N' or the SQLSTATE, which lets one
-- assertion check an exact outcome: a missing table (42P01) never passes as "rejected".
--
-- IDs: users 13000000-…, venue 13100000-…, types 13200000-…, units 13300000-…,
-- events 13400000-…, bookings 13500000-…, booking lines 13600000-…,
-- pending requirements 13700000-…, reserved requirements 13800000-….
reset role;
select set_config('request.jwt.claim.sub', '', false);

create function pg_temp.us13_try(actor uuid, statement text) returns text
language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), false);
  execute statement;
  get diagnostics n = row_count;
  return 'rows:' || n;
exception when others then
  return sqlstate;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT: stands in for administrators and for US14)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
 ('13000000-0000-0000-0000-000000000001', 'us13-organiser@example.test'),
 ('13000000-0000-0000-0000-000000000002', 'us13-coordinator@example.test'),
 ('13000000-0000-0000-0000-000000000003', 'us13-other-coordinator@example.test'),
 ('13000000-0000-0000-0000-000000000004', 'us13-tech-1@example.test'),
 ('13000000-0000-0000-0000-000000000005', 'us13-tech-2@example.test'),
 ('13000000-0000-0000-0000-000000000006', 'us13-manager@example.test'),
 ('13000000-0000-0000-0000-000000000007', 'us13-venue@example.test'),
 ('13000000-0000-0000-0000-000000000008', 'us13-attendee@example.test'),
 ('13000000-0000-0000-0000-000000000009', 'us13-lead@example.test');
-- Self sign-up creates Attendees since US29 (0042), so organisers are assigned like other roles.
update public.profiles set role = 'organiser' where id = '13000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in
 ('13000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000003');
update public.profiles set role = 'tech_support' where id in
 ('13000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000005');
update public.profiles set role = 'operations_manager' where id = '13000000-0000-0000-0000-000000000006';
update public.profiles set role = 'coordinator_lead' where id = '13000000-0000-0000-0000-000000000009';
update public.profiles set role = 'venue_staff' where id = '13000000-0000-0000-0000-000000000007';
update public.profiles set role = 'attendee' where id = '13000000-0000-0000-0000-000000000008';

insert into public.venues (id, name, capacity, layout)
values ('13100000-0000-0000-0000-000000000001', 'US13 Hall', 100, 'theatre');
insert into public.equipment_types (id, name, category) values
 ('13200000-0000-0000-0000-000000000001', 'Projector', 'Visual'),
 ('13200000-0000-0000-0000-000000000002', 'Wireless mic', 'Audio');
insert into public.equipment_items (id, type_id, asset_tag, home_venue_id, current_venue_id)
select ('13300000-0000-0000-0000-00000000000' || n)::uuid, '13200000-0000-0000-0000-000000000001',
       'US13-P' || n, '13100000-0000-0000-0000-000000000001', '13100000-0000-0000-0000-000000000001'
from generate_series(1, 3) n;

insert into public.events (id, reference, organiser_id, coordinator_id, name, purpose, proposed_start,
  proposed_end, expected_attendance, equipment_requirements, status)
select ('13400000-0000-0000-0000-0000000000' || e.n)::uuid, 'EVT-US13-' || e.n,
       '13000000-0000-0000-0000-000000000001', e.coordinator, 'US13 event ' || e.n, 'Equipment fixture',
       '2035-03-01 01:00+00', '2035-03-01 02:00+00', 50, e.equipment, e.status
from (values
  ('01', 'approved',     '13000000-0000-0000-0000-000000000002'::uuid, '2 projectors, 4 mics'),
  ('02', 'planning',     '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('03', 'confirmed',    '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('12', 'submitted',    '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('13', 'under_review', '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('14', 'rejected',     '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('15', 'cancelled',    '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('16', 'completed',    '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('20', 'approved',     null::uuid,                                   null),
  ('21', 'approved',     '13000000-0000-0000-0000-000000000003'::uuid, null),
  ('22', 'approved',     '13000000-0000-0000-0000-000000000002'::uuid, null),
  ('23', 'approved',     '13000000-0000-0000-0000-000000000002'::uuid, null)
) as e(n, status, coordinator, equipment);
-- A draft cannot have a coordinator (0008), so it is the one blocked event without one.
insert into public.events (id, organiser_id, status)
values ('13400000-0000-0000-0000-000000000011', '13000000-0000-0000-0000-000000000001', 'draft');

-- Bookings stand in for US14: one for E-APP (01) and one for another event (21).
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to, status)
values
 ('13500000-0000-0000-0000-000000000001', '13400000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000002', '13100000-0000-0000-0000-000000000001', '2035-03-01', '2035-03-31', 'confirmed'),
 ('13500000-0000-0000-0000-000000000002', '13400000-0000-0000-0000-000000000021',
  '13000000-0000-0000-0000-000000000003', '13100000-0000-0000-0000-000000000001', '2035-03-01', '2035-03-31', 'confirmed');

-- Pending requirements, one per destructive test so tests stay independent.
insert into public.event_equipment_requirements (id, event_id, type_id, quantity, created_by)
select ('13700000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       case n when 4 then '13400000-0000-0000-0000-000000000022'::uuid
              when 5 then '13400000-0000-0000-0000-000000000023'::uuid
              when 12 then '13400000-0000-0000-0000-000000000002'::uuid
              else '13400000-0000-0000-0000-000000000001'::uuid end,
       '13200000-0000-0000-0000-000000000001', 2, '13000000-0000-0000-0000-000000000002'
from generate_series(1, 12) n;

-- Reserved requirement n: its own booking line and day, so the units P1/P2 can be reused
-- across fixtures without tripping 0019's no_double_allocation constraint.
create function pg_temp.us13_reserved(n integer, units uuid[], unit_statuses text[], requirement_status text)
returns void language plpgsql as $$
declare
  line uuid := ('13600000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid;
  day date := date '2035-03-01' + n;
begin
  insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested, status)
  values (line, '13500000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 2,
          case requirement_status when 'reserved' then 'fulfilled' else 'partially_fulfilled' end);
  for i in 1 .. cardinality(units) loop
    insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by)
    values (line, units[i], '13200000-0000-0000-0000-000000000001', day, day, unit_statuses[i],
            '13000000-0000-0000-0000-000000000004');
  end loop;
  insert into public.event_equipment_requirements
    (id, event_id, type_id, quantity, status, booking_line_id, created_by)
  values (('13800000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
          '13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 2,
          requirement_status, line, '13000000-0000-0000-0000-000000000002');
end $$;
select pg_temp.us13_reserved(1, array['13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000002']::uuid[], array['reserved','reserved'], 'reserved');
select pg_temp.us13_reserved(2, array['13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000002']::uuid[], array['reserved','reserved'], 'reserved');
select pg_temp.us13_reserved(3, array['13300000-0000-0000-0000-000000000001']::uuid[], array['reserved'], 'partially_reserved');
select pg_temp.us13_reserved(4, array['13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000002']::uuid[], array['reserved','reserved'], 'reserved');
select pg_temp.us13_reserved(5, array['13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000002']::uuid[], array['reserved','reserved'], 'reserved');
select pg_temp.us13_reserved(6, array['13300000-0000-0000-0000-000000000001']::uuid[], array['reserved'], 'partially_reserved');
select pg_temp.us13_reserved(7, array['13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000002']::uuid[], array['checked_out','reserved'], 'reserved');
select pg_temp.us13_reserved(8, array['13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000002']::uuid[], array['reserved','reserved'], 'reserved');

-- Another event holds P3 on the same day as reserved fixture 5 (AC-013.6.19).
insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested, status)
values ('13600000-0000-0000-0000-000000000098', '13500000-0000-0000-0000-000000000002',
        '13200000-0000-0000-0000-000000000001', 1, 'fulfilled'),
       ('13600000-0000-0000-0000-000000000099', '13500000-0000-0000-0000-000000000002',
        '13200000-0000-0000-0000-000000000001', 1, 'pending');
insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by)
values ('13600000-0000-0000-0000-000000000098', '13300000-0000-0000-0000-000000000003',
        '13200000-0000-0000-0000-000000000001', '2035-03-06', '2035-03-06', 'reserved',
        '13000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------------------
-- AC-013.1: only the assigned Coordinator writes, and only for an approved event
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 2, 'AC-013.1.12')$q$) = 'rows:1',
 'AC-013.1.12: assigned coordinator can add a requirement to an approved event');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set quantity = 3
  where id = '13700000-0000-0000-0000-000000000001'$q$) = 'rows:1',
 'AC-013.1.13: assigned coordinator can edit a requirement');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  delete from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000002'$q$) = 'rows:1',
 'AC-013.1.14: assigned coordinator can remove a requirement');
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('13400000-0000-0000-0000-000000000002', '13200000-0000-0000-0000-000000000001', 1)$q$) = 'rows:1'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('13400000-0000-0000-0000-000000000003', '13200000-0000-0000-0000-000000000001', 1)$q$) = 'rows:1',
 'AC-013.1.15: planning and confirmed events also accept requirements');
select pg_temp.assert_true((
  select bool_and(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', format($q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values (%L, '13200000-0000-0000-0000-000000000001', 1)$q$, event_id)) = '22000')
  from unnest(array['13400000-0000-0000-0000-000000000011', '13400000-0000-0000-0000-000000000012',
    '13400000-0000-0000-0000-000000000013', '13400000-0000-0000-0000-000000000014',
    '13400000-0000-0000-0000-000000000015', '13400000-0000-0000-0000-000000000016']) as event_id),
 'AC-013.1.16: draft, submitted, under review, rejected, cancelled and completed events reject requirements');
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('13400000-0000-0000-0000-000000000020', '13200000-0000-0000-0000-000000000001', 1)$q$) = '42501'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('13400000-0000-0000-0000-000000000020', '13200000-0000-0000-0000-000000000001', 1)$q$) = '42501',
 'AC-013.1.17: no coordinator can write to an event without an assigned coordinator');
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1)$q$) = '42501'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    update public.event_equipment_requirements set quantity = 9
    where id = '13700000-0000-0000-0000-000000000003'$q$) = 'rows:0'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    delete from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000003'$q$) = 'rows:0',
 'AC-013.1.18: a different coordinator cannot add, edit or remove');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000001', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1)$q$) = '42501',
 'AC-013.1.19: the event organiser cannot record requirements');
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000004', $q$
    insert into public.event_equipment_requirements (event_id, type_id, quantity)
    values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1)$q$) = '42501'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000004', $q$
    update public.event_equipment_requirements set quantity = 9
    where id = '13700000-0000-0000-0000-000000000003'$q$) = 'rows:0'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000004', $q$
    delete from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000003'$q$) = 'rows:0',
 'AC-013.1.20: technical support can read but not add, edit or remove');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000006', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1)$q$) = '42501',
 'AC-013.1.21: an operations manager cannot record requirements');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set event_id = '13400000-0000-0000-0000-000000000002'
  where id = '13700000-0000-0000-0000-000000000003'$q$) = '42501',
 'AC-013.1.22: a requirement cannot be moved to another event');
select pg_temp.us13_try('13000000-0000-0000-0000-000000000009', $q$
  select public.assign_event_coordinator('13400000-0000-0000-0000-000000000022', '13000000-0000-0000-0000-000000000003')$q$);
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    update public.event_equipment_requirements set quantity = 3
    where id = '13700000-0000-0000-0000-000000000004'$q$) = 'rows:0'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    update public.event_equipment_requirements set quantity = 3
    where id = '13700000-0000-0000-0000-000000000004'$q$) = 'rows:1',
 'AC-013.1.23: after reassignment only the newly assigned coordinator can edit');
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.events set status = 'cancelled' where id = '13400000-0000-0000-0000-000000000023';
set role authenticated;
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    update public.event_equipment_requirements set quantity = 3
    where id = '13700000-0000-0000-0000-000000000005'$q$) = '22000'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    delete from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000005'$q$) = '22000',
 'AC-013.1.24: existing requirements lock when the event is no longer approved');

-- ---------------------------------------------------------------------------
-- AC-013.2: catalogue type, quantity of at least 1, technical requirements
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 0)$q$) = '23514',
 'AC-013.2.20: the database rejects quantity 0');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', -1)$q$) = '23514',
 'AC-013.2.21: the database rejects a negative quantity');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1, 'AC-013.2.22')$q$) = 'rows:1',
 'AC-013.2.22: the database accepts quantity 1');
-- PostgREST turns the JSON body into a row the same way; 1.5 must not be rounded to 2.
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity)
  select event_id, type_id, quantity from json_populate_record(null::public.event_equipment_requirements,
    '{"event_id":"13400000-0000-0000-0000-000000000001","type_id":"13200000-0000-0000-0000-000000000001","quantity":1.5}')$q$) = '22P02',
 'AC-013.2.23: a non-integer quantity is rejected, not rounded');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity)
  values ('13400000-0000-0000-0000-000000000001', '13299999-0000-0000-0000-000000000099', 1)$q$) = '23503',
 'AC-013.2.24: an equipment type not in the catalogue is rejected');
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes) values
   ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000002', 4, 'HDMI, 4K'),
   ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000002', 77, null)$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.assert_true(
  exists (select 1 from public.event_equipment_requirements where quantity = 4 and technical_notes = 'HDMI, 4K')
  and exists (select 1 from public.event_equipment_requirements where quantity = 77 and technical_notes is null),
 'AC-013.2.25: technical requirements are stored as given, or null');
set role authenticated;
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, created_by)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1,
          '13000000-0000-0000-0000-000000000003')$q$) = '42501',
 'AC-013.2.26: the browser cannot record a requirement in another user''s name');

-- ---------------------------------------------------------------------------
-- AC-013.3: the Coordinator sees each requirement's status
-- ---------------------------------------------------------------------------
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1, 'AC-013.3.12')$q$);
select pg_temp.assert_true((select status = 'pending_review' from public.event_equipment_requirements
  where technical_notes = 'AC-013.3.12'),
 'AC-013.3.12: a new requirement starts as pending review');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, status)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1, 'reserved')$q$) = '42501',
 'AC-013.3.13: the coordinator cannot create a requirement with a status');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set status = 'reserved'
  where id = '13700000-0000-0000-0000-000000000003'$q$) = '42501',
 'AC-013.3.14: the coordinator cannot change a requirement''s status');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set essential = false
  where id = '13700000-0000-0000-0000-000000000003'$q$) = 'rows:1',
 'AC-013.3.15: the coordinator can mark a requirement non-essential');
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    select status from public.event_equipment_requirements
    where id in ('13700000-0000-0000-0000-000000000003', '13800000-0000-0000-0000-000000000004')
      and status in ('pending_review', 'reserved')$q$) = 'rows:2'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    select status from public.event_equipment_requirements
    where event_id = '13400000-0000-0000-0000-000000000001'$q$) = 'rows:0',
 'AC-013.3.16: the assigned coordinator reads statuses that another coordinator cannot');
reset role;
select pg_temp.assert_true(pg_temp.us13_try(null, $q$
  update public.event_equipment_requirements set status = 'lost'
  where id = '13700000-0000-0000-0000-000000000003'$q$) = '23514',
 'AC-013.3.17: an unknown status is rejected');

-- ---------------------------------------------------------------------------
-- AC-013.4: every Technical Support user reads requirements and is notified
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.assert_true((
  select bool_and(visible) from (
    select pg_temp.us13_try(tech, $q$
      select 1 from public.event_equipment_requirements
      where id in ('13700000-0000-0000-0000-000000000003', '13700000-0000-0000-0000-000000000012')$q$) = 'rows:2' as visible
    from unnest(array['13000000-0000-0000-0000-000000000004',
                      '13000000-0000-0000-0000-000000000005']::uuid[]) as tech) checks),
 'AC-013.4.6: every technical support user reads requirements on any event');
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000004', false);
select pg_temp.assert_true((select count(*) = 2 and bool_and(reference is not null and proposed_start is not null)
  from public.events where id in ('13400000-0000-0000-0000-000000000001', '13400000-0000-0000-0000-000000000002')),
 'AC-013.4.7: technical support sees the event behind each requirement');
-- The positive half stops this passing merely because technical support reads no events.
select pg_temp.assert_true(exists (select 1 from public.events where id = '13400000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.events where id = '13400000-0000-0000-0000-000000000020'),
 'AC-013.4.8: technical support cannot read events that have no requirements');
select pg_temp.assert_true((
  select bool_and(pg_temp.us13_try(reader, $q$select 1 from public.event_equipment_requirements$q$) = 'rows:0')
  from unnest(array['13000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000006',
                    '13000000-0000-0000-0000-000000000007', '13000000-0000-0000-0000-000000000008']::uuid[]) as reader),
 'AC-013.4.9: organisers, managers, venue staff and attendees read no requirements');
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 2, 'AC-013.4.10')$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.assert_true((
  select count(*) = 2 and bool_and(n.action = 'added')
     and array_agg(n.recipient_id order by n.recipient_id) = array['13000000-0000-0000-0000-000000000004',
                                                                   '13000000-0000-0000-0000-000000000005']::uuid[]
  from public.equipment_requirement_notifications n
  join public.event_equipment_requirements r on r.id = n.requirement_id
  where r.technical_notes = 'AC-013.4.10'),
 'AC-013.4.10: adding a requirement notifies every technical support user once');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set quantity = 3 where id = '13700000-0000-0000-0000-000000000006'$q$);
reset role;
select pg_temp.assert_true((select count(*) = 2 from public.equipment_requirement_notifications
  where requirement_id = '13700000-0000-0000-0000-000000000006' and action = 'changed'),
 'AC-013.4.11: changing a quantity notifies technical support');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set technical_notes = 'needs HDMI'
  where id = '13700000-0000-0000-0000-000000000007'$q$);
reset role;
select pg_temp.assert_true((select count(*) = 2 from public.equipment_requirement_notifications
  where requirement_id = '13700000-0000-0000-0000-000000000007' and action = 'changed'),
 'AC-013.4.12: changing only the technical requirements notifies technical support');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  delete from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000008'$q$);
reset role;
select pg_temp.assert_true((select count(*) = 2
    and bool_and(event_id = '13400000-0000-0000-0000-000000000001' and type_name = 'Projector' and quantity = 2)
  from public.equipment_requirement_notifications
  where requirement_id = '13700000-0000-0000-0000-000000000008' and action = 'removed'),
 'AC-013.4.13: removal notifies technical support and keeps what was removed');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set quantity = 3 where id = '13700000-0000-0000-0000-000000000006'$q$);
reset role;
select pg_temp.assert_true((select count(*) = 2 from public.equipment_requirement_notifications
  where requirement_id = '13700000-0000-0000-0000-000000000006' and action = 'changed'),
 'AC-013.4.14: an update that changes nothing sends no notification');
select pg_temp.us13_try(null, $q$
  update public.event_equipment_requirements set status = 'reserved' where id = '13700000-0000-0000-0000-000000000009'$q$);
select pg_temp.assert_true(not exists (select 1 from public.equipment_requirement_notifications
  where requirement_id = '13700000-0000-0000-0000-000000000009' and action = 'changed'),
 'AC-013.4.15: a status set by reservation work does not notify technical support');
set role authenticated;
select pg_temp.assert_true((
  select bool_and(pg_temp.us13_try(reader, $q$
    select 1 from public.equipment_requirement_notifications n
    where n.requirement_id = (select id from public.event_equipment_requirements where technical_notes = 'AC-013.4.10')$q$)
    = expected)
  from (values ('13000000-0000-0000-0000-000000000004'::uuid, 'rows:1'),
               ('13000000-0000-0000-0000-000000000005'::uuid, 'rows:1'),
               ('13000000-0000-0000-0000-000000000002'::uuid, 'rows:0')) as readers(reader, expected)),
 'AC-013.4.16: each user reads only their own notifications');
select pg_temp.assert_true(
  pg_temp.us13_try('13000000-0000-0000-0000-000000000004', $q$
    insert into public.equipment_requirement_notifications (event_id, recipient_id, action, type_name, quantity)
    values ('13400000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000004', 'added', 'Forged', 1)$q$) = '42501'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000004', $q$
    update public.equipment_requirement_notifications set action = 'removed'$q$) = '42501'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000004', $q$
    delete from public.equipment_requirement_notifications$q$) = '42501'
  and pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
    insert into public.equipment_requirement_notifications (event_id, recipient_id, action, type_name, quantity)
    values ('13400000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000004', 'added', 'Forged', 1)$q$) = '42501',
 'AC-013.4.17: the browser cannot forge, alter or delete notifications');
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.profiles set role = 'venue_staff' where id in
 ('13000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000005');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1, 'AC-013.4.18')$q$)
  as us13_no_tech_insert \gset
reset role;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.assert_true(:'us13_no_tech_insert' = 'rows:1'
  and not exists (select 1 from public.equipment_requirement_notifications n
    join public.event_equipment_requirements r on r.id = n.requirement_id where r.technical_notes = 'AC-013.4.18'),
 'AC-013.4.18: with no technical support users the requirement is saved and nobody is notified');
update public.profiles set role = 'tech_support' where id in
 ('13000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000005');

-- ---------------------------------------------------------------------------
-- AC-013.5: recording a requirement does not reserve equipment
-- ---------------------------------------------------------------------------
create temp table us13_reservation_counts as
select (select count(*) from public.equipment_bookings) as bookings,
       (select count(*) from public.equipment_booking_lines) as lines,
       (select count(*) from public.equipment_allocations) as allocations;
create temp table us13_stock_before as select * from public.equipment_stock;
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, technical_notes)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 3, 'AC-013.5.3')$q$);
reset role;
select pg_temp.assert_true(exists (select 1 from public.event_equipment_requirements where technical_notes = 'AC-013.5.3')
  and (select count(*) from public.equipment_bookings) = (select bookings from us13_reservation_counts)
  and (select count(*) from public.equipment_booking_lines) = (select lines from us13_reservation_counts)
  and (select count(*) from public.equipment_allocations) = (select allocations from us13_reservation_counts),
 'AC-013.5.3: recording a requirement creates no booking, booking line or allocation');
select pg_temp.assert_true(
  (select booking_line_id is null from public.event_equipment_requirements where technical_notes = 'AC-013.5.3')
  and not exists ((select * from public.equipment_stock except select * from us13_stock_before)
                  union all (select * from us13_stock_before except select * from public.equipment_stock)),
 'AC-013.5.4: a recorded requirement has no reservation link and stock is unchanged');
set role authenticated;
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  insert into public.event_equipment_requirements (event_id, type_id, quantity, booking_line_id)
  values ('13400000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 1,
          '13600000-0000-0000-0000-000000000098')$q$) = '42501',
 'AC-013.5.5: the coordinator cannot link a requirement to a reservation when adding it');
select pg_temp.assert_true(pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set booking_line_id = '13600000-0000-0000-0000-000000000098'
  where id = '13700000-0000-0000-0000-000000000003'$q$) = '42501',
 'AC-013.5.6: the coordinator cannot link a requirement to a reservation when editing it');
reset role;
truncate us13_reservation_counts;
insert into us13_reservation_counts
select 0, 0, (select count(*) from public.equipment_allocations);
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set quantity = 5 where id = '13700000-0000-0000-0000-000000000010'$q$);
reset role;
select pg_temp.assert_true(
  (select quantity = 5 from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000010')
  and (select count(*) from public.equipment_allocations) = (select allocations from us13_reservation_counts),
 'AC-013.5.7: editing a pending requirement reserves nothing');

-- ---------------------------------------------------------------------------
-- AC-013.6: changes to reserved lines return to pending review; removal releases
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set quantity = 3 where id = '13800000-0000-0000-0000-000000000001'$q$);
reset role;
select pg_temp.assert_true((select status = 'pending_review' and quantity = 3 from public.event_equipment_requirements
  where id = '13800000-0000-0000-0000-000000000001'),
 'AC-013.6.10: changing a reserved quantity returns the requirement to pending review');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set type_id = '13200000-0000-0000-0000-000000000002'
  where id = '13800000-0000-0000-0000-000000000002'$q$);
reset role;
select pg_temp.assert_true((select status = 'pending_review' and type_id = '13200000-0000-0000-0000-000000000002'
  from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000002'),
 'AC-013.6.11: changing a reserved equipment type returns the requirement to pending review');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set quantity = 1 where id = '13800000-0000-0000-0000-000000000003'$q$);
reset role;
select pg_temp.assert_true((select status = 'pending_review' from public.event_equipment_requirements
  where id = '13800000-0000-0000-0000-000000000003'),
 'AC-013.6.12: changing a partially reserved quantity returns it to pending review');
select pg_temp.assert_true(
  (select booking_line_id is null from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000001')
  and (select count(*) = 2 and bool_and(status = 'cancelled') from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000001')
  and (select quantity_reserved = 0 from public.equipment_booking_lines where id = '13600000-0000-0000-0000-000000000001'),
 'AC-013.6.13: returning to pending review releases the units that were held');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  update public.event_equipment_requirements set technical_notes = 'needs HDMI'
  where id = '13800000-0000-0000-0000-000000000004'$q$);
reset role;
select pg_temp.assert_true(
  (select status = 'reserved' and booking_line_id = '13600000-0000-0000-0000-000000000004'
     and technical_notes = 'needs HDMI'
   from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000004')
  and (select count(*) = 2 from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000004' and status = 'reserved'),
 'AC-013.6.14: editing only technical requirements keeps the reservation');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  delete from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000005'$q$)
  as us13_reserved_delete \gset
reset role;
select pg_temp.assert_true(:'us13_reserved_delete' = 'rows:1'
  and (select count(*) = 2 and bool_and(status = 'cancelled') from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000005'),
 'AC-013.6.15: removing a reserved requirement releases its units and keeps them as cancelled history');
-- Requires P1 to have been held and then released on that day, so it cannot pass vacuously.
select pg_temp.assert_true(
  exists (select 1 from public.equipment_allocations where line_id = '13600000-0000-0000-0000-000000000005'
          and item_id = '13300000-0000-0000-0000-000000000001' and status = 'cancelled')
  and pg_temp.us13_try(null, $q$
  insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by)
  values ('13600000-0000-0000-0000-000000000099', '13300000-0000-0000-0000-000000000001',
          '13200000-0000-0000-0000-000000000001', '2035-03-06', '2035-03-06', 'reserved',
          '13000000-0000-0000-0000-000000000004')$q$) = 'rows:1',
 'AC-013.6.16: released units can be reserved again for the same dates');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  delete from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000006'$q$);
reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000006')
  and (select count(*) = 1 and bool_and(status = 'cancelled') from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000006'),
 'AC-013.6.17: removing a partially reserved requirement releases its unit');
create temp table us13_allocations_before as select * from public.equipment_allocations;
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  delete from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000011'$q$);
reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.event_equipment_requirements where id = '13700000-0000-0000-0000-000000000011')
  and not exists ((select * from public.equipment_allocations except select * from us13_allocations_before)
                  union all (select * from us13_allocations_before except select * from public.equipment_allocations)),
 'AC-013.6.18: removing a pending requirement changes no allocations');
-- Same day as reserved fixture 5: its release must have happened and stopped there.
select pg_temp.assert_true(
  not exists (select 1 from public.equipment_allocations
              where line_id = '13600000-0000-0000-0000-000000000005' and status <> 'cancelled')
  and exists (select 1 from public.equipment_allocations where line_id = '13600000-0000-0000-0000-000000000005')
  and (select status = 'reserved' from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000098'),
 'AC-013.6.19: release leaves another event''s allocations untouched');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000002', $q$
  delete from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000007'$q$);
reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000007')
  and (select status = 'checked_out' from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000007' and item_id = '13300000-0000-0000-0000-000000000001')
  and (select status = 'cancelled' from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000007' and item_id = '13300000-0000-0000-0000-000000000002'),
 'AC-013.6.20: release cancels reserved units but leaves checked-out units alone');
set role authenticated;
select pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    delete from public.event_equipment_requirements where id = '13800000-0000-0000-0000-000000000008'$q$)
    as us13_other_delete,
  pg_temp.us13_try('13000000-0000-0000-0000-000000000003', $q$
    update public.event_equipment_requirements set quantity = 3
    where id = '13800000-0000-0000-0000-000000000008'$q$)
    as us13_other_update \gset
reset role;
select pg_temp.assert_true(:'us13_other_delete' = 'rows:0' and :'us13_other_update' = 'rows:0'
  and (select status = 'reserved' and quantity = 2 from public.event_equipment_requirements
   where id = '13800000-0000-0000-0000-000000000008')
  and (select count(*) = 2 and bool_and(status = 'reserved') from public.equipment_allocations
       where line_id = '13600000-0000-0000-0000-000000000008'),
 'AC-013.6.21: another coordinator cannot remove or change a reserved requirement or release its units');
select set_config('request.jwt.claim.sub', '', false);
