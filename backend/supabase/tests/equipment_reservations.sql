-- US14 Reserve Equipment (SCRUM-20). Disposable local database only (see the runner).
-- Runs after the US13 file in the same session, so it uses its own US14-prefixed fixtures.
--
-- Every browser action goes through a helper that switches to the authenticated role with a
-- JWT subject for that one call, then back. Helpers return the result or the SQLSTATE, so a
-- missing function (42883) never passes as an expected refusal.
--
-- IDs: users 14000000-…, venues 14100000-…, types 14200000-…, units 14300000-…,
-- events 14400000-…, requirements 14500000-…, fixture lines 14600000-…, fixture booking 14700000-….
reset role;
select set_config('request.jwt.claim.sub', '', false);
create extension if not exists dblink;

-- ---------------------------------------------------------------------------
-- Named IDs
-- ---------------------------------------------------------------------------
create function pg_temp.u(code text) returns uuid language sql immutable as $$
  select ('14000000-0000-0000-0000-0000000000' || case code
    when 'TS1' then '01' when 'TS2' then '02' when 'C1' then '03' when 'C2' then '04'
    when 'O1' then '05' when 'M1' then '06' when 'A1' then '07' when 'V1' then '08' end)::uuid;
$$;
create function pg_temp.venue(code text) returns uuid language sql immutable as $$
  select ('14100000-0000-0000-0000-0000000000' || case code
    when 'HALL' then '01' when 'ANNEX' then '02' when 'STORE' then '03' end)::uuid;
$$;
create function pg_temp.ty(code text) returns uuid language sql immutable as $$
  select ('14200000-0000-0000-0000-0000000000' || case code
    when 'P' then '01' when 'M' then '02' when 'S' then '03' when 'L' then '04' when 'K' then '05' end)::uuid;
