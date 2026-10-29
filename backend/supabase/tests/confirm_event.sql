-- US26 Confirm an event (SCRUM-71), 0117. Disposable PostgreSQL only; run through the database
-- runner, which applies 0117 just before this file. Fixtures run inside a transaction that is
-- rolled back. AC-026.3 (the venue's time stays taken) is in confirm_event_booking.sql, run by
-- run_venue_time_conversion.sh with the current booking model.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('26a00000-0000-0000-0000-000000000001', 'organiser-26a@example.test'), ('26a00000-0000-0000-0000-000000000002', 'coordinator-26a@example.test'),
  ('26a00000-0000-0000-0000-000000000003', 'other-coordinator-26a@example.test'), ('26a00000-0000-0000-0000-000000000004', 'venue-26a@example.test'), ('26a00000-0000-0000-0000-000000000005', 'tech-26a@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '26a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('26a00000-0000-0000-0000-000000000002', '26a00000-0000-0000-0000-000000000003');
update public.profiles set role = 'venue_staff' where id = '26a00000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '26a00000-0000-0000-0000-000000000005';

insert into public.venues (id, name, location, capacity, layout, status) values ('26a10000-0000-0000-0000-000000000001', 'US26 Hall', 'Level 1', 200, 'theatre', 'active');
insert into public.equipment_types (id, name, category) values ('26a20000-0000-0000-0000-000000000001', 'US26 Projector', 'Visual');

-- E1 ready. E2 ready, taking registrations. E3 venue awaiting Venue Staff. E4 no programme.
-- E5 essential equipment unavailable. E6 no venue booked. E7 ready (used with the safety review
-- on). E8 in preparation and ready. E9 in preparation with one approved and one rejected venue.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, registration_required) values
  ('26a30000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 1', 'Fixture', '2044-01-10 09:00+08', '2044-01-10 11:00+08', 40, 'planning', 'EVT-26A-1', 'Talks', false),
  ('26a30000-0000-0000-0000-000000000002', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 2', 'Fixture', '2044-02-10 09:00+08', '2044-02-10 11:00+08', 40, 'planning', 'EVT-26A-2', 'Talks', true),
  ('26a30000-0000-0000-0000-000000000003', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 3', 'Fixture', '2044-03-10 09:00+08', '2044-03-10 11:00+08', 40, 'planning', 'EVT-26A-3', 'Talks', false),
  ('26a30000-0000-0000-0000-000000000004', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 4', 'Fixture', '2044-04-10 09:00+08', '2044-04-10 11:00+08', 40, 'planning', 'EVT-26A-4', null, false),
  ('26a30000-0000-0000-0000-000000000005', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 5', 'Fixture', '2044-05-10 09:00+08', '2044-05-10 11:00+08', 40, 'planning', 'EVT-26A-5', 'Talks', false),
  ('26a30000-0000-0000-0000-000000000006', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 6', 'Fixture', '2044-06-10 09:00+08', '2044-06-10 11:00+08', 40, 'planning', 'EVT-26A-6', 'Talks', false),
  ('26a30000-0000-0000-0000-000000000007', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 7', 'Fixture', '2044-07-10 09:00+08', '2044-07-10 11:00+08', 40, 'planning', 'EVT-26A-7', 'Talks', false),
  ('26a30000-0000-0000-0000-000000000008', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 8', 'Fixture', '2044-08-10 09:00+08', '2044-08-10 11:00+08', 40, 'in_preparation', 'EVT-26A-8', 'Talks', false),
  ('26a30000-0000-0000-0000-000000000009', '26a00000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'US26 Event 9', 'Fixture', '2044-09-10 09:00+08', '2044-09-10 11:00+08', 40, 'in_preparation', 'EVT-26A-9', 'Talks', false);
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at, review_note) values
  ('26a50000-0000-0000-0000-000000000001', '26a30000-0000-0000-0000-000000000001', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000002', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000003', '26a30000-0000-0000-0000-000000000003', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days', null),
  ('26a50000-0000-0000-0000-000000000004', '26a30000-0000-0000-0000-000000000004', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000005', '26a30000-0000-0000-0000-000000000005', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000007', '26a30000-0000-0000-0000-000000000007', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000008', '26a30000-0000-0000-0000-000000000008', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000009', '26a30000-0000-0000-0000-000000000009', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'confirmed', null, null),
  ('26a50000-0000-0000-0000-000000000010', '26a30000-0000-0000-0000-000000000009', '26a10000-0000-0000-0000-000000000001', '26a00000-0000-0000-0000-000000000002', 'rejected', null, 'Fixture rejection');
insert into public.event_equipment_requirements (id, event_id, type_id, quantity, essential, created_by)
  values ('26a40000-0000-0000-0000-000000000001', '26a30000-0000-0000-0000-000000000005', '26a20000-0000-0000-0000-000000000001', 1, true, '26a00000-0000-0000-0000-000000000002');
update public.event_equipment_requirements set status = 'unavailable' where id = '26a40000-0000-0000-0000-000000000001';

create function pg_temp.us26_status(event uuid) returns text language sql as $$ select status from public.events where id = event $$;

-- Makes one change as a given person: the status rules see them, RLS does not. 'ok' or the
-- SQLSTATE of the refusal.
create function pg_temp.us26_confirm(actor uuid, event uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  update public.events set status = 'confirmed' where id = event;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

-- ---------------------------------------------------------------------------
-- AC-026.1: confirmed only once every essential arrangement is complete
-- ---------------------------------------------------------------------------
select pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000003') as us26_e3, pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000004') as us26_e4,
       pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000005') as us26_e5, pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000006') as us26_e6 \gset
select pg_temp.assert_true(
  :'us26_e3' = '55000' and :'us26_e4' = '55000' and :'us26_e5' = '55000' and :'us26_e6' = '55000'
  and pg_temp.us26_status('26a30000-0000-0000-0000-000000000003') = 'planning' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000004') = 'planning'
  and pg_temp.us26_status('26a30000-0000-0000-0000-000000000005') = 'planning' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000006') = 'planning',
  'AC-026.1.1: an event is not confirmed while its venue awaits Venue Staff, its programme is missing, essential equipment is unavailable or no venue is booked');

select pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000001') as us26_e1, pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000002') as us26_e2 \gset
select pg_temp.assert_true(
  :'us26_e1' = 'ok' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000001') = 'confirmed'
  and :'us26_e2' = 'ok' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000002') = 'confirmed',
  'AC-026.1.2: once every essential arrangement is complete the Coordinator confirms it; registration setup does not hold it back');

select pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000001', '26a30000-0000-0000-0000-000000000007') as us26_organiser, pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000004', '26a30000-0000-0000-0000-000000000007') as us26_venue_staff \gset
select pg_temp.assert_true(
  :'us26_organiser' = '42501' and :'us26_venue_staff' = '42501' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000007') = 'planning',
  'AC-026.1.3: an Organiser or Venue Staff cannot confirm an event, even a ready one');

-- With the safety review switched on, an event is confirmed from In Preparation only.
update public.safety_review_settings set enabled = true;
select pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000007') as us26_planning_on, pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000008') as us26_e8,
       pg_temp.us26_confirm('26a00000-0000-0000-0000-000000000002', '26a30000-0000-0000-0000-000000000009') as us26_e9 \gset
select pg_temp.assert_true(
  :'us26_planning_on' = '22000' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000007') = 'planning'
  and :'us26_e8' = 'ok' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000008') = 'confirmed'
  and :'us26_e9' = '55000' and pg_temp.us26_status('26a30000-0000-0000-0000-000000000009') = 'in_preparation',
  'AC-026.1.4: with the safety review on, Planning cannot be confirmed; In Preparation can, once every essential arrangement is complete');
update public.safety_review_settings set enabled = false;

-- ---------------------------------------------------------------------------
-- AC-026.2: a confirmed event shows as Confirmed to the people involved
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '26a00000-0000-0000-0000-000000000001', true);
select status as us26_organiser_sees from public.events where id = '26a30000-0000-0000-0000-000000000001' \gset
select set_config('request.jwt.claim.sub', '26a00000-0000-0000-0000-000000000002', true);
select status as us26_coordinator_sees from public.events where id = '26a30000-0000-0000-0000-000000000001' \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us26_organiser_sees' = 'confirmed' and :'us26_coordinator_sees' = 'confirmed',
  'AC-026.2.1: the Organiser and the assigned Coordinator see the event as Confirmed');

rollback;
