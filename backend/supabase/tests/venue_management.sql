-- US46 Add and edit venue details (SCRUM-241), slice 1 (0064). Disposable PostgreSQL only;
-- run through the database runner. Fixtures run inside a transaction that is rolled back.
-- Auth is simulated; RLS is real. Each action runs in its own statement before it is
-- asserted: a statement cannot see the writes made by functions it calls.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('46000000-0000-0000-0000-000000000001', 'venue-staff-0064@example.test'),
  ('46000000-0000-0000-0000-000000000002', 'coordinator-0064@example.test'),
  ('46000000-0000-0000-0000-000000000003', 'organiser-0064@example.test'),
  ('46000000-0000-0000-0000-000000000004', 'operations-0064@example.test'),
  ('46000000-0000-0000-0000-000000000005', 'tech-0064@example.test'),
  ('46000000-0000-0000-0000-000000000006', 'attendee-0064@example.test'),
  ('46000000-0000-0000-0000-000000000007', 'lead-0064@example.test');
update public.profiles set role = 'venue_staff' where id = '46000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '46000000-0000-0000-0000-000000000002';
update public.profiles set role = 'organiser' where id = '46000000-0000-0000-0000-000000000003';
update public.profiles set role = 'operations_manager' where id = '46000000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '46000000-0000-0000-0000-000000000005';
update public.profiles set role = 'attendee' where id = '46000000-0000-0000-0000-000000000006';
update public.profiles set role = 'coordinator_lead' where id = '46000000-0000-0000-0000-000000000007';

-- Runs one statement as a browser user. Returns the affected row count, or the SQLSTATE of
-- a refusal, so a refusal is distinguishable from an unrelated error.
create function pg_temp.us46_as(actor uuid, statement text)
returns text language plpgsql as $$
declare affected integer;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  get diagnostics affected = row_count;
  return 'rows:' || affected;
exception when others then
  return sqlstate;
end $$;

-- add_venue with everything valid, so each refusal test changes exactly one argument.
create function pg_temp.us46_add(
  actor uuid,
  name text default '0064 Test Hall',
  location text default 'Level 2',
  opens text default '07:00',
  closes text default '18:00',
  layouts text default '[{"layout":"theatre","capacity":120},{"layout":"classroom","capacity":60}]',
  accessibility text default '{wheelchair_access}',
  facilities text default '{projector}'
) returns text language sql as $$
  select pg_temp.us46_as(actor, format(
    'select public.add_venue(%L, %L, %L::time, %L::time, %L::text[], %L::text[], %L::jsonb)',
    name, location, opens, closes, accessibility, facilities, layouts));
$$;

create function pg_temp.us46_venues(venue_name text) returns integer
language sql as $$ select count(*)::integer from public.venues where name = venue_name; $$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.1: Venue Staff can add a venue with all its details
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select public.add_venue(
  '  0064 Grand Hall  ', ' Level 1 ', '07:00', '18:00',
  '{wheelchair_access,hearing_loop}', '{projector,wifi}',
  '[{"layout":"classroom","capacity":60},{"layout":"theatre","capacity":120}]'
) as us46_hall \gset
reset role;
select pg_temp.assert_true(
  (select name = '0064 Grand Hall' and location = 'Level 1' and status = 'active'
          and opens_at = '07:00' and closes_at = '18:00'
          and accessibility @> '{wheelchair_access,hearing_loop}' and cardinality(accessibility) = 2
          and facility = '{"projector": true, "wifi": true}'::jsonb
   from public.venues where id = :'us46_hall')
  and (select count(*) = 2 from public.venue_layouts where venue_id = :'us46_hall')
  and exists (select 1 from public.venue_layouts where venue_id = :'us46_hall' and layout = 'theatre' and capacity = 120)
  and exists (select 1 from public.venue_layouts where venue_id = :'us46_hall' and layout = 'classroom' and capacity = 60),
  'AC-046.1.1: Venue Staff add a venue with its name, location, facilities, accessibility, operating hours and each layout''s capacity');

select pg_temp.assert_true(
  (select layout = 'theatre' and capacity = 120 from public.venues where id = :'us46_hall'),
  'AC-046.1.2: the largest layout becomes the venue''s primary layout, which venue search reads');

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select public.add_venue('0064 Tie Room', 'Level 3', '13:00', '24:00', '{}', '{}',
  '[{"layout":"boardroom","capacity":20},{"layout":"u_shape","capacity":20}]') as us46_tie \gset