$$;
create function pg_temp.ev(n integer) returns uuid language sql immutable as $$
  select ('14400000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.rq(n integer) returns uuid language sql immutable as $$
  select ('14500000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function pg_temp.us14_as(actor uuid, statement text) returns text language plpgsql as $$
declare n integer;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  get diagnostics n = row_count;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return 'rows:' || n;
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us14_admin(statement text) returns text language plpgsql as $$
declare n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return 'rows:' || n;
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us14_reserve(actor uuid, requirement uuid, quantity integer,
  return_date date default null, alternative uuid default null, note text default null)
returns text language plpgsql as $$
declare result jsonb;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  result := public.reserve_equipment(requirement, quantity, return_date, alternative, note);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return result ->> 'status';
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us14_reserve_message(actor uuid, requirement uuid, quantity integer)
returns text language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.reserve_equipment(requirement, quantity, null, null, null);
  perform set_config('role', 'none', true);
  return 'no error';
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

create function pg_temp.us14_available(actor uuid, requirement uuid, return_date date default null)
returns text language plpgsql as $$
declare available integer;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  available := public.equipment_available_units(requirement, return_date);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return available::text;
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us14_change_return(actor uuid, requirement uuid, return_date date)
returns text language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.change_equipment_return_date(requirement, return_date);
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  return sqlstate;
end $$;

-- Window of one unit (by asset tag) on a requirement's linked line, ignoring cancelled rows.
create function pg_temp.us14_window(requirement uuid, tag text) returns daterange language sql as $$
  select daterange(a.blocked_from, a.blocked_to, '[]')
  from public.event_equipment_requirements r
  join public.equipment_allocations a on a.line_id = r.booking_line_id and a.status <> 'cancelled'
  join public.equipment_items i on i.id = a.item_id
  where r.id = requirement and i.asset_tag = 'US14-' || tag;
$$;

create function pg_temp.us14_tags(requirement uuid) returns text[] language sql as $$
  select coalesce(array_agg(replace(i.asset_tag, 'US14-', '') order by i.asset_tag), '{}')
  from public.event_equipment_requirements r
  join public.equipment_allocations a on a.line_id = r.booking_line_id and a.status <> 'cancelled'
  join public.equipment_items i on i.id = a.item_id
  where r.id = requirement;
$$;

-- Two real sessions through dblink. The first opens a transaction, runs its statement and
-- holds the transaction; the second starts while the first is still open. The first then
-- commits and the second's outcome is collected.
create function pg_temp.us14_race(first_actor uuid, first_sql text, second_actor uuid, second_sql text,
  out second_was_blocked boolean, out first_error text, out second_error text)
language plpgsql as $$
declare
  conninfo text := 'dbname=' || current_database() || ' user=postgres';
  drained integer;
begin
  perform dblink_connect('us14_a', conninfo);
  perform dblink_connect('us14_b', conninfo);
  perform * from dblink('us14_a', format('select set_config(%L, %L, false) || set_config(%L, %L, false)',
    'role', 'authenticated', 'request.jwt.claim.sub', first_actor)) as t(x text);
  perform * from dblink('us14_b', format('select set_config(%L, %L, false) || set_config(%L, %L, false)',
    'role', 'authenticated', 'request.jwt.claim.sub', second_actor)) as t(x text);
  perform dblink_exec('us14_a', 'begin');
  perform * from dblink('us14_a', first_sql, false) as t(x text);
  first_error := nullif(dblink_error_message('us14_a'), 'OK');
  perform dblink_send_query('us14_b', second_sql);
  perform pg_sleep(0.5);
  second_was_blocked := dblink_is_busy('us14_b') = 1;
  perform dblink_exec('us14_a', case when first_error is null then 'commit' else 'rollback' end);
  loop
    select count(*) into drained from dblink_get_result('us14_b', false) as t(x text);
    exit when drained = 0;
  end loop;
  second_error := nullif(dblink_error_message('us14_b'), 'OK');
  perform dblink_disconnect('us14_a');
  perform dblink_disconnect('us14_b');
exception when others then
  perform dblink_disconnect(name) from unnest(dblink_get_connections()) name where name like 'us14_%';
  first_error := coalesce(first_error, sqlerrm);
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select pg_temp.u(code), 'us14-' || lower(code) || '@example.test'
from unnest(array['TS1','TS2','C1','C2','O1','M1','A1','V1']) code;
-- Self sign-up creates Attendees since US29 (0042), so organisers are assigned like other roles.
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = pg_temp.u('O1');
update public.profiles set role = 'tech_support' where id in (pg_temp.u('TS1'), pg_temp.u('TS2'));
update public.profiles set role = 'coordinator' where id in (pg_temp.u('C1'), pg_temp.u('C2'));
update public.profiles set role = 'operations_manager' where id = pg_temp.u('M1');
update public.profiles set role = 'attendee' where id = pg_temp.u('A1');
update public.profiles set role = 'venue_staff' where id = pg_temp.u('V1');
update auth.users set email = 'us14-coordinator@example.test' where id = pg_temp.u('C1');

insert into public.venues (id, name, capacity, layout) values
 (pg_temp.venue('HALL'), 'US14 Hall', 200, 'theatre'),
 (pg_temp.venue('ANNEX'), 'US14 Annex', 80, 'classroom'),
 (pg_temp.venue('STORE'), 'US14 Store', 10, 'storage');
insert into public.equipment_types (id, name, category) values
 (pg_temp.ty('P'), 'US14 Projector', 'Visual'),
 (pg_temp.ty('M'), 'US14 Wireless mic', 'Audio'),
 (pg_temp.ty('S'), 'US14 Speaker', 'Audio'),
 (pg_temp.ty('L'), 'US14 Lectern', 'Staging'),
 (pg_temp.ty('K'), 'US14 Clicker', 'Visual');
insert into public.equipment_items (id, type_id, asset_tag, home_venue_id, current_venue_id, operational_status)
select ('14300000-0000-0000-0000-0000000000' || u.n)::uuid, pg_temp.ty(u.type), 'US14-' || u.tag,
       pg_temp.venue(u.venue), pg_temp.venue(u.venue), u.status
from (values
  ('01', 'P', 'P1', 'HALL', 'operational'), ('02', 'P', 'P2', 'HALL', 'operational'),
  ('03', 'P', 'P3', 'STORE', 'operational'), ('04', 'P', 'P4', 'HALL', 'needs_repair'),
  ('05', 'P', 'P5', 'HALL', 'under_repair'), ('06', 'P', 'P6', 'HALL', 'retired'),
  ('07', 'P', 'P7', 'HALL', 'missing'),
  ('11', 'M', 'M1', 'HALL', 'operational'), ('12', 'M', 'M2', 'HALL', 'operational'),
  ('21', 'L', 'L1', 'HALL', 'operational'),
  ('31', 'K', 'K1', 'ANNEX', 'operational')
) as u(n, type, tag, venue, status);

-- An approved event assigned to C1, with venue bookings in the given status.
create function pg_temp.us14_event(n integer, first_day date, last_day date,
  venue_codes text[] default array['HALL'], venue_status text default 'confirmed')
returns uuid language plpgsql as $$
begin
  insert into public.events (id, reference, organiser_id, coordinator_id, name, purpose,
    proposed_start, proposed_end, expected_attendance, status)
  values (pg_temp.ev(n), 'EVT-US14-' || lpad(n::text, 3, '0'), pg_temp.u('O1'), pg_temp.u('C1'),
    'US14 event ' || n, 'Equipment fixture',
    (first_day + time '10:00') at time zone 'Asia/Singapore',
    (last_day + time '17:00') at time zone 'Asia/Singapore', 50, 'approved');
  insert into public.venue_bookings (event_id, venue_id, requested_by, status, hold_expires_at)
  select pg_temp.ev(n), pg_temp.venue(code), pg_temp.u('C1'), venue_status,
         case when venue_status = 'held' then now() + interval '1 day' end
  from unnest(venue_codes) code;
  return pg_temp.ev(n);
end $$;

create function pg_temp.us14_requirement(n integer, event_n integer, type_code text, quantity integer,
  essential boolean default true) returns uuid language sql as $$
  insert into public.event_equipment_requirements (id, event_id, type_id, quantity, essential, created_by)
  values (pg_temp.rq(n), pg_temp.ev(event_n), pg_temp.ty(type_code), quantity, essential, pg_temp.u('C1'))
  returning id;
$$;

-- Another event's reservation of one unit, standing in for earlier bookings.
select pg_temp.us14_event(99, '2030-01-01', '2030-01-01');
update public.events set coordinator_id = pg_temp.u('C2') where id = pg_temp.ev(99);
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to, status)
values ('14700000-0000-0000-0000-000000000099', pg_temp.ev(99), pg_temp.u('C2'), pg_temp.venue('HALL'),
        '2030-01-01', '2030-01-01', 'confirmed');
create function pg_temp.us14_block(n integer, tag text, from_day date, to_day date, status text default 'reserved')
returns void language plpgsql as $$
declare
  line uuid := ('14600000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
  unit public.equipment_items;
begin
  select * into unit from public.equipment_items where asset_tag = 'US14-' || tag;
  insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested, status)
  values (line, '14700000-0000-0000-0000-000000000099', unit.type_id, 1, 'fulfilled');
  insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by)
  values (line, unit.id, unit.type_id, from_day, to_day, status, pg_temp.u('TS2'));
end $$;

-- AC-014.1 and AC-014.2 fixtures
select pg_temp.us14_event(1, '2035-01-10', '2035-01-11');
select pg_temp.us14_event(2, '2035-01-10', '2035-01-11');
select pg_temp.us14_requirement(1, 1, 'P', 2);
select pg_temp.us14_requirement(2, 2, 'P', 1);
select pg_temp.us14_requirement(3, 1, 'P', 1, false);
select pg_temp.us14_requirement(n, 1, 'P', 1) from generate_series(4, 6) n;
update public.event_equipment_requirements set status = 'reserved' where id = pg_temp.rq(4);
update public.event_equipment_requirements set status = 'partially_reserved' where id = pg_temp.rq(5);
update public.event_equipment_requirements set status = 'unavailable' where id = pg_temp.rq(6);
select pg_temp.us14_requirement(7, 1, 'M', 1);
select pg_temp.us14_requirement(8, 1, 'S', 1);

-- ---------------------------------------------------------------------------
-- AC-014.1: Technical Support views requirements pending review
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('TS1'), format($q$
  select 1 from public.equipment_review_queue() q
  where (q.requirement_id = %L and q.event_reference = 'EVT-US14-001' and q.type_name = 'US14 Projector' and q.quantity_requested = 2)
     or (q.requirement_id = %L and q.event_reference = 'EVT-US14-002' and q.quantity_requested = 1)$q$,
  pg_temp.rq(1), pg_temp.rq(2))) = 'rows:2',
 'AC-014.1.1: pending essential requirements are listed with their event, type and quantity');
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('TS1'), format(
  'select 1 from public.equipment_review_queue() where requirement_id = %L', pg_temp.rq(3))) = 'rows:0',
 'AC-014.1.2: non-essential requirements are not pending review (#106)');
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('TS1'), format(
  'select 1 from public.equipment_review_queue() where requirement_id in (%L, %L, %L)',
  pg_temp.rq(4), pg_temp.rq(5), pg_temp.rq(6))) = 'rows:0',
 'AC-014.1.3: reserved, partially reserved and unavailable requirements are not listed');
