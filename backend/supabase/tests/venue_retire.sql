-- US46 Add and edit venue details (SCRUM-241), slice 3 (0070). Disposable PostgreSQL only;
-- run through the database runner. Fixtures run inside a transaction that is rolled back.
-- Auth is simulated; RLS is real. Each action runs in its own statement before it is
-- asserted: a statement cannot see the writes made by functions it calls.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('46f00000-0000-0000-0000-000000000001', 'venue-staff-0070@example.test'),
  ('46f00000-0000-0000-0000-000000000002', 'coordinator-0070@example.test'),
  ('46f00000-0000-0000-0000-000000000003', 'organiser-0070@example.test'),
  ('46f00000-0000-0000-0000-000000000004', 'operations-0070@example.test');
update public.profiles set role = 'venue_staff' where id = '46f00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '46f00000-0000-0000-0000-000000000002';
update public.profiles set role = 'organiser' where id = '46f00000-0000-0000-0000-000000000003';
update public.profiles set role = 'operations_manager' where id = '46f00000-0000-0000-0000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.sub', '46f00000-0000-0000-0000-000000000001', true);
select public.add_venue('0070 Old Hall', 'Annex', '07:00', '24:00', '{}', '{}',
  '[{"layout":"theatre","capacity":100}]') as us46r_venue \gset
