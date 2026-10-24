-- US43 Operational safety review (SCRUM-239), slice 2 (0109): the Safety Officer's review queue.
-- Disposable PostgreSQL only. Run by run_venue_time_conversion.sh straight after 0109, which is
-- applied after 0100 (it reads continuous venue blocks). Fixtures run inside a transaction that is
-- rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.us43q_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users (id, email) values
  ('43c00000-0000-0000-0000-000000000001', 'organiser-43c@example.test'), ('43c00000-0000-0000-0000-000000000002', 'coordinator-43c@example.test'),
  ('43c00000-0000-0000-0000-000000000003', 'safety-43c@example.test'), ('43c00000-0000-0000-0000-000000000004', 'venue-43c@example.test'),
  ('43c00000-0000-0000-0000-000000000005', 'tech-43c@example.test'), ('43c00000-0000-0000-0000-000000000006', 'lead-43c@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '43c00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '43c00000-0000-0000-0000-000000000002';
update public.profiles set role = 'safety_officer' where id = '43c00000-0000-0000-0000-000000000003';
update public.profiles set role = 'venue_staff' where id = '43c00000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '43c00000-0000-0000-0000-000000000005';
update public.profiles set role = 'coordinator_lead' where id = '43c00000-0000-0000-0000-000000000006';

insert into public.venues (id, name, location, capacity, layout, status, accessibility, opens_at, closes_at) values
  ('43c10000-0000-0000-0000-000000000001', 'Queue Hall', 'Level 1', 300, 'theatre', 'active', '{wheelchair_access,lift_access}', null, null),
  ('43c10000-0000-0000-0000-000000000002', 'Queue Annex', 'Level 2', 80, 'classroom', 'under_maintenance', '{}', '07:00', '18:00');
insert into public.venue_layouts (venue_id, layout, capacity) values
  ('43c10000-0000-0000-0000-000000000001', 'theatre', 150), ('43c10000-0000-0000-0000-000000000001', 'classroom', 60), ('43c10000-0000-0000-0000-000000000002', 'classroom', 40)
on conflict (venue_id, layout) do update set capacity = excluded.capacity;

-- Q2 was sent first, then Q1; Q3 is still in Planning.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, layout_preference, accessibility_requirements,
  safety_review_requested_at, safety_review_requested_by) values
  ('43c30000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000002', 'Queue Conference', 'Fixture', '2042-03-10 09:00+08', '2042-03-10 11:00+08', 100,
   'awaiting_safety_review', 'EVT-43C-1', 'Talks', 'theatre', '{wheelchair_access,hearing_loop}', now() - interval '2 days', '43c00000-0000-0000-0000-000000000002'),
  ('43c30000-0000-0000-0000-000000000002', '43c00000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000002', 'Queue Workshop', 'Fixture', '2042-03-12 09:00+08', '2042-03-12 11:00+08', 20,
   'awaiting_safety_review', 'EVT-43C-2', 'Talks', 'classroom', '{}', now() - interval '5 days', '43c00000-0000-0000-0000-000000000002'),
  ('43c30000-0000-0000-0000-000000000003', '43c00000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000002', 'Queue Planning', 'Fixture', '2042-03-14 09:00+08', '2042-03-14 11:00+08', 20,
   'planning', 'EVT-43C-3', 'Talks', 'classroom', '{}', null, null);

-- The main hall uses the event's layout; the annex holds a breakout of 45 in a classroom (US49);
-- a rejected booking is not part of the event.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, space_layout, space_attendance, review_note) values
  ('43c50000-0000-0000-0000-000000000001', '43c30000-0000-0000-0000-000000000001', '43c10000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000002', 'confirmed', null, null, null),
  ('43c50000-0000-0000-0000-000000000002', '43c30000-0000-0000-0000-000000000001', '43c10000-0000-0000-0000-000000000002', '43c00000-0000-0000-0000-000000000002', 'confirmed', 'classroom', 45, null),
  ('43c50000-0000-0000-0000-000000000003', '43c30000-0000-0000-0000-000000000001', '43c10000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000002', 'rejected', null, null, 'Fixture');