select pg_temp.assert_true((select bool_and(pg_temp.us14_as(pg_temp.u(code),
    'select 1 from public.equipment_review_queue()') = '42501')
  from unnest(array['C1', 'O1', 'A1', 'M1']) code),
 'AC-014.1.4: other roles cannot use the review list');

-- ---------------------------------------------------------------------------
-- AC-014.2: available units for each requirement's window
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(1)) = '3',
 'AC-014.2.1: available counts usable units of the type with no overlapping reservation');
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(1)) = '3'
  and pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(7)) = '2',
 'AC-014.2.2: units of other types are not counted');
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(8)) = '0',
 'AC-014.2.3: a type with no units has nothing available');
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('C1'), pg_temp.rq(1)) = '42501',
 'AC-014.2.4: coordinators cannot see stock levels');

-- ---------------------------------------------------------------------------
-- AC-014.3: the window runs from the collection day through the return day
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(10, '2035-02-10', '2035-02-11');
select pg_temp.us14_requirement(10, 10, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(10), 1);
select pg_temp.assert_true(pg_temp.us14_window(pg_temp.rq(10), 'P1') = daterange('2035-02-09', '2035-02-11', '[]'),
 'AC-014.3.1: a unit at the venue is blocked from the collection day to the return day (#5)');
select pg_temp.us14_event(11, '2035-02-20', '2035-02-23');
select pg_temp.us14_requirement(11, 11, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(11), 1);
select pg_temp.assert_true(pg_temp.us14_window(pg_temp.rq(11), 'P1') = daterange('2035-02-19', '2035-02-23', '[]'),
 'AC-014.3.2: collection is the day before the first day of a multi-day event (#5)');
select pg_temp.us14_event(12, '2035-03-10', '2035-03-10');
update public.events set proposed_start = '2035-03-10 00:30+08', proposed_end = '2035-03-10 18:00+08'
where id = pg_temp.ev(12);
select pg_temp.us14_requirement(12, 12, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(12), 1);
select pg_temp.assert_true(pg_temp.us14_window(pg_temp.rq(12), 'P1') = daterange('2035-03-09', '2035-03-10', '[]'),
 'AC-014.3.3: days are Singapore dates, so 00:30 SGT still collects the day before (#36)');
select pg_temp.us14_event(13, '2035-02-12', '2035-02-12');
select pg_temp.us14_requirement(13, 13, 'P', 1);
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(13)) = '2',
 'AC-014.3.4: a unit reserved through a return day is unavailable to an event needing that day');
select pg_temp.us14_event(14, '2035-02-13', '2035-02-13');
select pg_temp.us14_requirement(14, 14, 'P', 1);
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(14)) = '3'
  and pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(14), 1) = 'reserved'
  and pg_temp.us14_tags(pg_temp.rq(14)) = array['P1'],
 'AC-014.3.5: a unit is available again from return day + 1 (#5)');
select pg_temp.us14_event(15, '2035-04-01', '2035-04-01');
select pg_temp.us14_event(16, '2035-04-01', '2035-04-01');
update public.events set proposed_start = '2035-04-01 08:00+08', proposed_end = '2035-04-01 11:00+08' where id = pg_temp.ev(15);
update public.events set proposed_start = '2035-04-01 14:00+08', proposed_end = '2035-04-01 18:00+08' where id = pg_temp.ev(16);
select pg_temp.us14_requirement(15, 15, 'L', 1);
select pg_temp.us14_requirement(16, 16, 'L', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(15), 1) as us14_step1 \gset
select pg_temp.assert_true(:'us14_step1' = 'reserved'
  and pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(16)) = '0'
  and pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(16), 1) = '23P01',
 'AC-014.3.6: same-day AM and PM events cannot share a unit (epic SCRUM-18)');

-- ---------------------------------------------------------------------------
-- AC-014.4: the return date defaults to the last day and can be changed
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(20, '2035-05-10', '2035-05-11');
select pg_temp.us14_requirement(20, 20, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(20), 1);
select pg_temp.assert_true(upper(pg_temp.us14_window(pg_temp.rq(20), 'P1')) - 1 = date '2035-05-11',
 'AC-014.4.1: the return date defaults to the event''s last Singapore day (A1)');
select pg_temp.us14_event(21, '2035-05-20', '2035-05-21');
select pg_temp.us14_requirement(21, 21, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(21), 1, '2035-05-24');
select pg_temp.assert_true(upper(pg_temp.us14_window(pg_temp.rq(21), 'P1')) - 1 = date '2035-05-24',
 'AC-014.4.2: a later return date extends the window (A1)');
select pg_temp.us14_event(22, '2035-06-10', '2035-06-11');
select pg_temp.us14_requirement(22, 22, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(22), 1, '2035-06-10') as us14_step2 \gset
select pg_temp.assert_true(:'us14_step2' = '22023'
  and (select status = 'pending_review' and booking_line_id is null
       from public.event_equipment_requirements where id = pg_temp.rq(22)),
 'AC-014.4.3: a return date before the last day is rejected (A1)');
select pg_temp.us14_event(23, '2035-06-20', '2035-06-21');
select pg_temp.us14_requirement(23, 23, 'P', 2);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(23), 2);
select pg_temp.assert_true(pg_temp.us14_change_return(pg_temp.u('TS1'), pg_temp.rq(23), '2035-06-23') = 'ok'
  and upper(pg_temp.us14_window(pg_temp.rq(23), 'P1')) - 1 = date '2035-06-23'
  and upper(pg_temp.us14_window(pg_temp.rq(23), 'P2')) - 1 = date '2035-06-23',
 'AC-014.4.4: extending after reserving moves every unit''s return date (A1)');
select pg_temp.us14_event(24, '2035-07-10', '2035-07-11');
select pg_temp.us14_requirement(24, 24, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(24), 1);
select pg_temp.us14_block(1, 'P1', '2035-07-13', '2035-07-15');
select pg_temp.assert_true(pg_temp.us14_change_return(pg_temp.u('TS1'), pg_temp.rq(24), '2035-07-13') = '23P01'
  and upper(pg_temp.us14_window(pg_temp.rq(24), 'P1')) - 1 = date '2035-07-11',
 'AC-014.4.5: extending into another reservation is rejected and nothing changes (A1)');
