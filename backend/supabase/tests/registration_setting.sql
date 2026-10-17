-- US52 (SCRUM-245): the assigned Coordinator turns attendee registration on or off. Disposable
-- PostgreSQL only; run through the database test runner, after withdraw_registration.sql.
-- Fixtures are this file's own (ids start 52), so no earlier story's state is assumed.
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT)
-- ---------------------------------------------------------------------------
-- Users: 01-02 A1-A2 attendees; 03-04 O1-O2 organisers; 05 C1 coordinator (assigned);
-- 06 C2 coordinator (not assigned); 07 L1 coordinator lead; 08 M1 operations manager.
insert into auth.users (id, email, raw_user_meta_data) values
  ('53000000-0000-0000-0000-000000000001', 'a1-us52@example.test', '{"full_name":"Ann One"}'),
  ('53000000-0000-0000-0000-000000000002', 'a2-us52@example.test', '{"full_name":"Ben Two"}'),
  ('53000000-0000-0000-0000-000000000003', 'o1-us52@example.test', '{"full_name":"Olive Org"}'),
  ('53000000-0000-0000-0000-000000000004', 'o2-us52@example.test', '{"full_name":"Omar Org"}'),
  ('53000000-0000-0000-0000-000000000005', 'c1-us52@example.test', '{"full_name":"Cory Coord"}'),
  ('53000000-0000-0000-0000-000000000006', 'c2-us52@example.test', '{"full_name":"Cleo Coord"}'),
  ('53000000-0000-0000-0000-000000000007', 'l1-us52@example.test', '{"full_name":"Lena Lead"}'),
  ('53000000-0000-0000-0000-000000000008', 'm1-us52@example.test', '{"full_name":"Mia Manager"}');
-- New accounts are Attendees since US29; every other role is assigned by an administrator.
update public.profiles set role = 'organiser' where id in
  ('53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000004');
update public.profiles set role = 'coordinator' where id in
  ('53000000-0000-0000-0000-000000000005', '53000000-0000-0000-0000-000000000006');
update public.profiles set role = 'coordinator_lead' where id = '53000000-0000-0000-0000-000000000007';
update public.profiles set role = 'operations_manager' where id = '53000000-0000-0000-0000-000000000008';

-- Events (all start in 2035). registration_required is what the Organiser's request asked for.
-- 01 E-ON confirmed, asked for registration     02 E-OFF confirmed, did not ask
-- 03 E-APPROVED approved, asked                 04 E-PLANNING planning, asked
-- 05 E-UNASSIGNED confirmed, asked, no coordinator
-- 06 E-CANCELLED cancelled, asked               07 E-COMPLETED completed, asked
-- 08 E-TOGGLE confirmed, asked; the Coordinator switches this one off and on (AC-052.1, .4)
-- 09 E-OTHER confirmed, asked, O2's event, assigned to C1
insert into public.events (id, organiser_id, coordinator_id, name, purpose, event_type, proposed_start,
  proposed_end, expected_attendance, registration_required, status)