reset role;
select pg_temp.assert_true(
  (select layout = 'boardroom' and capacity = 20 and opens_at = '13:00' and closes_at = '24:00'
          and facility = '{}'::jsonb and accessibility = '{}'
   from public.venues where id = :'us46_tie'),
  'AC-046.1.3: on a tie the first layout listed is primary; a venue may have no facilities or accessibility features, and may close at midnight');

set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Odd Hours', opens => '09:00', closes => '17:00') as us46_odd \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Backwards', opens => '13:00', closes => '12:00') as us46_backwards \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Empty Hours', opens => '13:00', closes => '13:00') as us46_empty_hours \gset
reset role;
select pg_temp.assert_true(
  :'us46_odd' = '23514' and :'us46_backwards' = '23514' and :'us46_empty_hours' = '23514'
  and pg_temp.us46_venues('0064 Odd Hours') = 0 and pg_temp.us46_venues('0064 Backwards') = 0
  and pg_temp.us46_venues('0064 Empty Hours') = 0,
  'AC-046.1.4: operating hours must open and close on slot boundaries, closing after opening');

set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '   ') as us46_no_name \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 No Location', location => '') as us46_no_location \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001',
  $sql$select public.add_venue('0064 No Hours', 'Level 1', null, null, '{}', '{}', '[{"layout":"theatre","capacity":10}]')$sql$) as us46_no_hours \gset
reset role;
select pg_temp.assert_true(
  :'us46_no_name' = '22023' and :'us46_no_location' = '22023' and :'us46_no_hours' = '22023'
  and pg_temp.us46_venues('0064 No Location') = 0 and pg_temp.us46_venues('0064 No Hours') = 0,
  'AC-046.1.5: a venue needs a name, a location and operating hours');

set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Bad Layout', layouts => '[{"layout":"igloo","capacity":10}]') as us46_bad_layout \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Bad Access', accessibility => '{teleporter}') as us46_bad_access \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Bad Facility', facilities => '{moat}') as us46_bad_facility \gset
reset role;
select pg_temp.assert_true(
  :'us46_bad_layout' = '22023' and :'us46_bad_access' = '22023' and :'us46_bad_facility' = '22023'
  and pg_temp.us46_venues('0064 Bad Layout') = 0 and pg_temp.us46_venues('0064 Bad Access') = 0
  and pg_temp.us46_venues('0064 Bad Facility') = 0,
  'AC-046.1.6: layouts, facilities and accessibility features must come from the catalogues events use');

set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Grand Hall') as us46_duplicate \gset
reset role;
select pg_temp.assert_true(
  :'us46_duplicate' = '23505' and pg_temp.us46_venues('0064 Grand Hall') = 1,
  'AC-046.1.7: a name another venue already uses is refused');

-- ---------------------------------------------------------------------------
-- AC-046.3: every supported layout has a capacity of at least 1
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Zero', layouts => '[{"layout":"theatre","capacity":0}]') as us46_zero \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Negative', layouts => '[{"layout":"theatre","capacity":-5}]') as us46_negative \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Fraction', layouts => '[{"layout":"theatre","capacity":1.5}]') as us46_fraction \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Missing', layouts => '[{"layout":"theatre"}]') as us46_missing \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Text', layouts => '[{"layout":"theatre","capacity":"50"}]') as us46_text \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 One', layouts => '[{"layout":"theatre","capacity":1}]') as us46_one \gset
reset role;
select pg_temp.assert_true(
  :'us46_zero' = '22023' and :'us46_negative' = '22023' and :'us46_fraction' = '22023'
  and :'us46_missing' = '22023' and :'us46_text' = '22023' and :'us46_one' = 'rows:1'
  and pg_temp.us46_venues('0064 Zero') = 0 and pg_temp.us46_venues('0064 Fraction') = 0
  and pg_temp.us46_venues('0064 One') = 1,
  'AC-046.3.1: a layout capacity below 1, fractional or missing is refused; exactly 1 is accepted');

