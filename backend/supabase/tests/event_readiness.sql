-- US5 Tracking Event Readiness (SCRUM-10), 0076. Disposable PostgreSQL only; run through the
-- database runner. Fixtures run inside a transaction that is rolled back. Auth is simulated.
-- Readiness is always read while signed in as the person asking.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('05000000-0000-0000-0000-000000000001', 'organiser-us5@example.test'),
  ('05000000-0000-0000-0000-000000000002', 'coordinator-us5@example.test'),
  ('05000000-0000-0000-0000-000000000003', 'other-coordinator-us5@example.test'),
  ('05000000-0000-0000-0000-000000000004', 'lead-us5@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '05000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator'
  where id in ('05000000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000003');
update public.profiles set role = 'coordinator_lead' where id = '05000000-0000-0000-0000-000000000004';

insert into public.venues (id, name, location, capacity, layout, status) values
  ('05100000-0000-0000-0000-000000000001', 'US5 Hall', 'Level 1', 200, 'theatre', 'active'),
  ('05100000-0000-0000-0000-000000000002', 'US5 Annex', 'Level 2', 80, 'theatre', 'active');
insert into public.equipment_types (id, name, category) values
  ('05200000-0000-0000-0000-000000000001', 'US5 Projector', 'Visual'),
  ('05200000-0000-0000-0000-000000000002', 'US5 Microphone', 'Audio'),
  ('05200000-0000-0000-0000-000000000003', 'US5 Banner stand', 'Signage');

-- E1 Planning: one booking approved and one awaiting Venue Staff; one essential item reserved,
--    one unavailable, and a non-essential one Technical Support has not reviewed; no programme;
--    no registration.
-- E2 Confirmed: one approved booking, no equipment, a programme, registration on.
-- E3 Planning: nothing booked; only a non-essential item, already reviewed; a blank programme;
--    registration on.
-- E4 Planning: a live hold, an expired hold and a rejected request.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, registration_required)
values
  ('05300000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002',
   'US5 Gala', 'Fixture', '2039-10-01 09:00+08', '2039-10-01 17:00+08', 150, 'planning', 'EVT-US5-1', null, false),
  ('05300000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002',
   'US5 Talks', 'Fixture', '2039-10-02 09:00+08', '2039-10-02 11:00+08', 60, 'confirmed', 'EVT-US5-2', 'Three talks and a panel', true),
  ('05300000-0000-0000-0000-000000000003', '05000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002',
   'US5 Workshop', 'Fixture', '2039-10-03 09:00+08', '2039-10-03 11:00+08', 30, 'planning', 'EVT-US5-3', '   ', true),
  ('05300000-0000-0000-0000-000000000004', '05000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002',
   'US5 Holds', 'Fixture', '2039-10-04 09:00+08', '2039-10-04 11:00+08', 30, 'planning', 'EVT-US5-4', null, false);

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('05500000-0000-0000-0000-000000000011', '05300000-0000-0000-0000-000000000001', '05100000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002', 'confirmed', null),
  ('05500000-0000-0000-0000-000000000012', '05300000-0000-0000-0000-000000000001', '05100000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('05500000-0000-0000-0000-000000000021', '05300000-0000-0000-0000-000000000002', '05100000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000002', 'confirmed', null),
  ('05500000-0000-0000-0000-000000000041', '05300000-0000-0000-0000-000000000004', '05100000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002', 'held', now() + interval '3 days'),
  ('05500000-0000-0000-0000-000000000042', '05300000-0000-0000-0000-000000000004', '05100000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000002', 'expired', now() - interval '1 hour');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at, reviewed_by, reviewed_at, review_note) values
  ('05500000-0000-0000-0000-000000000043', '05300000-0000-0000-0000-000000000004', '05100000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000002', 'rejected', null,
   '05000000-0000-0000-0000-000000000002', now(), 'Fixture');