select pg_temp.us14_event(25, '2035-07-20', '2035-07-21');
select pg_temp.us14_requirement(25, 25, 'P', 3);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(25), 3, '2035-07-25');
select pg_temp.us14_event(26, '2035-07-24', '2035-07-24');
select pg_temp.us14_requirement(26, 26, 'P', 3);
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(26)) = '0'
  and pg_temp.us14_change_return(pg_temp.u('TS1'), pg_temp.rq(25), '2035-07-21') = 'ok'
  and pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(26)) = '3',
 'AC-014.4.6: shortening the return date frees units earlier (A1)');
select pg_temp.assert_true(pg_temp.us14_change_return(pg_temp.u('TS1'), pg_temp.rq(25), '2035-07-20') = '22023',
 'AC-014.4.7: the return date cannot be shortened below the last day (A1)');
select pg_temp.assert_true(
  pg_temp.us14_change_return(pg_temp.u('C1'), pg_temp.rq(25), '2035-07-22') = '42501'
  and pg_temp.us14_change_return(pg_temp.u('O1'), pg_temp.rq(25), '2035-07-22') = '42501',
 'AC-014.4.8: only technical support can change a return date');

-- ---------------------------------------------------------------------------
-- AC-014.5: one transfer day for units held elsewhere
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(30, '2035-08-10', '2035-08-10');
select pg_temp.us14_requirement(30, 30, 'P', 1);
select pg_temp.us14_block(2, 'P1', '2035-08-05', '2035-08-15');
select pg_temp.us14_block(3, 'P2', '2035-08-05', '2035-08-15');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(30), 1);
select pg_temp.assert_true(pg_temp.us14_window(pg_temp.rq(30), 'P3') = daterange('2035-08-08', '2035-08-10', '[]'),
 'AC-014.5.1: a unit held elsewhere gets one transfer day before collection');
select pg_temp.us14_event(31, '2035-08-20', '2035-08-20');
select pg_temp.us14_requirement(31, 31, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(31), 1);
select pg_temp.assert_true(pg_temp.us14_window(pg_temp.rq(31), 'P1') = daterange('2035-08-19', '2035-08-20', '[]'),
 'AC-014.5.2: a unit at the event''s venue gets no transfer day');
select pg_temp.us14_event(32, '2035-08-30', '2035-08-30', array['HALL', 'ANNEX']);
select pg_temp.us14_requirement(32, 32, 'K', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(32), 1);
select pg_temp.assert_true(pg_temp.us14_window(pg_temp.rq(32), 'K1') = daterange('2035-08-29', '2035-08-30', '[]'),
 'AC-014.5.3: a unit at any of the event''s approved venues needs no transfer day (A2)');
select pg_temp.us14_event(33, '2035-09-10', '2035-09-10', array['HALL'], 'held');
select pg_temp.us14_event(34, '2035-09-20', '2035-09-20', array['HALL'], 'pending_approval');
select pg_temp.us14_requirement(33, 33, 'P', 1);
select pg_temp.us14_requirement(34, 34, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(n), 1) from unnest(array[33, 34]) n;
select pg_temp.assert_true(lower(pg_temp.us14_window(pg_temp.rq(33), 'P1')) = date '2035-09-08'
  and lower(pg_temp.us14_window(pg_temp.rq(34), 'P1')) = date '2035-09-18',
 'AC-014.5.4: held and pending venue bookings do not count, so the transfer day is added (A2)');
select pg_temp.us14_event(35, '2035-09-30', '2035-09-30', array[]::text[]);
select pg_temp.us14_requirement(35, 35, 'P', 2);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(35), 2);
select pg_temp.assert_true(lower(pg_temp.us14_window(pg_temp.rq(35), 'P1')) = date '2035-09-28'
  and lower(pg_temp.us14_window(pg_temp.rq(35), 'P2')) = date '2035-09-28',
 'AC-014.5.5: with no approved venue booking every unit gets the transfer day (A2)');
select pg_temp.us14_event(36, '2035-10-10', '2035-10-10');
select pg_temp.us14_requirement(36, 36, 'P', 2);
select pg_temp.us14_block(4, 'P2', '2035-10-05', '2035-10-15');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(36), 2);
select pg_temp.assert_true(lower(pg_temp.us14_window(pg_temp.rq(36), 'P1')) = date '2035-10-09'
  and lower(pg_temp.us14_window(pg_temp.rq(36), 'P3')) = date '2035-10-08',
 'AC-014.5.6: transfer days apply per unit (#13)');
select pg_temp.us14_event(37, '2035-10-20', '2035-10-20');
select pg_temp.us14_requirement(37, 37, 'P', 2);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(37), 2);
select pg_temp.assert_true(pg_temp.us14_tags(pg_temp.rq(37)) = array['P1', 'P2'],
 'AC-014.5.7: units already at the event''s venue are picked first (#66)');
select pg_temp.us14_event(38, '2035-10-30', '2035-10-30');
select pg_temp.us14_requirement(38, 38, 'P', 3);
select pg_temp.us14_block(5, 'P3', '2035-10-25', '2035-10-28');
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(38)) = '2',
 'AC-014.5.8: a clash on the transfer day itself makes the unit unavailable');
select pg_temp.assert_true(
  pg_temp.us14_tags(pg_temp.rq(30)) = array['P3']
  and (select current_venue_id = pg_temp.venue('STORE') from public.equipment_items where asset_tag = 'US14-P3'),
 'AC-014.5.9: reserving does not move the unit');

-- ---------------------------------------------------------------------------
-- AC-014.6: damaged, maintenance and otherwise unavailable units are excluded
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(40, '2035-11-10', '2035-11-10');
select pg_temp.us14_requirement(40, 40, 'P', 3);
update public.equipment_items set operational_status = 'needs_repair' where asset_tag = 'US14-P1';
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(40)) = '2',
 'AC-014.6.1: damaged units are not counted');
update public.equipment_items set operational_status = 'under_repair' where asset_tag = 'US14-P1';
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(40)) = '2',
 'AC-014.6.2: units under maintenance are not counted');
update public.equipment_items set operational_status = 'retired' where asset_tag = 'US14-P1';
select pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(40)) as us14_retired \gset
update public.equipment_items set operational_status = 'missing' where asset_tag = 'US14-P1';
select pg_temp.assert_true(:'us14_retired' = '2' and pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(40)) = '2',
 'AC-014.6.3: retired and missing units are not counted');
