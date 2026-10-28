-- Migration: 0101_event_audit_log.sql
-- US34 (SCRUM-231): audit trail of significant actions. Disposable PostgreSQL only; run through the
-- database runner, which applies 0101 just before this file. Fixtures run in a transaction that is
-- rolled back. Auth is simulated through request.jwt.claim.sub.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('34000000-0000-0000-0000-000000000001', 'organiser-us34@example.test'),
  ('34000000-0000-0000-0000-000000000002', 'coordinator-us34@example.test'),
  ('34000000-0000-0000-0000-000000000003', 'other-coordinator-us34@example.test'),
  ('34000000-0000-0000-0000-000000000004', 'lead-us34@example.test'),
  ('34000000-0000-0000-0000-000000000005', 'attendee-us34@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '34000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator'
  where id in ('34000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000003');
update public.profiles set role = 'coordinator_lead' where id = '34000000-0000-0000-0000-000000000004';

insert into public.venues (id, name, location, capacity, layout, status) values
  ('34100000-0000-0000-0000-000000000001', 'US34 Hall', 'Level 1', 200, 'theatre', 'active');
insert into public.equipment_types (id, name, category) values
  ('34200000-0000-0000-0000-000000000001', 'US34 Projector', 'Visual');

-- E1 starts as a draft and is submitted; E2 is under review, approved; E3 under review, rejected;
-- E4 is planning (assigned, edited, booked, confirmed); E5 is planning, cancelled; E6 is a draft that is only edited.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference)
values
  ('34300000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', null, 'US34 Draft', 'Fixture',
   '2040-03-01 09:00+08', '2040-03-01 11:00+08', 20, 'draft', 'EVT-US34-1'),
  ('34300000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000002', 'US34 Approve', 'Fixture',
   '2040-03-02 09:00+08', '2040-03-02 11:00+08', 20, 'under_review', 'EVT-US34-2'),
  ('34300000-0000-0000-0000-000000000003', '34000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000002', 'US34 Reject', 'Fixture',
   '2040-03-03 09:00+08', '2040-03-03 11:00+08', 20, 'under_review', 'EVT-US34-3'),
  ('34300000-0000-0000-0000-000000000004', '34000000-0000-0000-0000-000000000001', null, 'US34 Planning', 'Fixture',
   '2040-03-04 09:00+08', '2040-03-04 11:00+08', 50, 'planning', 'EVT-US34-4'),
  ('34300000-0000-0000-0000-000000000005', '34000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000002', 'US34 Cancel', 'Fixture',
   '2040-03-05 09:00+08', '2040-03-05 11:00+08', 20, 'planning', 'EVT-US34-5'),
  ('34300000-0000-0000-0000-000000000006', '34000000-0000-0000-0000-000000000001', null, 'US34 Edit draft', 'Fixture',
   '2040-03-06 09:00+08', '2040-03-06 11:00+08', 20, 'draft', 'EVT-US34-6');

-- Fixture inserts are not significant actions: nothing is logged until an event changes.
select pg_temp.assert_true((select count(*) = 0 from public.event_audit_log),
  'AC-034.1.1: creating events records nothing');

-- Submission by the Organiser.
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
update public.events set status = 'submitted', submitted_at = now() where id = '34300000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000001' and action = 'submitted'
     and actor_id = '34000000-0000-0000-0000-000000000001' and item_type = 'event'
     and old_values = '{"status":"draft"}' and new_values = '{"status":"submitted"}'),
  'AC-034.1.2: submitting a request records the Organiser, the action, the event and old and new status');

-- Approval and rejection by the assigned Coordinator.
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000002', true);
update public.events set status = 'approved', review_note = 'Looks good' where id = '34300000-0000-0000-0000-000000000002';
update public.events set status = 'rejected', review_note = 'Not suitable' where id = '34300000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000002' and action = 'approved'
     and actor_id = '34000000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000003' and action = 'rejected'
     and actor_id = '34000000-0000-0000-0000-000000000002'),
  'AC-034.1.3: approving and rejecting a request each record the deciding Coordinator');

-- Assignment by the Lead.
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000004', true);
update public.events set coordinator_id = '34000000-0000-0000-0000-000000000002' where id = '34300000-0000-0000-0000-000000000004';
update public.events set coordinator_id = '34000000-0000-0000-0000-000000000003' where id = '34300000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000004' and action = 'coordinator_assigned'
     and actor_id = '34000000-0000-0000-0000-000000000004')
  and (select count(*) = 1 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000004' and action = 'coordinator_assigned'
     and old_values ->> 'coordinator_id' = '34000000-0000-0000-0000-000000000002'
     and new_values ->> 'coordinator_id' = '34000000-0000-0000-0000-000000000003'),
  'AC-034.1.4: assignment and reassignment record the Lead and the old and new Coordinator');