insert into public.event_equipment_requirements (id, event_id, type_id, quantity, essential, created_by) values
  ('05400000-0000-0000-0000-000000000011', '05300000-0000-0000-0000-000000000001', '05200000-0000-0000-0000-000000000001', 2, true, '05000000-0000-0000-0000-000000000002'),
  ('05400000-0000-0000-0000-000000000012', '05300000-0000-0000-0000-000000000001', '05200000-0000-0000-0000-000000000002', 1, true, '05000000-0000-0000-0000-000000000002'),
  ('05400000-0000-0000-0000-000000000013', '05300000-0000-0000-0000-000000000001', '05200000-0000-0000-0000-000000000003', 1, false, '05000000-0000-0000-0000-000000000002'),
  ('05400000-0000-0000-0000-000000000031', '05300000-0000-0000-0000-000000000003', '05200000-0000-0000-0000-000000000003', 1, false, '05000000-0000-0000-0000-000000000002');
update public.event_equipment_requirements set status = 'reserved'
  where id in ('05400000-0000-0000-0000-000000000011', '05400000-0000-0000-0000-000000000031');
update public.event_equipment_requirements set status = 'unavailable' where id = '05400000-0000-0000-0000-000000000012';

-- An event's readiness as one JSON array, read as the given person, or the SQLSTATE of a refusal.
create function pg_temp.us5_lines(actor uuid, event uuid) returns jsonb
language plpgsql as $$
declare answer jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order), '[]'::jsonb) into answer
  from public.get_event_readiness(event) r;
  return answer;
exception when others then
  return to_jsonb(sqlstate);
end $$;

create function pg_temp.us5_line(lines jsonb, wanted text) returns jsonb
language sql as $$ select x from jsonb_array_elements(lines) x where x ->> 'arrangement' = wanted $$;

set local role authenticated;
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05300000-0000-0000-0000-000000000001') as us5_e1 \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05300000-0000-0000-0000-000000000002') as us5_e2 \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05300000-0000-0000-0000-000000000003') as us5_e3 \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05300000-0000-0000-0000-000000000004') as us5_e4 \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000003', '05300000-0000-0000-0000-000000000001') as us5_other_coordinator \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000001', '05300000-0000-0000-0000-000000000001') as us5_organiser \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000004', '05300000-0000-0000-0000-000000000001') as us5_lead \gset
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05399999-0000-0000-0000-000000000000') as us5_unknown \gset
select pg_temp.us5_lines(null, '05300000-0000-0000-0000-000000000001') as us5_signed_out \gset
reset role;

-- ---------------------------------------------------------------------------
-- AC-005.1: the Coordinator sees the status of each required arrangement
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select array_agg(x ->> 'arrangement' order by (x ->> 'sort_order')::int) from jsonb_array_elements(:'us5_e1'::jsonb) x)
    = array['venue_booking', 'equipment_reservation', 'technical_support', 'programme']
  and (select array_agg(x ->> 'label' order by (x ->> 'sort_order')::int) from jsonb_array_elements(:'us5_e1'::jsonb) x)
    = array['Venue booking', 'Equipment reservation', 'Technical support', 'Programme'],
  'AC-005.1.1: the assigned Coordinator sees one line per arrangement the event needs, in a fixed order');

-- ---------------------------------------------------------------------------
-- AC-005.2, AC-005.3: each arrangement's status, complete or outstanding
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e1', 'venue_booking') @> '{"complete": false, "detail": "1 booking awaiting Venue Staff. 1 approved."}'
  and pg_temp.us5_line(:'us5_e2', 'venue_booking') @> '{"complete": true, "detail": "1 venue booking approved."}'
  and pg_temp.us5_line(:'us5_e3', 'venue_booking') @> '{"complete": false, "detail": "No venue booked yet."}'
  -- US49 (0107, carried into 0108's shared readiness helper): a rejection stays outstanding.
  and pg_temp.us5_line(:'us5_e4', 'venue_booking') @> '{"complete": false, "detail": "1 rejected; venue requirements remain outstanding. 1 booking held, not yet requested."}',
  'AC-005.2.1: the venue booking is complete only when every live booking is approved; expired holds do not count, and a rejection stays outstanding');

select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e1', 'equipment_reservation') @> '{"complete": false, "detail": "1 of 2 essential items reserved. 1 unavailable."}'
  and pg_temp.us5_line(:'us5_e3', 'equipment_reservation') @> '{"complete": true, "detail": "No essential equipment needed."}',
  'AC-005.2.2: equipment is complete when every essential item is reserved; non-essential items do not hold it back');