update public.equipment_items set operational_status = 'operational' where asset_tag = 'US14-P1';
select pg_temp.us14_event(41, '2035-11-20', '2035-11-20');
select pg_temp.us14_requirement(41, 41, 'P', 4);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(41), 4) as us14_step3 \gset
select pg_temp.assert_true(:'us14_step3' = '23P01'
  and pg_temp.us14_tags(pg_temp.rq(41)) = '{}',
 'AC-014.6.4: reserving more than the usable units is rejected');
select pg_temp.us14_event(42, '2035-11-30', '2035-11-30');
select pg_temp.us14_requirement(42, 42, 'P', 3);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(42), 3);
select pg_temp.assert_true(pg_temp.us14_tags(pg_temp.rq(42)) = array['P1', 'P2', 'P3'],
 'AC-014.6.5: a reservation never picks an unusable unit');

-- ---------------------------------------------------------------------------
-- AC-014.7: only Technical Support can reserve
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(50, '2035-12-10', '2035-12-10');
select pg_temp.us14_requirement(50, 50, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('C1'), pg_temp.rq(50), 1) as us14_step4 \gset
select pg_temp.assert_true(:'us14_step4' = '42501'
  and (select status = 'pending_review' and booking_line_id is null
       from public.event_equipment_requirements where id = pg_temp.rq(50)),
 'AC-014.7.1: the assigned event coordinator cannot reserve');
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('O1'), pg_temp.rq(50), 1) = '42501',
 'AC-014.7.2: the event organiser cannot reserve');
select pg_temp.assert_true((select bool_and(pg_temp.us14_reserve(pg_temp.u(code), pg_temp.rq(50), 1) = '42501')
  from unnest(array['A1', 'M1', 'V1']) code),
 'AC-014.7.3: attendees, operations managers and venue staff cannot reserve');
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('TS1'), format($q$
  insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, reserved_by)
  values ('14600000-0000-0000-0000-000000000001', %L, %L, '2037-06-01', '2037-06-01', %L)$q$,
  '14300000-0000-0000-0000-000000000001', pg_temp.ty('P'), pg_temp.u('TS1'))) = '42501',
 'AC-014.7.4: technical support cannot insert allocations directly');
select pg_temp.assert_true(
  pg_temp.us14_as(pg_temp.u('TS1'), format($q$
    insert into public.equipment_booking_lines (booking_id, type_id, quantity_requested)
    values ('14700000-0000-0000-0000-000000000099', %L, 1)$q$, pg_temp.ty('P'))) = '42501'
  and pg_temp.us14_as(pg_temp.u('TS1'), $q$
    update public.equipment_booking_lines set status = 'unavailable'
    where id = '14600000-0000-0000-0000-000000000001'$q$) = 'rows:0'
  and pg_temp.us14_as(pg_temp.u('TS1'), $q$
    update public.equipment_bookings set status = 'cancelled'
    where id = '14700000-0000-0000-0000-000000000099'$q$) = 'rows:0',
 'AC-014.7.5: technical support cannot write booking lines or bookings directly');
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('C1'), format($q$
  insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, reserved_by)
  values ('14600000-0000-0000-0000-000000000001', %L, %L, '2037-06-02', '2037-06-02', %L)$q$,
  '14300000-0000-0000-0000-000000000001', pg_temp.ty('P'), pg_temp.u('C1'))) = '42501',
 'AC-014.7.6: coordinators cannot insert allocations directly');
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('TS1'), format(
  'update public.event_equipment_requirements set status = %L where id = %L', 'reserved', pg_temp.rq(50))) = '42501',
 'AC-014.7.7: technical support cannot set a requirement status directly');

-- ---------------------------------------------------------------------------
-- AC-014.8: full or partial reservation
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(60, '2036-01-10', '2036-01-10');
select pg_temp.us14_requirement(60, 60, 'P', 2);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(60), 2) as us14_step5 \gset
select pg_temp.assert_true(:'us14_step5' = 'reserved'
  and (select r.status = 'reserved' and l.status = 'fulfilled' and l.quantity_reserved = 2
       from public.event_equipment_requirements r join public.equipment_booking_lines l on l.id = r.booking_line_id
       where r.id = pg_temp.rq(60))
  and cardinality(pg_temp.us14_tags(pg_temp.rq(60))) = 2,
 'AC-014.8.1: a full reservation reserves the requested quantity');
select pg_temp.us14_event(61, '2036-01-20', '2036-01-20');
select pg_temp.us14_requirement(61, 61, 'P', 3);
select pg_temp.us14_block(6, 'P3', '2036-01-15', '2036-01-25');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(61), 2) as us14_step6 \gset
select pg_temp.assert_true(:'us14_step6' = 'partially_reserved'
  and (select r.status = 'partially_reserved' and l.status = 'partially_fulfilled'
       from public.event_equipment_requirements r join public.equipment_booking_lines l on l.id = r.booking_line_id
       where r.id = pg_temp.rq(61))
  and cardinality(pg_temp.us14_tags(pg_temp.rq(61))) = 2,
 'AC-014.8.2: a partial reservation when fewer units are available');
select pg_temp.us14_event(62, '2036-01-30', '2036-01-30');
select pg_temp.us14_requirement(62, 62, 'P', 1);
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(62), 1) = 'reserved',
 'AC-014.8.3: requesting one and reserving one is a full reservation');
select pg_temp.us14_event(63, '2036-02-10', '2036-02-10');
select pg_temp.us14_requirement(63, 63, 'P', 2);
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(63), 3) = '22023',
 'AC-014.8.4: more than the requested quantity is rejected');
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(63), -1) = '22023',
 'AC-014.8.5: a negative quantity is rejected');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(60), 2) as us14_step7 \gset
select pg_temp.assert_true(:'us14_step7' = '22000'
  and cardinality(pg_temp.us14_tags(pg_temp.rq(60))) = 2,
 'AC-014.8.6: a requirement already decided cannot be reserved again (#114)');
select pg_temp.us14_event(64, '2036-02-20', '2036-02-20');
select pg_temp.us14_requirement(64, 64, 'P', 1);
update public.events set status = 'cancelled' where id = pg_temp.ev(64);
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(64), 1) = '22000',
 'AC-014.8.7: an event that is no longer approved cannot have equipment reserved (A10)');