-- A block on the event's day, and one the day after.
select set_config('request.jwt.claim.sub', '43c00000-0000-0000-0000-000000000004', true);
select public.block_venue_period('43c10000-0000-0000-0000-000000000001', '2042-03-10 10:00+08', '2042-03-10 10:30+08', 'Ceiling repair');
select public.block_venue_period('43c10000-0000-0000-0000-000000000001', '2042-03-11 10:00+08', '2042-03-11 10:30+08', 'Floor polishing');
select set_config('request.jwt.claim.sub', '', true);

-- An essential projector request with both items reserved, and a microphone that could not be.
insert into public.equipment_types (id, name, category) values ('43c20000-0000-0000-0000-000000000001', 'Queue Projector', 'Visual'), ('43c20000-0000-0000-0000-000000000002', 'Queue Microphone', 'Audio');
insert into public.equipment_items (id, type_id, asset_tag, home_venue_id, current_venue_id) values
  ('43c60000-0000-0000-0000-000000000001', '43c20000-0000-0000-0000-000000000001', 'Q43C-PROJ-1', '43c10000-0000-0000-0000-000000000001', '43c10000-0000-0000-0000-000000000001'), ('43c60000-0000-0000-0000-000000000002', '43c20000-0000-0000-0000-000000000001', 'Q43C-PROJ-2', '43c10000-0000-0000-0000-000000000001', '43c10000-0000-0000-0000-000000000001');
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to, status)
  values ('43c70000-0000-0000-0000-000000000001', '43c30000-0000-0000-0000-000000000001', '43c00000-0000-0000-0000-000000000002', '43c10000-0000-0000-0000-000000000001', '2042-03-10', '2042-03-10', 'confirmed');
insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested, quantity_reserved, status)
  values ('43c70000-0000-0000-0000-000000000002', '43c70000-0000-0000-0000-000000000001', '43c20000-0000-0000-0000-000000000001', 2, 2, 'fulfilled');
insert into public.equipment_allocations (line_id, item_id, type_id, blocked_from, blocked_to, status, reserved_by) values
  ('43c70000-0000-0000-0000-000000000002', '43c60000-0000-0000-0000-000000000001', '43c20000-0000-0000-0000-000000000001', '2042-03-10', '2042-03-11', 'reserved', '43c00000-0000-0000-0000-000000000005'),
  ('43c70000-0000-0000-0000-000000000002', '43c60000-0000-0000-0000-000000000002', '43c20000-0000-0000-0000-000000000001', '2042-03-10', '2042-03-11', 'reserved', '43c00000-0000-0000-0000-000000000005');
insert into public.event_equipment_requirements (id, event_id, type_id, quantity, essential, created_by)
  values ('43c40000-0000-0000-0000-000000000001', '43c30000-0000-0000-0000-000000000001', '43c20000-0000-0000-0000-000000000001', 2, true, '43c00000-0000-0000-0000-000000000002'), ('43c40000-0000-0000-0000-000000000002', '43c30000-0000-0000-0000-000000000001', '43c20000-0000-0000-0000-000000000002', 1, false, '43c00000-0000-0000-0000-000000000002');
update public.event_equipment_requirements set status = 'reserved', booking_line_id = '43c70000-0000-0000-0000-000000000002' where id = '43c40000-0000-0000-0000-000000000001';
update public.event_equipment_requirements set status = 'unavailable' where id = '43c40000-0000-0000-0000-000000000002';

-- Reads the queue as a signed-in user: the rows as JSON, or the SQLSTATE of the refusal.
create function pg_temp.us43_queue(actor uuid) returns text language plpgsql as $$
declare
  result text;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  select coalesce(json_agg(q)::text, '[]') into result from public.get_safety_review_queue() q;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return result;
exception when others then
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

select pg_temp.us43_queue('43c00000-0000-0000-0000-000000000003') as us43_queue \gset
create temporary table us43_q as select * from jsonb_array_elements(:'us43_queue'::jsonb) with ordinality as q(row, n);
create function pg_temp.us43_row(ref text) returns jsonb language sql as $$ select row from us43_q where row ->> 'reference' = ref $$;