select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e1', 'technical_support') @> '{"complete": false, "detail": "1 equipment request awaiting Technical Support."}'
  and pg_temp.us5_line(:'us5_e3', 'technical_support') @> '{"complete": true, "detail": "Technical Support has reviewed every equipment request."}',
  'AC-005.2.3: technical support is complete once Technical Support has reviewed every equipment request');

select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e2', 'programme') @> '{"complete": true, "detail": "Programme added."}'
  and pg_temp.us5_line(:'us5_e1', 'programme') @> '{"complete": false, "detail": "No programme yet."}'
  and pg_temp.us5_line(:'us5_e3', 'programme') @> '{"complete": false}',
  'AC-005.2.4: the programme is complete once it is written; a blank one is still outstanding');

select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e2', 'registration_setup') @> '{"complete": true, "detail": "Registration is open to Attendees."}'
  and pg_temp.us5_line(:'us5_e3', 'registration_setup') @> '{"complete": false, "detail": "Registration opens to Attendees once the event is confirmed."}',
  'AC-005.2.5: registration setup is complete once Attendees can register');

-- ---------------------------------------------------------------------------
-- AC-005.4: only the assigned Coordinator sees the event's readiness
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  :'us5_other_coordinator' = '"42501"' and :'us5_organiser' = '"42501"' and :'us5_lead' = '"42501"'
  and :'us5_unknown' = '"P0002"' and :'us5_signed_out' = '"42501"',
  'AC-005.4.1: another Coordinator, the Organiser, a Lead or someone signed out is refused; an unknown event is reported as not found');

-- ---------------------------------------------------------------------------
-- AC-005.6, AC-005.7: readiness follows the arrangements as they change
-- ---------------------------------------------------------------------------
update public.venue_bookings set status = 'confirmed', reviewed_by = '05000000-0000-0000-0000-000000000002', reviewed_at = now()
  where id = '05500000-0000-0000-0000-000000000012';
update public.event_equipment_requirements set status = 'reserved' where id = '05400000-0000-0000-0000-000000000012';
update public.events set programme = 'Dinner and awards' where id = '05300000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05300000-0000-0000-0000-000000000001') as us5_e1_after \gset
reset role;
select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e1_after', 'venue_booking') @> '{"complete": true, "detail": "2 venue bookings approved."}'
  and pg_temp.us5_line(:'us5_e1_after', 'equipment_reservation') @> '{"complete": true, "detail": "2 of 2 essential items reserved."}'
  and pg_temp.us5_line(:'us5_e1_after', 'programme') @> '{"complete": true}'
  and pg_temp.us5_line(:'us5_e1_after', 'technical_support') @> '{"complete": false}',
  'AC-005.6.1: each line follows its arrangement: approving, reserving or writing the programme completes it, and the rest stay as they are');

update public.event_equipment_requirements set status = 'reserved' where id = '05400000-0000-0000-0000-000000000013';
update public.venue_bookings set status = 'cancelled' where id = '05500000-0000-0000-0000-000000000011';
update public.venue_bookings set status = 'cancelled' where id = '05500000-0000-0000-0000-000000000012';
set local role authenticated;
select pg_temp.us5_lines('05000000-0000-0000-0000-000000000002', '05300000-0000-0000-0000-000000000001') as us5_e1_later \gset
reset role;
select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e1_later', 'technical_support') @> '{"complete": true}'
  and pg_temp.us5_line(:'us5_e1_later', 'venue_booking') @> '{"complete": false, "detail": "No venue booked yet."}',
  'AC-005.7.1: a change in either direction shows at once: a finished review completes its line, and cancelled bookings make the venue outstanding again');

-- ---------------------------------------------------------------------------
-- AC-005.8: arrangements that do not apply are left out
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us5_line(:'us5_e1', 'registration_setup') is null
  and pg_temp.us5_line(:'us5_e2', 'equipment_reservation') is null
  and pg_temp.us5_line(:'us5_e2', 'technical_support') is null
  and jsonb_array_length(:'us5_e2'::jsonb) = 3,
  'AC-005.8.1: an event with no equipment or no registration does not show those as outstanding');

rollback;