select pg_temp.us14_event(65, '2036-03-01', '2036-03-01');
select pg_temp.us14_requirement(65, 65, 'P', 2);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(65), 1) as us14_step8 \gset
select pg_temp.assert_true(:'us14_step8' = '22023'
  and (select status = 'pending_review' from public.event_equipment_requirements where id = pg_temp.rq(65)),
 'AC-014.8.8: a partial reservation is rejected while enough units are available (A3)');

-- ---------------------------------------------------------------------------
-- AC-014.9: shortfall marked unavailable, with an optional alternative
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(70, '2036-03-10', '2036-03-10');
select pg_temp.us14_requirement(70, 70, 'S', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(70), 0) as us14_step9 \gset
select pg_temp.assert_true(:'us14_step9' = 'unavailable'
  and (select r.status = 'unavailable' and l.status = 'unavailable' and l.quantity_reserved = 0
       from public.event_equipment_requirements r join public.equipment_booking_lines l on l.id = r.booking_line_id
       where r.id = pg_temp.rq(70)),
 'AC-014.9.1: with nothing available the requirement is marked unavailable (A7)');
select pg_temp.assert_true((select l.quantity_requested = 3 and l.quantity_reserved = 2
  from public.event_equipment_requirements r join public.equipment_booking_lines l on l.id = r.booking_line_id
  where r.id = pg_temp.rq(61)),
 'AC-014.9.2: the shortfall is recorded as requested minus reserved');
select pg_temp.us14_event(71, '2036-03-20', '2036-03-20');
select pg_temp.us14_requirement(71, 71, 'P', 3);
select pg_temp.us14_block(7, 'P3', '2036-03-15', '2036-03-25');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(71), 2, null, pg_temp.ty('S'), 'Use PA instead');
select pg_temp.assert_true((select count(*) = 1
    and bool_and(s.origin = 'suggested' and s.status = 'proposed' and s.type_id = pg_temp.ty('S')
                 and s.quantity_requested = 1 and s.assessment_note = 'Use PA instead')
  from public.event_equipment_requirements r
  join public.equipment_booking_lines s on s.substitutes_line_id = r.booking_line_id
  where r.id = pg_temp.rq(71)),
 'AC-014.9.3: a shortfall can carry a suggested alternative type and note');
select pg_temp.us14_event(72, '2036-03-30', '2036-03-30');
select pg_temp.us14_requirement(72, 72, 'P', 3);
select pg_temp.us14_block(8, 'P3', '2036-03-26', '2036-04-03');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(72), 2) as us14_step10 \gset
select pg_temp.assert_true(:'us14_step10' = 'partially_reserved'
  and not exists (select 1 from public.event_equipment_requirements r
    join public.equipment_booking_lines s on s.substitutes_line_id = r.booking_line_id where r.id = pg_temp.rq(72)),
 'AC-014.9.4: a shortfall without an alternative creates no suggestion');
select pg_temp.us14_event(73, '2036-04-10', '2036-04-10');
select pg_temp.us14_requirement(73, 73, 'P', 3);
select pg_temp.us14_block(9, 'P3', '2036-04-06', '2036-04-14');
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(73), 2, null,
    '14299999-0000-0000-0000-000000000099', 'Unknown') as us14_step11 \gset
select pg_temp.assert_true(:'us14_step11' = '22023'
  and (select status = 'pending_review' from public.event_equipment_requirements where id = pg_temp.rq(73)),
 'AC-014.9.5: an alternative that is not in the catalogue is rejected');
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(73), 2, null, pg_temp.ty('P'), 'Same') = '22023',
 'AC-014.9.6: the alternative must be a different type (A4)');
select pg_temp.us14_event(74, '2036-04-20', '2036-04-20');
select pg_temp.us14_requirement(74, 74, 'P', 2);
select pg_temp.assert_true(pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(74), 2, null, pg_temp.ty('S'), 'Extra') = '22023',
 'AC-014.9.7: an alternative needs a shortfall (A4)');
select pg_temp.assert_true(exists (select 1 from public.event_equipment_requirements r
    join public.equipment_booking_lines s on s.substitutes_line_id = r.booking_line_id where r.id = pg_temp.rq(71))
  and not exists (select 1 from public.event_equipment_requirements r
    join public.equipment_booking_lines s on s.substitutes_line_id = r.booking_line_id
    join public.equipment_allocations a on a.line_id = s.id where r.id = pg_temp.rq(71)),
 'AC-014.9.8: suggesting an alternative reserves nothing for it');

-- ---------------------------------------------------------------------------
-- AC-014.10: a reservation is linked and attributed
-- ---------------------------------------------------------------------------
select pg_temp.assert_true((select b.event_id = pg_temp.ev(60) and l.type_id = pg_temp.ty('P')
    and (select count(*) from public.equipment_allocations a where a.line_id = l.id and a.status = 'reserved') = 2
  from public.event_equipment_requirements r
  join public.equipment_booking_lines l on l.id = r.booking_line_id
  join public.equipment_bookings b on b.id = l.booking_id
  where r.id = pg_temp.rq(60)),
 'AC-014.10.1: the reservation links the event, requirement, type and quantity (A8)');
select pg_temp.assert_true((select count(*) = 2 and bool_and(a.reserved_by = pg_temp.u('TS1')
    and a.reserved_at > now() - interval '10 minutes')
  from public.event_equipment_requirements r join public.equipment_allocations a on a.line_id = r.booking_line_id
  where r.id = pg_temp.rq(60)),
 'AC-014.10.2: each reserved unit records who reserved it and when');
select pg_temp.us14_event(75, '2036-05-01', '2036-05-01');
select pg_temp.us14_requirement(75, 75, 'P', 1);
select pg_temp.us14_reserve(pg_temp.u('TS2'), pg_temp.rq(75), 1);
select pg_temp.assert_true((select bool_and(a.reserved_by = pg_temp.u('TS2'))
  from public.event_equipment_requirements r join public.equipment_allocations a on a.line_id = r.booking_line_id
  where r.id = pg_temp.rq(75))
  and not exists (select 1 from pg_proc p where p.proname = 'reserve_equipment'
                  and p.proargnames && array['p_reserved_by', 'p_user_id', 'p_actor']),
 'AC-014.10.3: the reserving user comes from the session and cannot be supplied');
select pg_temp.assert_true((select l.assessed_by = pg_temp.u('TS1') and l.assessed_at is not null
  from public.event_equipment_requirements r join public.equipment_booking_lines l on l.id = r.booking_line_id
  where r.id = pg_temp.rq(71)),
 'AC-014.10.4: the booking line records who assessed it and when');
