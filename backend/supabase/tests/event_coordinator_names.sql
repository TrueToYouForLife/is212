-- US17 AC4 follow-up: the Requests list names the assigned Coordinator (0061). Disposable PostgreSQL
-- only; run through the database test runner, after waitlist_expiry_job.sql, whose pg_temp.act and
-- pg_temp.owner helpers it reuses. Fixtures are this file's own (ids start 21).
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Users: 01 C1 coordinator (assigned to E1 and E3)  02 C2 coordinator  03 L1 coordinator lead
-- 04 M1 operations manager  05 O1 organiser (owns E1, E2)  06 O2 organiser (owns E3)
-- 07 A1 attendee  08 V1 venue staff  09 T1 tech support
insert into auth.users (id, email, raw_user_meta_data) values
  ('21000000-0000-0000-0000-000000000001', 'c1-us17n@example.test', '{"full_name":"Cory Coord"}'),
  ('21000000-0000-0000-0000-000000000002', 'c2-us17n@example.test', '{"full_name":"Cleo Coord"}'),
  ('21000000-0000-0000-0000-000000000003', 'l1-us17n@example.test', '{"full_name":"Lena Lead"}'),
  ('21000000-0000-0000-0000-000000000004', 'm1-us17n@example.test', '{"full_name":"Mia Manager"}'),
  ('21000000-0000-0000-0000-000000000005', 'o1-us17n@example.test', '{"full_name":"Olive Org"}'),
  ('21000000-0000-0000-0000-000000000006', 'o2-us17n@example.test', '{"full_name":"Omar Org"}'),
  ('21000000-0000-0000-0000-000000000007', 'a1-us17n@example.test', '{"full_name":"Ann One"}'),
  ('21000000-0000-0000-0000-000000000008', 'v1-us17n@example.test', '{"full_name":"Vic Venue"}'),
  ('21000000-0000-0000-0000-000000000009', 't1-us17n@example.test', '{"full_name":"Tess Tech"}');
update public.profiles set role = 'coordinator'
 where id in ('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002');
update public.profiles set role = 'coordinator_lead' where id = '21000000-0000-0000-0000-000000000003';
update public.profiles set role = 'operations_manager' where id = '21000000-0000-0000-0000-000000000004';
update public.profiles set role = 'organiser'
 where id in ('21000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000006');
update public.profiles set role = 'venue_staff' where id = '21000000-0000-0000-0000-000000000008';
update public.profiles set role = 'tech_support' where id = '21000000-0000-0000-0000-000000000009';

insert into public.events (id, organiser_id, coordinator_id, name, purpose, event_type, proposed_start,
  proposed_end, expected_attendance, status)
values
  ('21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000001',
   'US17 Named Workshop', 'Workshop', 'Workshop', '2035-06-10 01:00+00', '2035-06-10 09:00+00', 20, 'confirmed'),
  ('21100000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000005', null,
   'US17 Unassigned Talk', 'Talk', 'Talk', '2035-06-11 01:00+00', '2035-06-11 09:00+00', 20, 'submitted'),
  ('21100000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000006', '21000000-0000-0000-0000-000000000001',
   'US17 Other Organiser Fair', 'Fair', 'Fair', '2035-06-12 01:00+00', '2035-06-12 09:00+00', 20, 'confirmed');

-- ---------------------------------------------------------------------------
-- AC-017.4: who is told the assigned Coordinator's name
-- ---------------------------------------------------------------------------
select pg_temp.act('21000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(coordinator_name = 'Cory Coord')
     from public.event_coordinator_names(array[
       '21100000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000002',
       '21100000-0000-0000-0000-000000000003']::uuid[])),
  'AC-017.4.7: a Coordinator who is not the assigned one still sees the assigned Coordinator''s name');
select pg_temp.act('21000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  (select count(*) = 2 from public.event_coordinator_names(array[
     '21100000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000003']::uuid[])),
  'AC-017.4.7: so does a Coordinator Lead');
select pg_temp.act('21000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  (select count(*) = 2 from public.event_coordinator_names(array[
     '21100000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000003']::uuid[])),
  'AC-017.4.7: and an Operations Manager');
select pg_temp.owner();

select pg_temp.act('21000000-0000-0000-0000-000000000005');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(event_id = '21100000-0000-0000-0000-000000000001' and coordinator_name = 'Cory Coord')
     from public.event_coordinator_names(array[
       '21100000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000003']::uuid[])),
  'AC-017.4.8: an Organiser is told the name for their own event, and not for another Organiser''s');
select pg_temp.owner();

select pg_temp.act('21000000-0000-0000-0000-000000000007');
select pg_temp.assert_true(
  (select count(*) = 0 from public.event_coordinator_names(array[
     '21100000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000003']::uuid[])),
  'AC-017.4.9: an Attendee is told nothing');
select pg_temp.act('21000000-0000-0000-0000-000000000008');
select pg_temp.assert_true(
  (select count(*) = 0 from public.event_coordinator_names(array[
     '21100000-0000-0000-0000-000000000001']::uuid[])),
  'AC-017.4.9: nor is Venue Staff');
select pg_temp.act('21000000-0000-0000-0000-000000000009');
select pg_temp.assert_true(
  (select count(*) = 0 from public.event_coordinator_names(array[
     '21100000-0000-0000-0000-000000000001']::uuid[])),
  'AC-017.4.9: nor Technical Support');
select pg_temp.owner();

reset role;
set role anon;
select pg_temp.expect_error(
  $q$select * from public.event_coordinator_names(array['21100000-0000-0000-0000-000000000001']::uuid[])$q$,
  '42501', 'AC-017.4.10: a visitor who is not signed in is refused');
reset role;

select pg_temp.act('21000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
  (select count(*) = 0 from public.event_coordinator_names(array[
     '21100000-0000-0000-0000-000000000002', '21199999-0000-0000-0000-000000000000']::uuid[])),
  'AC-017.4.11: an event with no Coordinator, and an id that does not exist, give no name');
select pg_temp.assert_true(
  (select count(*) = 0 from public.event_coordinator_names(
     (select array_agg('21100000-0000-0000-0000-000000000001'::uuid) from generate_series(1, 501)))),
  'AC-017.4.12: a list of more than 500 events is refused, so one call cannot scan the table');
select pg_temp.assert_true(
  (select count(*) = 1 from public.event_coordinator_names(
     (select array_agg('21100000-0000-0000-0000-000000000001'::uuid) from generate_series(1, 500)))),
  'AC-017.4.12: and exactly 500 is still allowed');
select pg_temp.owner();