-- Significant information changes keep old and new values; only changed fields appear.
update public.events set expected_attendance = 80, layout_preference = 'cabaret' where id = '34300000-0000-0000-0000-000000000004';
update public.events set proposed_start = '2040-03-04 10:00+08', proposed_end = '2040-03-04 12:00+08'
  where id = '34300000-0000-0000-0000-000000000004';
update public.events set name = 'US34 Renamed' where id = '34300000-0000-0000-0000-000000000004';
select pg_temp.assert_true(
  (select old_values = '{"expected_attendance":50,"layout_preference":null}'::jsonb
      and new_values = '{"expected_attendance":80,"layout_preference":"cabaret"}'::jsonb
   from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000004' and action = 'details_changed'),
  'AC-034.1.5: a significant change records only the changed fields with old and new values');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(old_values ? 'proposed_start' and new_values ? 'proposed_end')
   from public.event_audit_log where event_id = '34300000-0000-0000-0000-000000000004' and action = 'rescheduled'),
  'AC-034.1.6: changing the dates records one rescheduling with old and new times');
select pg_temp.assert_true(
  (select count(*) = 4 from public.event_audit_log where event_id = '34300000-0000-0000-0000-000000000004'),
  'AC-034.1.7: a change to the name, which is not a listed significant field, records nothing');

-- Draft edits are not significant actions.
update public.events set expected_attendance = 99, proposed_start = '2040-03-06 08:00+08' where id = '34300000-0000-0000-0000-000000000006';
select pg_temp.assert_true(
  (select count(*) = 0 from public.event_audit_log where event_id = '34300000-0000-0000-0000-000000000006'),
  'AC-034.1.8: editing a draft records nothing');

-- Venue booking decisions; a hold expiring is housekeeping.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('34500000-0000-0000-0000-000000000001', '34300000-0000-0000-0000-000000000004', '34100000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('34500000-0000-0000-0000-000000000002', '34300000-0000-0000-0000-000000000005', '34100000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000002', 'held', now() - interval '1 hour');
update public.venue_bookings set status = 'confirmed', reviewed_by = '34000000-0000-0000-0000-000000000002', reviewed_at = now(), review_note = 'OK'
  where id = '34500000-0000-0000-0000-000000000001';
update public.venue_bookings set status = 'expired' where id = '34500000-0000-0000-0000-000000000002';
select pg_temp.assert_true(
  (select count(*) = 1 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000004' and action = 'venue_booking_decided'
     and item_id = '34500000-0000-0000-0000-000000000001'
     and new_values ->> 'status' = 'confirmed' and new_values ->> 'review_note' = 'OK')
  and (select count(*) = 1 from public.event_audit_log where action = 'venue_booking_decided'),
  'AC-034.1.9: a venue booking decision is recorded with its status and note, an expiring hold is not');

-- Equipment reservation changes.
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to) values
  ('34600000-0000-0000-0000-000000000001', '34300000-0000-0000-0000-000000000004', '34000000-0000-0000-0000-000000000002', '34100000-0000-0000-0000-000000000001', '2040-03-04', '2040-03-04');
insert into public.equipment_booking_lines (id, booking_id, type_id, quantity_requested) values
  ('34700000-0000-0000-0000-000000000001', '34600000-0000-0000-0000-000000000001', '34200000-0000-0000-0000-000000000001', 2);
update public.equipment_booking_lines set quantity_reserved = 2, status = 'fulfilled' where id = '34700000-0000-0000-0000-000000000001';
update public.equipment_booking_lines set assessment_note = 'Noted' where id = '34700000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select count(*) = 2 from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000004' and action = 'equipment_reservation_changed'
     and item_id = '34700000-0000-0000-0000-000000000001')
  and (select old_values = '{"status":"pending","quantity_reserved":0}'::jsonb
         and new_values ->> 'quantity_reserved' = '2'
      from public.event_audit_log
      where action = 'equipment_reservation_changed' and old_values is not null),
  'AC-034.1.10: creating a line and reserving units are recorded, an unrelated note edit is not');

-- Confirmation and cancellation.
update public.events set status = 'confirmed' where id = '34300000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000002', true);
update public.events set status = 'cancelled' where id = '34300000-0000-0000-0000-000000000005';
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.event_audit_log where event_id = '34300000-0000-0000-0000-000000000004' and action = 'confirmed')
  and (select count(*) = 1 from public.event_audit_log
       where event_id = '34300000-0000-0000-0000-000000000005' and action = 'cancelled'
         and actor_id = '34000000-0000-0000-0000-000000000002'),
  'AC-034.1.11: confirming and cancelling an event are recorded');