select pg_temp.us14_event(76, '2036-05-10', '2036-05-10');
select pg_temp.us14_requirement(76, 76, 'P', 1);
select pg_temp.us14_requirement(77, 76, 'M', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(n), 1) from unnest(array[76, 77]) n;
select pg_temp.assert_true((select count(distinct l.booking_id) = 1 and count(*) = 2
  from public.event_equipment_requirements r join public.equipment_booking_lines l on l.id = r.booking_line_id
  where r.id in (pg_temp.rq(76), pg_temp.rq(77)))
  and (select count(*) = 1 from public.equipment_bookings where event_id = pg_temp.ev(76)),
 'AC-014.10.5: one equipment booking per event is reused');

-- ---------------------------------------------------------------------------
-- AC-014.11: reservations reduce availability for other events
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(80, '2036-06-10', '2036-06-11');
select pg_temp.us14_event(81, '2036-06-11', '2036-06-11');
select pg_temp.us14_event(82, '2036-06-20', '2036-06-20');
select pg_temp.us14_requirement(80, 80, 'P', 2);
select pg_temp.us14_requirement(81, 81, 'P', 3);
select pg_temp.us14_requirement(82, 82, 'P', 3);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(80), 2);
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(81)) = '1',
 'AC-014.11.1: an overlapping event sees fewer units');
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(82)) = '3',
 'AC-014.11.2: a non-overlapping event is unaffected');
select pg_temp.assert_true(pg_temp.us14_as(pg_temp.u('C1'), format(
    'delete from public.event_equipment_requirements where id = %L', pg_temp.rq(80))) = 'rows:1'
  and pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(81)) = '3',
 'AC-014.11.3: removing a reserved requirement (US13) restores availability');
select pg_temp.us14_event(83, '2036-07-10', '2036-07-10');
select pg_temp.us14_event(84, '2036-07-10', '2036-07-10');
select pg_temp.us14_requirement(83, 83, 'P', 2);
select pg_temp.us14_requirement(84, 84, 'P', 3);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(83), 2);
select pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(84)) as us14_before_change \gset
select pg_temp.us14_as(pg_temp.u('C1'), format(
    'update public.event_equipment_requirements set quantity = 3 where id = %L', pg_temp.rq(83))) as us14_change83 \gset
select pg_temp.assert_true(:'us14_before_change' = '1'
  and :'us14_change83' = 'rows:1'
  and (select status = 'pending_review' from public.event_equipment_requirements where id = pg_temp.rq(83))
  and pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(84)) = '3',
 'AC-014.11.4: changing a reserved requirement (US13) releases it for review again');
select pg_temp.us14_event(85, '2036-08-10', '2036-08-10');
select pg_temp.us14_requirement(85, 85, 'P', 3);
select pg_temp.us14_block(10, 'P1', '2036-08-05', '2036-08-15', 'cancelled');
select pg_temp.us14_block(11, 'P2', '2036-08-05', '2036-08-15', 'returned');
select pg_temp.assert_true(pg_temp.us14_available(pg_temp.u('TS1'), pg_temp.rq(85)) = '2',
 'AC-014.11.5: cancelled allocations do not block a unit; other statuses do (A6)');

-- ---------------------------------------------------------------------------
-- AC-014.12: never beyond availability, even concurrently
-- ---------------------------------------------------------------------------
select pg_temp.us14_event(90, '2036-09-10', '2036-09-10');
select pg_temp.us14_requirement(90, 90, 'P', 4);
select pg_temp.us14_reserve_message(pg_temp.u('TS1'), pg_temp.rq(90), 4) as us14_over_message \gset
select pg_temp.assert_true(:'us14_over_message' like '23P01:%3 available%',
 'AC-014.12.1: reserving more than available is rejected with the available count');
select pg_temp.us14_event(91, '2036-10-10', '2036-10-10');
select pg_temp.us14_event(92, '2036-10-10', '2036-10-10');
select pg_temp.us14_requirement(91, 91, 'P', 2);
select pg_temp.us14_requirement(92, 92, 'P', 2);
select pg_temp.assert_true((select r.second_was_blocked and r.first_error is null and r.second_error like '%available%'
    from pg_temp.us14_race(
      pg_temp.u('TS1'), format('select public.reserve_equipment(%L, 2)::text', pg_temp.rq(91)),
      pg_temp.u('TS2'), format('select public.reserve_equipment(%L, 2)::text', pg_temp.rq(92))) r)
  and cardinality(pg_temp.us14_tags(pg_temp.rq(91))) = 2
  and cardinality(pg_temp.us14_tags(pg_temp.rq(92))) = 0,
 'AC-014.12.2: two simultaneous reservations cannot exceed availability');
select pg_temp.us14_event(93, '2036-11-10', '2036-11-10');
select pg_temp.us14_requirement(93, 93, 'P', 1);
select pg_temp.us14_requirement(94, 93, 'M', 1);
select pg_temp.assert_true((select not r.second_was_blocked and r.first_error is null and r.second_error is null
    from pg_temp.us14_race(
      pg_temp.u('TS1'), format('select public.reserve_equipment(%L, 1)::text', pg_temp.rq(93)),
      pg_temp.u('TS2'), format('select public.reserve_equipment(%L, 1)::text', pg_temp.rq(94))) r)
  and cardinality(pg_temp.us14_tags(pg_temp.rq(93))) = 1
  and cardinality(pg_temp.us14_tags(pg_temp.rq(94))) = 1,
 'AC-014.12.3: reservations for different types do not block each other');
select pg_temp.assert_true(:'us14_over_message' like '23P01:%'
  and not exists (select 1 from public.equipment_bookings where event_id = pg_temp.ev(90))
  and (select status = 'pending_review' and booking_line_id is null
       from public.event_equipment_requirements where id = pg_temp.rq(90)),
 'AC-014.12.4: a rejected reservation leaves nothing behind');
select pg_temp.us14_event(95, '2036-12-10', '2036-12-10');
select pg_temp.us14_event(96, '2036-12-12', '2036-12-12');
select pg_temp.us14_requirement(95, 95, 'L', 1);
select pg_temp.us14_requirement(96, 96, 'L', 1);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(95), 1);
select pg_temp.assert_true((select r.second_was_blocked and r.first_error is null and r.second_error is not null
    from pg_temp.us14_race(
      pg_temp.u('TS1'), format('select public.change_equipment_return_date(%L, %L)::text', pg_temp.rq(95), '2036-12-12'),
      pg_temp.u('TS2'), format('select public.reserve_equipment(%L, 1)::text', pg_temp.rq(96))) r)
  and upper(pg_temp.us14_window(pg_temp.rq(95), 'L1')) - 1 = date '2036-12-12'
  and cardinality(pg_temp.us14_tags(pg_temp.rq(96))) = 0,
 'AC-014.12.5: extending a return date and a new reservation cannot both take the same unit (A1)');