set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 No Layouts', layouts => '[]') as us46_no_layouts \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001',
  $sql$select public.add_venue('0064 Null Layouts', 'L1', '07:00', '12:00', '{}', '{}', null)$sql$) as us46_null_layouts \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Twice',
  layouts => '[{"layout":"theatre","capacity":10},{"layout":"theatre","capacity":20}]') as us46_twice \gset
reset role;
select pg_temp.assert_true(
  :'us46_no_layouts' = '22023' and :'us46_null_layouts' = '22023' and :'us46_twice' = '22023'
  and pg_temp.us46_venues('0064 No Layouts') = 0 and pg_temp.us46_venues('0064 Twice') = 0,
  'AC-046.3.2: a venue needs at least one layout, and each layout is listed once');

-- A refusal part-way through must leave nothing behind: the second layout is invalid here.
set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000001', name => '0064 Half Saved',
  layouts => '[{"layout":"theatre","capacity":50},{"layout":"classroom","capacity":0}]') as us46_half \gset
reset role;
select pg_temp.assert_true(
  :'us46_half' = '22023' and pg_temp.us46_venues('0064 Half Saved') = 0
  and not exists (select 1 from public.venue_changes c where c.details ->> 'name' = '0064 Half Saved'),
  'AC-046.3.3: a venue with one invalid layout is not saved at all, not even its valid layouts');

set local role authenticated;
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$insert into public.venue_layouts (venue_id, layout, capacity) values (%L, 'banquet', 0)$sql$, :'us46_hall')) as us46_direct_zero \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$update public.venue_layouts set capacity = 0 where venue_id = %L and layout = 'classroom'$sql$, :'us46_hall')) as us46_update_zero \gset
reset role;
select pg_temp.assert_true(
  :'us46_direct_zero' = '23514' and :'us46_update_zero' = '23514'
  and exists (select 1 from public.venue_layouts where venue_id = :'us46_hall' and layout = 'classroom' and capacity = 60),
  'AC-046.3.4: the database refuses a layout capacity below 1 even when written directly');

-- ---------------------------------------------------------------------------
-- AC-046.6: only Venue Staff change venues; every change records who and when
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us46_add('46000000-0000-0000-0000-000000000002', name => '0064 By Coordinator') as us46_by_coordinator \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000003', name => '0064 By Organiser') as us46_by_organiser \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000004', name => '0064 By Operations') as us46_by_operations \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000005', name => '0064 By Tech') as us46_by_tech \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000006', name => '0064 By Attendee') as us46_by_attendee \gset
select pg_temp.us46_add('46000000-0000-0000-0000-000000000007', name => '0064 By Lead') as us46_by_lead \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000004',
  $sql$insert into public.venues (name, location, capacity, layout) values ('0064 Direct Operations', 'L1', 10, 'theatre')$sql$) as us46_direct_operations \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000002',
  $sql$insert into public.venues (name, location, capacity, layout) values ('0064 Direct Coordinator', 'L1', 10, 'theatre')$sql$) as us46_direct_coordinator \gset
reset role;
select pg_temp.assert_true(
  :'us46_by_coordinator' = '42501' and :'us46_by_organiser' = '42501'
  and :'us46_by_operations' = '42501' and :'us46_by_tech' = '42501'
  and :'us46_by_attendee' = '42501' and :'us46_by_lead' = '42501'
  and :'us46_direct_operations' = '42501' and :'us46_direct_coordinator' = '42501'
  and not exists (select 1 from public.venues where name like '0064 By %' or name like '0064 Direct %'),
  'AC-046.6.1: no role but Venue Staff can add a venue, through the function or directly');

set local role authenticated;
select pg_temp.us46_as('46000000-0000-0000-0000-000000000004', format(
  $sql$update public.venues set location = 'Moved' where id = %L$sql$, :'us46_hall')) as us46_operations_update \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000004', format(
  $sql$update public.venue_layouts set capacity = 999 where venue_id = %L$sql$, :'us46_hall')) as us46_operations_layout \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000004', format(
  $sql$delete from public.venue_layouts where venue_id = %L$sql$, :'us46_hall')) as us46_operations_delete \gset
reset role;
select pg_temp.assert_true(
  :'us46_operations_update' = 'rows:0' and :'us46_operations_layout' = 'rows:0' and :'us46_operations_delete' = 'rows:0'
  and (select location = 'Level 1' from public.venues where id = :'us46_hall')
  and (select count(*) = 2 from public.venue_layouts where venue_id = :'us46_hall' and capacity < 999),
  'AC-046.6.2: the Operations Manager can no longer change venues or their layouts');