select public.add_venue('0070 New Hall', 'Main', '07:00', '24:00', '{}', '{}',
  '[{"layout":"theatre","capacity":100}]') as us46r_other \gset
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- R1 Coordinator's event, confirmed booking. R2 unassigned event, request awaiting Venue
-- Staff. R3 past event. R4 cancelled booking. R5 lapsed hold. R6 the Coordinator's event with
-- no booking yet, used to try new holds.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, layout_preference, status)
values
  ('46f10000-0000-0000-0000-000000000001', '46f00000-0000-0000-0000-000000000003', '46f00000-0000-0000-0000-000000000002',
   '0070 Booked event', 'Fixture', '2039-06-05 09:00+08', '2039-06-05 11:00+08', 50, 'theatre', 'planning'),
  ('46f10000-0000-0000-0000-000000000002', '46f00000-0000-0000-0000-000000000003', null,
   '0070 Unassigned event', 'Fixture', '2039-06-06 09:00+08', '2039-06-06 11:00+08', 50, 'theatre', 'approved'),
  ('46f10000-0000-0000-0000-000000000003', '46f00000-0000-0000-0000-000000000003', '46f00000-0000-0000-0000-000000000002',
   '0070 Past event', 'Fixture', '2020-06-05 09:00+08', '2020-06-05 11:00+08', 50, 'theatre', 'completed'),
  ('46f10000-0000-0000-0000-000000000004', '46f00000-0000-0000-0000-000000000003', '46f00000-0000-0000-0000-000000000002',
   '0070 Cancelled booking event', 'Fixture', '2039-06-08 09:00+08', '2039-06-08 11:00+08', 50, 'theatre', 'planning'),
  ('46f10000-0000-0000-0000-000000000005', '46f00000-0000-0000-0000-000000000003', '46f00000-0000-0000-0000-000000000002',
   '0070 Lapsed hold event', 'Fixture', '2039-06-09 09:00+08', '2039-06-09 11:00+08', 50, 'theatre', 'planning'),
  ('46f10000-0000-0000-0000-000000000006', '46f00000-0000-0000-0000-000000000003', '46f00000-0000-0000-0000-000000000002',
   '0070 Unbooked event', 'Fixture', '2039-06-10 09:00+08', '2039-06-10 11:00+08', 50, 'theatre', 'approved');

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('46f20000-0000-0000-0000-000000000001', '46f10000-0000-0000-0000-000000000001', :'us46r_venue', '46f00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('46f20000-0000-0000-0000-000000000002', '46f10000-0000-0000-0000-000000000002', :'us46r_venue', '46f00000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('46f20000-0000-0000-0000-000000000003', '46f10000-0000-0000-0000-000000000003', :'us46r_venue', '46f00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('46f20000-0000-0000-0000-000000000004', '46f10000-0000-0000-0000-000000000004', :'us46r_venue', '46f00000-0000-0000-0000-000000000002', 'cancelled', null),
  ('46f20000-0000-0000-0000-000000000005', '46f10000-0000-0000-0000-000000000005', :'us46r_venue', '46f00000-0000-0000-0000-000000000002', 'held', now() - interval '1 hour');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id) values
  (:'us46r_venue', '2039-06-05', 'AM', 'event', '46f20000-0000-0000-0000-000000000001');

create temp table us46r_bookings_before on commit drop as
  select id, status, hold_expires_at from public.venue_bookings where venue_id = :'us46r_venue';
create temp table us46r_claims_before on commit drop as
  select venue_id, slot_date, slot, kind, booking_id from public.venue_slot_claims where venue_id = :'us46r_venue';

create function pg_temp.us46r_as(actor uuid, statement text)
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

-- Retires the venue as the given person, from the venue as it is now unless a version is given.
create function pg_temp.us46r_retire(venue uuid, note text,
  actor uuid default '46f00000-0000-0000-0000-000000000001', version text default null)
returns text language sql as $$
  select pg_temp.us46r_as(actor, format('select public.retire_venue(%L, %L, %L)',
    venue, coalesce(version, public.venue_edit_version(venue)), note));
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.6: only Venue Staff retire venues
-- ---------------------------------------------------------------------------
select pg_temp.us46r_retire(:'us46r_venue', 'Closing', actor => '46f00000-0000-0000-0000-000000000002') as us46r_by_coordinator \gset
select pg_temp.us46r_retire(:'us46r_venue', 'Closing', actor => '46f00000-0000-0000-0000-000000000004') as us46r_by_operations \gset
reset role;
select pg_temp.assert_true(
  :'us46r_by_coordinator' = '42501' and :'us46r_by_operations' = '42501'
  and (select status = 'active' from public.venues where id = :'us46r_venue'),
  'AC-046.6.20: only Venue Staff can retire a venue');

-- ---------------------------------------------------------------------------
-- AC-046.5: Venue Staff can retire a venue; its bookings are flagged, never cancelled
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us46r_retire(:'us46r_venue', '   ') as us46r_no_note \gset
select pg_temp.us46r_retire(:'us46r_venue', 'Closing', version => 'out-of-date') as us46r_stale \gset
select pg_temp.us46r_retire('46f9ffff-0000-0000-0000-000000000000', 'Closing', version => 'any') as us46r_unknown \gset
reset role;
select pg_temp.assert_true(
  :'us46r_no_note' = '22023' and :'us46r_stale' = '40001' and :'us46r_unknown' = 'P0002'
  and (select status = 'active' and retirement_note is null from public.venues where id = :'us46r_venue')
  and not exists (select 1 from public.arrangement_review_flags where reason_code = 'venue_retired'
                  and venue_booking_id = '46f20000-0000-0000-0000-000000000001'),
  'AC-046.5.1: retiring needs a reason and an up-to-date copy of the venue; a refused retirement changes nothing');

set local role authenticated;
select pg_temp.us46r_retire(:'us46r_venue', '  Building closes for redevelopment  ') as us46r_retired \gset
reset role;
select pg_temp.assert_true(
  :'us46r_retired' = '2'
  and (select status = 'retired' and retirement_note = 'Building closes for redevelopment'
       from public.venues where id = :'us46r_venue'),
  'AC-046.5.2: Venue Staff retire a venue with a reason, and are told how many bookings were sent for review');

select pg_temp.assert_true(
  (select detail = '0070 Old Hall has been retired by Venue Staff (Building closes for redevelopment). Find another venue for this event; the booking is unchanged.'
   from public.arrangement_review_flags
   where venue_booking_id = '46f20000-0000-0000-0000-000000000001' and reason_code = 'venue_retired')
  and exists (select 1 from public.arrangement_review_notifications n join public.arrangement_review_flags f on f.id = n.flag_id
              where f.venue_booking_id = '46f20000-0000-0000-0000-000000000001'
                and n.recipient_id = '46f00000-0000-0000-0000-000000000002'),
  'AC-046.5.3: a confirmed booking at the retired venue is flagged with the reason, and its Coordinator notified');

select pg_temp.assert_true(
  exists (select 1 from public.arrangement_review_flags
          where venue_booking_id = '46f20000-0000-0000-0000-000000000002' and reason_code = 'venue_retired')
  and not exists (select 1 from public.arrangement_review_notifications n join public.arrangement_review_flags f on f.id = n.flag_id
                  where f.venue_booking_id = '46f20000-0000-0000-0000-000000000002'),
  'AC-046.5.4: a request awaiting Venue Staff for an event with no Coordinator is flagged, with no one yet to notify');

select pg_temp.assert_true(
  not exists (select 1 from public.arrangement_review_flags
              where reason_code = 'venue_retired'
                and venue_booking_id in ('46f20000-0000-0000-0000-000000000003',
                                         '46f20000-0000-0000-0000-000000000004',
                                         '46f20000-0000-0000-0000-000000000005')),
  'AC-046.5.5: bookings for past events, cancelled bookings and lapsed holds are not flagged');

select pg_temp.assert_true(
  not exists ((select id, status, hold_expires_at from public.venue_bookings where venue_id = :'us46r_venue')
              except select * from us46r_bookings_before)
  and not exists (select * from us46r_claims_before
                  except select venue_id, slot_date, slot, kind, booking_id from public.venue_slot_claims where venue_id = :'us46r_venue'),
  'AC-046.5.6: retiring cancels nothing: every booking keeps its status, hold and reserved slots');

select pg_temp.assert_true(
  exists (select 1 from public.venue_changes
          where venue_id = :'us46r_venue' and action = 'updated'
            and changed_by = '46f00000-0000-0000-0000-000000000001'
            and details -> 'status' = '{"from": "active", "to": "retired"}'::jsonb
            and details -> 'retirement_note' ->> 'to' = 'Building closes for redevelopment'),
  'AC-046.5.7: the retirement is recorded with who did it, when and why');

set local role authenticated;
select pg_temp.us46r_retire(:'us46r_venue', 'Again') as us46r_again \gset
select pg_temp.us46r_as('46f00000-0000-0000-0000-000000000001',
  format('select public.get_venue_for_edit(%L)::text', :'us46r_venue')) as us46r_loaded \gset
reset role;
select pg_temp.assert_true(
  :'us46r_again' = '22023'
  and (:'us46r_loaded')::jsonb ->> 'status' = 'retired'
  and (:'us46r_loaded')::jsonb ->> 'retirementNote' = 'Building closes for redevelopment',
  'AC-046.5.8: a retired venue cannot be retired again, and opens showing that it is retired and why');

set local role authenticated;
select pg_temp.us46r_as('46f00000-0000-0000-0000-000000000002', format(
  $sql$insert into public.venue_bookings (event_id, venue_id, requested_by, status, hold_expires_at)
       values ('46f10000-0000-0000-0000-000000000006', %L, '46f00000-0000-0000-0000-000000000002', 'held', now() + interval '3 days')$sql$,
  :'us46r_venue')) as us46r_hold_retired \gset
select pg_temp.us46r_as('46f00000-0000-0000-0000-000000000002', format(
  $sql$insert into public.venue_bookings (event_id, venue_id, requested_by, status, hold_expires_at)
       values ('46f10000-0000-0000-0000-000000000006', %L, '46f00000-0000-0000-0000-000000000002', 'held', now() + interval '3 days')$sql$,
  :'us46r_other')) as us46r_hold_active \gset
reset role;
select pg_temp.assert_true(
  :'us46r_hold_retired' = '42501' and :'us46r_hold_active' = 'rows:1',
  'AC-046.5.9: a retired venue cannot be held for a new event; an active one still can');

select pg_temp.assert_true(
  (select count(*) = 0 from public.venues v
   where v.id = :'us46r_venue' and v.status = 'active'),
  'AC-046.5.10: a retired venue is no longer active, so venue search (active venues only) no longer offers it');

rollback;