-- ---------------------------------------------------------------------------
-- AC-014.13: the Event Coordinator is notified of each outcome
-- ---------------------------------------------------------------------------
select pg_temp.assert_true((select count(*) = 1
    and bool_and(n.recipient_id = pg_temp.u('C1') and n.quantity = 2 and n.quantity_reserved = 2
                 and n.type_name = 'US14 Projector' and n.in_app_enabled)
  from public.equipment_requirement_notifications n
  where n.requirement_id = pg_temp.rq(60) and n.action = 'reserved'),
 'AC-014.13.1: a full reservation notifies the assigned coordinator in-app');
select pg_temp.assert_true((select count(*) = 1 and bool_and(n.quantity = 3 and n.quantity_reserved = 2)
  from public.equipment_requirement_notifications n
  where n.requirement_id = pg_temp.rq(61) and n.action = 'partially_reserved'),
 'AC-014.13.2: a partial reservation notice includes the shortfall');
select pg_temp.us14_event(77, '2036-05-20', '2036-05-20');
select pg_temp.us14_requirement(78, 77, 'S', 2);
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(78), 0, null, pg_temp.ty('M'), 'Use mics');
select pg_temp.assert_true((select count(*) = 1
    and bool_and(n.quantity_reserved = 0 and n.alternative_type_name = 'US14 Wireless mic'
                 and n.alternative_note = 'Use mics')
  from public.equipment_requirement_notifications n
  where n.requirement_id = pg_temp.rq(78) and n.action = 'unavailable'),
 'AC-014.13.3: an unavailable notice includes the suggested alternative');
select pg_temp.assert_true((select count(*) = 1 and bool_and(o.recipient_email = 'us14-coordinator@example.test'
    and o.status = 'pending' and o.event_id = pg_temp.ev(60))
  from public.equipment_requirement_notifications n join public.notification_outbox o on o.id = n.email_outbox_id
  where n.requirement_id = pg_temp.rq(60)),
 'AC-014.13.4: an email for the coordinator is queued in the existing outbox (#37)');
select pg_temp.us14_event(100, '2037-01-10', '2037-01-10');
select pg_temp.us14_event(101, '2037-01-20', '2037-01-20');
select pg_temp.us14_requirement(100, 100, 'P', 1);
select pg_temp.us14_requirement(101, 101, 'P', 1);
select pg_temp.us14_admin($q$update public.equipment_notification_settings
  set in_app_enabled = false, email_enabled = true where notification_type = 'equipment_requirement_outcome'$q$)
  as us14_settings_a \gset
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(100), 1);
select pg_temp.us14_admin($q$update public.equipment_notification_settings
  set in_app_enabled = true, email_enabled = false where notification_type = 'equipment_requirement_outcome'$q$)
  as us14_settings_b \gset
select pg_temp.us14_reserve(pg_temp.u('TS1'), pg_temp.rq(101), 1);
select pg_temp.us14_admin($q$update public.equipment_notification_settings
  set in_app_enabled = true, email_enabled = true where notification_type = 'equipment_requirement_outcome'$q$)
  as us14_settings_c \gset
select pg_temp.assert_true(:'us14_settings_a' = 'rows:1' and :'us14_settings_b' = 'rows:1' and :'us14_settings_c' = 'rows:1'
  and (select n.in_app_enabled and n.email_outbox_id is not null from public.equipment_requirement_notifications n
       where n.requirement_id = pg_temp.rq(60) and n.action = 'reserved')
  and pg_temp.us14_as(pg_temp.u('C1'), format(
    'select 1 from public.equipment_requirement_notifications where requirement_id = %L', pg_temp.rq(100))) = 'rows:0'
  and exists (select 1 from public.notification_outbox where event_id = pg_temp.ev(100))
  and pg_temp.us14_as(pg_temp.u('C1'), format(
    'select 1 from public.equipment_requirement_notifications where requirement_id = %L', pg_temp.rq(101))) = 'rows:1'
  and not exists (select 1 from public.notification_outbox where event_id = pg_temp.ev(101)),
 'AC-014.13.5: in-app and email are both on by default and each can be switched off (#37, A5)');
select pg_temp.assert_true((select count(*) = 2 from public.equipment_requirement_notifications
  where event_id = pg_temp.ev(76) and action in ('reserved', 'partially_reserved', 'unavailable')),
 'AC-014.13.6: one notification per requirement outcome, not per unit');
select pg_temp.assert_true(
  pg_temp.us14_as(pg_temp.u('C1'), format(
    'select 1 from public.equipment_requirement_notifications where requirement_id = %L', pg_temp.rq(60))) = 'rows:1'
  and pg_temp.us14_as(pg_temp.u('C2'), format(
    'select 1 from public.equipment_requirement_notifications where requirement_id = %L', pg_temp.rq(60))) = 'rows:0'
  and pg_temp.us14_as(pg_temp.u('TS1'), format(
    'select 1 from public.equipment_requirement_notifications where requirement_id = %L and action = %L',
    pg_temp.rq(60), 'reserved')) = 'rows:0'
  and pg_temp.us14_as(pg_temp.u('C1'), format($q$
    insert into public.equipment_requirement_notifications (event_id, recipient_id, action, type_name, quantity)
    values (%L, %L, 'reserved', 'Forged', 1)$q$, pg_temp.ev(60), pg_temp.u('C1'))) = '42501'
  and pg_temp.us14_as(pg_temp.u('C1'), $q$update public.equipment_requirement_notifications set quantity = 9$q$) = '42501',
 'AC-014.13.7: only the assigned coordinator reads outcome notices and nobody can forge them');
select pg_temp.assert_true(:'us14_over_message' like '23P01:%'
  and not exists (select 1 from public.equipment_requirement_notifications
                  where requirement_id = pg_temp.rq(90) and action in ('reserved', 'partially_reserved', 'unavailable'))
  and not exists (select 1 from public.notification_outbox where event_id = pg_temp.ev(90)),
 'AC-014.13.8: a rejected reservation sends no notification');

reset role;
select set_config('request.jwt.claim.sub', '', false);