values
  ('53100000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 On Workshop', 'Workshop', 'Workshop', '2035-03-10 01:00+00', '2035-03-10 09:00+00', 80, true, 'confirmed'),
  ('53100000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 Off Seminar', 'Seminar', 'Seminar', '2035-03-11 01:00+00', '2035-03-11 09:00+00', 80, false, 'confirmed'),
  ('53100000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 Approved Forum', 'Forum', 'Forum', '2035-03-12 01:00+00', '2035-03-12 09:00+00', 80, true, 'approved'),
  ('53100000-0000-0000-0000-000000000004', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 Planning Fair', 'Fair', 'Fair', '2035-03-13 01:00+00', '2035-03-13 09:00+00', 80, true, 'planning'),
  ('53100000-0000-0000-0000-000000000005', '53000000-0000-0000-0000-000000000003', null,
   'US52 Unassigned Talk', 'Talk', 'Talk', '2035-03-14 01:00+00', '2035-03-14 09:00+00', 80, true, 'confirmed'),
  ('53100000-0000-0000-0000-000000000006', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 Cancelled Gala', 'Gala', 'Gala', '2035-03-15 01:00+00', '2035-03-15 09:00+00', 80, true, 'cancelled'),
  ('53100000-0000-0000-0000-000000000007', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 Completed Summit', 'Summit', 'Summit', '2035-03-16 01:00+00', '2035-03-16 09:00+00', 80, true, 'completed'),
  ('53100000-0000-0000-0000-000000000008', '53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000005',
   'US52 Toggle Meetup', 'Meetup', 'Meetup', '2035-03-17 01:00+00', '2035-03-17 09:00+00', 80, true, 'confirmed'),
  ('53100000-0000-0000-0000-000000000009', '53000000-0000-0000-0000-000000000004', '53000000-0000-0000-0000-000000000005',
   'US52 Other Organiser Expo', 'Expo', 'Expo', '2035-03-18 01:00+00', '2035-03-18 09:00+00', 80, true, 'confirmed');

-- ---------------------------------------------------------------------------
-- AC-052.2: registration starts as the Organiser's request asked (existing behaviour)
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000001'),
  'AC-052.2.1: an event whose request asked for registration starts with registration enabled');

select pg_temp.assert_true(
  not (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000002'),
  'AC-052.2.2: an event whose request did not ask for registration starts with it disabled');

-- A request that never mentions registration takes the column default.
insert into public.events (id, organiser_id, name, purpose, event_type, proposed_start, proposed_end,
  expected_attendance, status)
values ('53100000-0000-0000-0000-000000000010', '53000000-0000-0000-0000-000000000003',
  'US52 Silent Request', 'Talk', 'Talk', '2035-04-01 01:00+00', '2035-04-01 03:00+00', 20, 'draft');
select pg_temp.assert_true(
  not (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000010'),
  'AC-052.2.3: an event whose request is silent on registration starts with it disabled');

-- ---------------------------------------------------------------------------
-- AC-052.1: the assigned Coordinator enables or disables registration
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select public.set_event_registration('53100000-0000-0000-0000-000000000008', false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  not (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000008'),
  'AC-052.1.1: the assigned Coordinator disables registration for their Confirmed event');

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select public.set_event_registration('53100000-0000-0000-0000-000000000008', true);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000008'),
  'AC-052.1.2: and enables it again');

-- Enabling an event that never asked for registration is the other direction of the same switch.
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select public.set_event_registration('53100000-0000-0000-0000-000000000002', true);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000002'),
  'AC-052.1.3: the Coordinator can enable registration the Organiser did not ask for');

-- Put E-OFF back so the AC-052.3 checks below read the state the fixture describes.
update public.events set registration_required = false where id = '53100000-0000-0000-0000-000000000002';

-- Refusals. Each leaves the stored value exactly as it was.
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000006', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', false)$q$,
  '42501', 'AC-052.1.4: a Coordinator who is not assigned to the event is refused');
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000007', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', false)$q$,
  '42501', 'AC-052.1.5: a Coordinator Lead is refused');
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000008', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', false)$q$,
  '42501', 'AC-052.1.5: an Operations Manager is refused');
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000003', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', false)$q$,
  '42501', 'AC-052.1.5: the Organiser who owns the event is refused');
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', false)$q$,
  '42501', 'AC-052.1.5: an Attendee is refused');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', false)$q$,
  '42501', 'AC-052.1.5: a visitor who is not signed in is refused');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000005', false)$q$,
  '42501', 'AC-052.1.6: an event with no assigned Coordinator cannot be switched by anyone');
select pg_temp.expect_error(
  $q$select public.set_event_registration('53999999-0000-0000-0000-000000000000', false)$q$,
  '42501', 'AC-052.1.6: an event that does not exist is refused the same way, so ids are not probed');
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000008', null)$q$,
  '22023', 'AC-052.1.7: a missing on/off value is refused rather than treated as off');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000008')
  and (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000005'),
  'AC-052.1.8: none of the refused attempts changed a stored value');

-- Only a Confirmed event can be switched (the Coordinator's decision, 17 Oct 2026).
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000003', false)$q$,
  '22000', 'AC-052.1.9: an Approved event cannot be switched yet');
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000004', false)$q$,
  '22000', 'AC-052.1.9: nor one still in Planning');
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000006', true)$q$,
  '22000', 'AC-052.1.9: nor a Cancelled one');
select pg_temp.expect_error(
  $q$select public.set_event_registration('53100000-0000-0000-0000-000000000007', false)$q$,
  '22000', 'AC-052.1.9: nor a Completed one');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 4 and bool_and(registration_required) from public.events
    where id in ('53100000-0000-0000-0000-000000000003', '53100000-0000-0000-0000-000000000004',
                 '53100000-0000-0000-0000-000000000006', '53100000-0000-0000-0000-000000000007')),
  'AC-052.1.9: and none of those events changed');