-- A change made without a signed-in user is recorded with no actor, never an invented one.
select pg_temp.assert_true(
  (select actor_id is null from public.event_audit_log
   where event_id = '34300000-0000-0000-0000-000000000004' and action = 'confirmed'),
  'AC-034.1.12: a change with no signed-in user records no actor');

-- ---------------------------------------------------------------------------
-- AC-034.2: nobody can edit or delete a record
-- ---------------------------------------------------------------------------
create function pg_temp.us34_refused(statement text) returns text language plpgsql as $$
begin
  execute statement;
  return 'allowed';
exception when others then
  return sqlstate;
end $$;
select pg_temp.assert_true(
  pg_temp.us34_refused('update public.event_audit_log set action = ''approved''') = '42501'
  and pg_temp.us34_refused('delete from public.event_audit_log') = '42501'
  and pg_temp.us34_refused('truncate public.event_audit_log') = '42501',
  'AC-034.2.1: even the table owner cannot update, delete or truncate a record');
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.event_audit_log', 'insert')
  and not has_table_privilege('authenticated', 'public.event_audit_log', 'update')
  and not has_table_privilege('authenticated', 'public.event_audit_log', 'delete')
  and not has_table_privilege('anon', 'public.event_audit_log', 'select'),
  'AC-034.2.2: signed-in users have no write grant and anonymous callers cannot read');

-- ---------------------------------------------------------------------------
-- AC-034.3 / AC-034.4: who can read
-- ---------------------------------------------------------------------------
create function pg_temp.us34_read(actor uuid, event uuid) returns jsonb language plpgsql as $$
declare answer jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at, r.id), '[]'::jsonb) into answer
  from public.get_event_audit_log(event) r;
  return answer;
exception when others then
  return to_jsonb(sqlstate);
end $$;

set local role authenticated;
select pg_temp.us34_read('34000000-0000-0000-0000-000000000003', '34300000-0000-0000-0000-000000000004') as us34_assigned \gset
select pg_temp.us34_read('34000000-0000-0000-0000-000000000004', '34300000-0000-0000-0000-000000000004') as us34_lead \gset
select pg_temp.assert_true(
  jsonb_array_length(:'us34_assigned'::jsonb) = 8 and :'us34_assigned'::jsonb = :'us34_lead'::jsonb,
  'AC-034.3.1: the assigned Coordinator and the Lead see all of an event''s records');
select pg_temp.assert_true(
  (select bool_and(t >= previous_t or previous_t is null) from (
     select (x ->> 'occurred_at')::timestamptz t,
            lag((x ->> 'occurred_at')::timestamptz) over (order by ord) previous_t
     from jsonb_array_elements(:'us34_lead'::jsonb) with ordinality as e(x, ord)) q),
  'AC-034.3.2: records come back in time order');
select pg_temp.assert_true(
  (select count(*) = 2 from jsonb_array_elements(:'us34_lead'::jsonb) x where x ->> 'actor_name' is not null),
  'AC-034.3.3: a record shows the actor''s name where there is an actor');

select pg_temp.assert_true(
  pg_temp.us34_read('34000000-0000-0000-0000-000000000003', '34300000-0000-0000-0000-000000000005') = '"42501"'::jsonb
  and pg_temp.us34_read('34000000-0000-0000-0000-000000000002', '34300000-0000-0000-0000-000000000004') = '"42501"'::jsonb,
  'AC-034.3.4: a Coordinator who is not assigned to the event is refused, not shown an empty list');

select pg_temp.assert_true(
  pg_temp.us34_read('34000000-0000-0000-0000-000000000001', '34300000-0000-0000-0000-000000000004') = '"42501"'::jsonb
  and pg_temp.us34_read('34000000-0000-0000-0000-000000000005', '34300000-0000-0000-0000-000000000004') = '"42501"'::jsonb,
  'AC-034.4.1: the Organiser and an Attendee are refused');
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true((select count(*) = 0 from public.event_audit_log),
  'AC-034.4.2: the Organiser reads no rows directly from the table either');
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) = 8 from public.event_audit_log where event_id = '34300000-0000-0000-0000-000000000004')
  and (select count(*) = 0 from public.event_audit_log where event_id = '34300000-0000-0000-0000-000000000005'),
  'AC-034.4.3: table reads follow the same rule as the function, one assigned event and no other');

reset role;
select set_config('request.jwt.claim.sub', '', true);
rollback;