-- ---------------------------------------------------------------------------
-- AC-043.4: a Safety Officer sees the events awaiting review, with what the check needs
-- ---------------------------------------------------------------------------
select pg_temp.us43q_assert(
  (select array_agg(row ->> 'reference' order by n) from us43_q) = array['EVT-43C-2', 'EVT-43C-1'],
  'AC-043.4.1: the queue lists only events awaiting review, the one sent first at the top');

select pg_temp.us43q_assert(
  (pg_temp.us43_row('EVT-43C-1') ->> 'expected_attendance')::int = 100
  and pg_temp.us43_row('EVT-43C-1') -> 'accessibility' = '["Hearing loop", "Wheelchair access"]'::jsonb
  and pg_temp.us43_row('EVT-43C-1') ->> 'sent_at' is not null
  and pg_temp.us43_row('EVT-43C-2') -> 'venues' = '[]'::jsonb and pg_temp.us43_row('EVT-43C-2') -> 'equipment' = '[]'::jsonb,
  'AC-043.4.2: each event shows its expected attendance, its accessibility requirements by name, and when it was sent');

select pg_temp.us43q_assert(
  jsonb_array_length(pg_temp.us43_row('EVT-43C-1') -> 'venues') = 2
  and pg_temp.us43_row('EVT-43C-1') -> 'venues' -> 0 @> '{"venue": "Queue Annex", "layout": "Classroom", "attendance": 45, "capacity": 40}'
  and pg_temp.us43_row('EVT-43C-1') -> 'venues' -> 1 @> '{"venue": "Queue Hall", "layout": "Theatre", "attendance": 100, "capacity": 150}'
  and pg_temp.us43_row('EVT-43C-1') -> 'venues' -> 1 -> 'accessibility' = '["Lift access", "Wheelchair access"]'::jsonb,
  'AC-043.4.3: each approved venue shows the layout and attendance of its booking against the venue''s capacity for that layout, and its accessibility');

select pg_temp.us43q_assert(
  pg_temp.us43_row('EVT-43C-1') -> 'venues' -> 0 -> 'restrictions' = '["Under maintenance", "Open 07:00 to 18:00"]'::jsonb
  and pg_temp.us43_row('EVT-43C-1') -> 'venues' -> 1 -> 'restrictions' = '["Blocked on the event''s dates: Ceiling repair"]'::jsonb,
  'AC-043.4.4: each venue lists its known restrictions: maintenance, opening hours, and blocks on the event''s dates only');

select pg_temp.us43q_assert(
  pg_temp.us43_row('EVT-43C-1') -> 'equipment'
    = '[{"item": "Queue Projector", "quantity": 2, "essential": true, "status": "reserved", "reserved": 2},
        {"item": "Queue Microphone", "quantity": 1, "essential": false, "status": "unavailable", "reserved": 0}]'::jsonb,
  'AC-043.4.5: the equipment shows each request, essential first, with how many items are actually reserved');

select pg_temp.us43q_assert(
  pg_temp.us43_queue('43c00000-0000-0000-0000-000000000002') = '42501' and pg_temp.us43_queue('43c00000-0000-0000-0000-000000000001') = '42501'
  and pg_temp.us43_queue('43c00000-0000-0000-0000-000000000006') = '42501' and pg_temp.us43_queue('43c00000-0000-0000-0000-000000000004') = '42501',
  'AC-043.4.6: only a Safety Officer can see the queue');

select set_config('request.jwt.claim.sub', '43c00000-0000-0000-0000-000000000003', true);
update public.events set status = 'in_preparation' where id = '43c30000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.us43q_assert(
  (select array_agg(q.row ->> 'reference') from jsonb_array_elements(pg_temp.us43_queue('43c00000-0000-0000-0000-000000000003')::jsonb) as q(row)) = array['EVT-43C-1'],
  'AC-043.4.7: once the Safety Officer has decided an event, it leaves the queue');

rollback;