-- The switch is the RPC, not an UPDATE the browser can send (0008 blocks direct detail edits).
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select pg_temp.expect_error(
  $q$update public.events set registration_required = false where id = '53100000-0000-0000-0000-000000000008'$q$,
  '42501', 'AC-052.1.10: the Coordinator cannot change the flag with a direct table update');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- AC-052.3: Attendees can only register for Confirmed events with registration enabled
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000001', false);
select public.register_for_event('53100000-0000-0000-0000-000000000001', '91234567', null, null, false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 1 from public.event_registrations
    where event_id = '53100000-0000-0000-0000-000000000001'
      and attendee_id = '53000000-0000-0000-0000-000000000001' and status = 'registered'),
  'AC-052.3.1: an Attendee registers for a Confirmed event with registration enabled');

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('53100000-0000-0000-0000-000000000002', '91234567', null, null, false)$q$,
  '22000', 'AC-052.3.2: a Confirmed event with registration disabled refuses registration');
select pg_temp.expect_error(
  $q$select public.register_for_event('53100000-0000-0000-0000-000000000003', '91234567', null, null, false)$q$,
  '22000', 'AC-052.3.3: an Approved event refuses registration even though it is enabled');
select pg_temp.expect_error(
  $q$select public.register_for_event('53100000-0000-0000-0000-000000000004', '91234567', null, null, false)$q$,
  '22000', 'AC-052.3.3: so does one still in Planning');
select pg_temp.assert_true(
  (select count(*) filter (where id = '53100000-0000-0000-0000-000000000001') = 1
      and count(*) filter (where id = '53100000-0000-0000-0000-000000000002') = 0
      and count(*) filter (where id in ('53100000-0000-0000-0000-000000000003',
                                        '53100000-0000-0000-0000-000000000004')) = 0
     from public.list_open_events()),
  'AC-052.3.4: the open-events list shows only Confirmed events with registration enabled');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- AC-052.4: disabling stops new registrations and keeps the existing ones
-- ---------------------------------------------------------------------------
-- A1 registers for E-TOGGLE while it is on; A2 stays unregistered.
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000001', false);
select public.register_for_event('53100000-0000-0000-0000-000000000008', '91234567', 'Vegan', null, false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

create temp table us52_before as
  select id, attendee_id, phone, dietary_requirements, status, registered_at
    from public.event_registrations where event_id = '53100000-0000-0000-0000-000000000008';

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select public.set_event_registration('53100000-0000-0000-0000-000000000008', false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000002', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('53100000-0000-0000-0000-000000000008', '92234567', null, null, false)$q$,
  '22000', 'AC-052.4.1: after the Coordinator disables registration a new Attendee is refused');
select pg_temp.assert_true(
  not exists (select 1 from public.list_open_events() where id = '53100000-0000-0000-0000-000000000008'),
  'AC-052.4.2: and the event leaves the open-events list');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  not exists ((select * from us52_before except
                 select id, attendee_id, phone, dietary_requirements, status, registered_at
                   from public.event_registrations where event_id = '53100000-0000-0000-0000-000000000008')
              union all
              (select id, attendee_id, phone, dietary_requirements, status, registered_at
                 from public.event_registrations where event_id = '53100000-0000-0000-0000-000000000008'
               except select * from us52_before))
  and (select count(*) = 1 from us52_before),
  'AC-052.4.3: the registration made before disabling is kept, unchanged');

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000001', false);
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(registration_status = 'registered')
     from public.list_my_registrations() where event_id = '53100000-0000-0000-0000-000000000008'),
  'AC-052.4.4: the registered Attendee still sees it under My registrations');
reset role;
select set_config('request.jwt.claim.sub', '', false);

set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select public.set_event_registration('53100000-0000-0000-0000-000000000008', true);
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000002', false);
select public.register_for_event('53100000-0000-0000-0000-000000000008', '92234567', null, null, false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 2 from public.event_registrations
    where event_id = '53100000-0000-0000-0000-000000000008' and status = 'registered'),
  'AC-052.4.5: enabling registration again lets new Attendees register, beside the kept one');

-- ---------------------------------------------------------------------------
-- AC-052.5: the Organiser sees whether registration is enabled for their event
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000005', false);
select public.set_event_registration('53100000-0000-0000-0000-000000000008', false);
select set_config('request.jwt.claim.sub', '53000000-0000-0000-0000-000000000003', false);
select pg_temp.assert_true(
  (select not registration_required from public.events where id = '53100000-0000-0000-0000-000000000008')
  and (select registration_required from public.events where id = '53100000-0000-0000-0000-000000000001'),
  'AC-052.5.1: the Organiser reads the current setting on their own events, after the Coordinator changed it');
select pg_temp.assert_true(
  not exists (select 1 from public.events where id = '53100000-0000-0000-0000-000000000009'),
  'AC-052.5.2: and cannot read another Organiser''s event');
reset role;
select set_config('request.jwt.claim.sub', '', false);