select pg_temp.assert_true(
  (select count(*) = 1 from public.venue_changes
   where venue_id = :'us46_hall' and action = 'created'
     and changed_by = '46000000-0000-0000-0000-000000000001' and changed_at is not null
     and details ->> 'name' = '0064 Grand Hall')
  and (select count(*) = 2 from public.venue_changes
       where venue_id = :'us46_hall' and action = 'layout_added'
         and changed_by = '46000000-0000-0000-0000-000000000001'),
  'AC-046.6.3: adding a venue records who added it and when, and each layout added');

set local role authenticated;
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$update public.venues set location = 'Level 4', opens_at = '13:00' where id = %L$sql$, :'us46_hall')) as us46_staff_update \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$update public.venues set name = name where id = %L$sql$, :'us46_hall')) as us46_no_change \gset
reset role;
select pg_temp.assert_true(
  :'us46_staff_update' = 'rows:1' and :'us46_no_change' = 'rows:1'
  and (select count(*) = 1 from public.venue_changes where venue_id = :'us46_hall' and action = 'updated')
  and (select details = jsonb_build_object(
          'location', jsonb_build_object('from', 'Level 1', 'to', 'Level 4'),
          'opens_at', jsonb_build_object('from', '07:00:00', 'to', '13:00:00'))
          and changed_by = '46000000-0000-0000-0000-000000000001'
       from public.venue_changes where venue_id = :'us46_hall' and action = 'updated'),
  'AC-046.6.4: an edit records who made it, when, and each detail''s old and new value; an edit that changes nothing records nothing');

set local role authenticated;
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$update public.venue_layouts set capacity = 70 where venue_id = %L and layout = 'classroom'$sql$, :'us46_hall')) as us46_layout_update \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$delete from public.venue_layouts where venue_id = %L and layout = 'classroom'$sql$, :'us46_hall')) as us46_layout_delete \gset
reset role;
select pg_temp.assert_true(
  :'us46_layout_update' = 'rows:1' and :'us46_layout_delete' = 'rows:1'
  and exists (select 1 from public.venue_changes where venue_id = :'us46_hall' and action = 'layout_updated'
              and details = '{"layout": "classroom", "capacity": {"from": 60, "to": 70}}'::jsonb
              and changed_by = '46000000-0000-0000-0000-000000000001')
  and exists (select 1 from public.venue_changes where venue_id = :'us46_hall' and action = 'layout_removed'
              and details = '{"layout": "classroom", "capacity": 70}'::jsonb),
  'AC-046.6.5: changing or removing a layout records who did it and the capacity involved');

set local role authenticated;
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$insert into public.venue_changes (venue_id, action) values (%L, 'updated')$sql$, :'us46_hall')) as us46_forge \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001',
  $sql$update public.venue_changes set changed_by = null$sql$) as us46_rewrite \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001',
  $sql$delete from public.venue_changes$sql$) as us46_erase \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000001', format(
  $sql$select 1 from public.venue_changes where venue_id = %L$sql$, :'us46_hall')) as us46_staff_reads \gset
select pg_temp.us46_as('46000000-0000-0000-0000-000000000002', format(
  $sql$select 1 from public.venue_changes where venue_id = %L$sql$, :'us46_hall')) as us46_coordinator_reads \gset
reset role;
select pg_temp.assert_true(
  :'us46_forge' = '42501' and :'us46_rewrite' = '42501' and :'us46_erase' = '42501'
  and :'us46_staff_reads' <> 'rows:0' and :'us46_coordinator_reads' = 'rows:0',
  'AC-046.6.6: nobody can write or erase the change history from the app, and only Venue Staff can read it');

-- A change made outside the app (seed data, a migration, the dashboard) has no signed-in user.
select set_config('request.jwt.claim.sub', '', true);
insert into public.venues (name, location, capacity, layout) values ('0064 Seeded', 'Basement', 30, 'theatre');
select pg_temp.assert_true(
  exists (select 1 from public.venue_changes c join public.venues v on v.id = c.venue_id
          where v.name = '0064 Seeded' and c.action = 'created' and c.changed_by is null),
  'AC-046.6.7: a venue added outside the app is still recorded, with no user attached');

rollback;
