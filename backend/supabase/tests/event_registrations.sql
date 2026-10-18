-- US15 (SCRUM-22): register for a confirmed event. Disposable PostgreSQL only; run through the
-- database test runner. Not wrapped in a transaction: AC-015.5.4 races two real sessions
-- (dblink), which can only see committed fixtures. Acting as a user is session-level
-- (set role / set_config(..., false)) for the same reason.
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT)
-- ---------------------------------------------------------------------------
-- Users: 01 A1, 02 A2, 03 A3 (attendees); 04 O1 organiser; 05 C1 coordinator;
-- 06 M1 operations manager; 07 V1 venue staff; 08 T1 tech support.
insert into auth.users (id, email, raw_user_meta_data) values
  ('15000000-0000-0000-0000-000000000001', 'a1-us15@example.test', '{"full_name":"Ann One"}'),
  ('15000000-0000-0000-0000-000000000002', 'a2-us15@example.test', '{"full_name":"Ben Two"}'),
  ('15000000-0000-0000-0000-000000000003', 'a3-us15@example.test', '{"full_name":"Cal Three"}'),
  ('15000000-0000-0000-0000-000000000004', 'o1-us15@example.test', '{"full_name":"Olive Org"}'),
  ('15000000-0000-0000-0000-000000000005', 'c1-us15@example.test', '{"full_name":"Cory Coord"}'),
  ('15000000-0000-0000-0000-000000000006', 'm1-us15@example.test', '{"full_name":"Mia Manager"}'),
  ('15000000-0000-0000-0000-000000000007', 'v1-us15@example.test', '{"full_name":"Vic Venue"}'),
  ('15000000-0000-0000-0000-000000000008', 't1-us15@example.test', '{"full_name":"Tess Tech"}');
-- New accounts are Attendees since US29; every other role is assigned by an administrator.
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '15000000-0000-0000-0000-000000000004';
update public.profiles set role = 'coordinator' where id = '15000000-0000-0000-0000-000000000005';
update public.profiles set role = 'operations_manager' where id = '15000000-0000-0000-0000-000000000006';
update public.profiles set role = 'venue_staff' where id = '15000000-0000-0000-0000-000000000007';
update public.profiles set role = 'tech_support' where id = '15000000-0000-0000-0000-000000000008';

insert into public.venues (id, name, location, capacity, layout, status) values
  ('15200000-0000-0000-0000-000000000001', 'US15 Main Hall', 'Level 1', 200, 'Theatre', 'active'),
  ('15200000-0000-0000-0000-000000000002', 'US15 Side Room', 'Level 2', 40, 'Classroom', 'active');

-- Events: 01 E-OPEN, 02 E-OPEN2, 03 E-CLOSED, 04 E-PAST, 11-18 E-STATUS (one per other status).
insert into public.events (id, organiser_id, name, purpose, event_type, description, programme,
  proposed_start, proposed_end, expected_attendance, registration_required, status,
  special_arrangements)
values
  ('15100000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000004',
   'US15 Open Workshop', 'Internal budget line 42', 'Workshop', 'Hands-on data workshop',
   '09:00 Welcome; 10:00 Labs', '2035-03-10 01:00+00', '2035-03-10 09:00+00', 80, true,
   'confirmed', 'VIP parking'),
  ('15100000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000004',
   'US15 Early Talk', 'Outreach', 'Talk', 'An early talk', null,
   '2035-02-01 02:00+00', '2035-02-01 04:00+00', 30, true, 'confirmed', null),
  ('15100000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000004',
   'US15 Closed Gala', 'Gala', 'Gala', 'Invitation only', null,
   '2035-04-01 10:00+00', '2035-04-01 14:00+00', 100, false, 'confirmed', null),
  ('15100000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000004',
   'US15 Started Meetup', 'Meetup', 'Meetup', 'Already under way', null,
   now() - interval '1 minute', now() + interval '1 hour', 20, true, 'confirmed', null);

insert into public.events (id, organiser_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, registration_required, status)
select ('15100000-0000-0000-0000-0000000000' || (10 + position)::text)::uuid,
       '15000000-0000-0000-0000-000000000004', 'US15 ' || status || ' event', 'Status fixture',
       '2035-05-01 01:00+00', '2035-05-01 03:00+00', 10, true, status
from unnest(array['draft', 'submitted', 'under_review', 'approved', 'planning',
                  'completed', 'cancelled', 'rejected'])
  with ordinality as statuses(status, position);

-- A separate statement, so the events above exist even before 0043 adds the column.
update public.events set registration_prerequisites = 'Bring a laptop'
where id = '15100000-0000-0000-0000-000000000001';

-- E-OPEN has a confirmed booking (its venue); E-OPEN2 only a held one (no venue yet).
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('15300000-0000-0000-0000-000000000001', '15100000-0000-0000-0000-000000000001',
   '15200000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000005', 'confirmed', null),
  ('15300000-0000-0000-0000-000000000002', '15100000-0000-0000-0000-000000000002',
   '15200000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000005', 'held',
   now() + interval '1 day');

-- ---------------------------------------------------------------------------
-- AC-015.1: view details of a confirmed event, including prerequisites
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);

select pg_temp.assert_true(
  (select count(*) = 1
      and bool_and(name = 'US15 Open Workshop' and event_type = 'Workshop'
                   and description = 'Hands-on data workshop'
                   and programme = '09:00 Welcome; 10:00 Labs'
                   and proposed_start = '2035-03-10 01:00+00' and proposed_end = '2035-03-10 09:00+00'
                   and prerequisites = 'Bring a laptop' and venue = 'US15 Main Hall (Level 1)'
                   and registered = false)
     from public.get_open_event('15100000-0000-0000-0000-000000000001')),
  'AC-015.1.1: an open event''s public details are returned');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc p, unnest(p.proargnames) as arg(name)
    where p.oid = 'public.get_open_event(uuid)'::regprocedure
      and arg.name in ('purpose', 'expected_attendance', 'reference', 'organiser_id',
                       'layout_preference', 'equipment_requirements',
                       'accessibility_requirements', 'facility_requirements',
                       'special_arrangements', 'status')),
  'AC-015.1.2: details contain no internal fields');

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);

select pg_temp.assert_true(
  (select venue is null from public.get_open_event('15100000-0000-0000-0000-000000000002')),
  'AC-015.1.3: only confirmed venue bookings count as the venue');

select pg_temp.assert_true(
  not exists (select 1 from public.get_open_event('15100000-0000-0000-0000-000000000003'))
  and not exists (select 1 from public.get_open_event('15100000-0000-0000-0000-000000000014'))
  and not exists (select 1 from public.get_open_event('15100000-0000-0000-0000-000000000011')),
  'AC-015.1.4: events that are not open reveal nothing');

select pg_temp.assert_true(
  not exists (select 1 from public.events where id::text like '15100000-%')
  and not exists (select 1 from public.venue_bookings where id::text like '15300000-%'),
  'AC-015.1.5: an Attendee cannot read events or venue bookings directly');

-- ---------------------------------------------------------------------------
-- AC-015.2: input the information required to register
-- ---------------------------------------------------------------------------
select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null,
  'Wheelchair access', true);

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 1
      and bool_and(attendee_id = '15000000-0000-0000-0000-000000000001' and status = 'registered'
                   and phone = '91234567' and dietary_requirements is null
                   and accessibility_needs = 'Wheelchair access' and prerequisites_confirmed
                   and registered_at is not null)
     from public.event_registrations
    where event_id = '15100000-0000-0000-0000-000000000001'),
  'AC-015.2.12: a valid registration is stored for the caller');

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', false);

select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000002', '   ', null, null, false)$q$,
  '22023', 'AC-015.2.13: the database refuses a blank phone');

select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000002', '12345', null, null, false)$q$,
  '22023', 'AC-015.2.14: the database refuses a phone that is not 8 to 15 digits');

select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, false)$q$,
  '22023', 'AC-015.2.15: the prerequisites confirmation is required when the event has prerequisites');

-- E-OPEN2 has no prerequisites, so the same answers are accepted there.
select public.register_for_event('15100000-0000-0000-0000-000000000002', '+65 8123 4567',
  'Vegetarian', null, false);

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 1 from public.event_registrations
    where attendee_id = '15000000-0000-0000-0000-000000000002'
      and event_id = '15100000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.event_registrations
    where attendee_id = '15000000-0000-0000-0000-000000000002'
      and event_id = '15100000-0000-0000-0000-000000000001'),
  'AC-015.2.15: and is not required when the event has none');

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);

select pg_temp.expect_error(
  $q$insert into public.event_registrations (event_id, attendee_id, phone)
     values ('15100000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', '91234567')$q$,
  '42501', 'AC-015.2.16: registrations cannot be inserted directly');

do $$
declare
  changed integer;
begin
  begin
    update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
     where attendee_id = '15000000-0000-0000-0000-000000000001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'FAIL: AC-015.2.16: an attendee updated a registration directly'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.event_registrations where attendee_id = '15000000-0000-0000-0000-000000000001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'FAIL: AC-015.2.16: an attendee deleted a registration directly'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(status = 'registered') from public.event_registrations
    where attendee_id = '15000000-0000-0000-0000-000000000001'),
  'AC-015.2.16: registrations cannot be updated or deleted directly');

select pg_temp.assert_true(
  exists (select 1 from pg_proc
           where proname = 'register_for_event' and pronamespace = 'public'::regnamespace)
  and not exists (
    select 1
    from pg_proc p, unnest(p.proargnames) as arg(name)
    where p.proname = 'register_for_event' and p.pronamespace = 'public'::regnamespace
      and (arg.name like '%attendee%' or arg.name like '%user%' or arg.name like '%status%')),
  'AC-015.2.17: the attendee is always the caller; no parameter names another user');

-- Every other role is refused, including the event's own organiser.
set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000004', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '42501', 'AC-015.2.18: other roles cannot register (organiser)');
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000005', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '42501', 'AC-015.2.18: other roles cannot register (coordinator)');
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000006', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '42501', 'AC-015.2.18: other roles cannot register (operations manager)');
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000007', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '42501', 'AC-015.2.18: other roles cannot register (venue staff)');
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000008', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '42501', 'AC-015.2.18: other roles cannot register (tech support)');

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- AC-015.3: an email confirmation is queued on successful registration
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select count(*) = 1
      and bool_and(status = 'pending' and recipient_email = 'a1-us15@example.test'
                   and subject like '%US15 Open Workshop%'
                   and body like '%US15 Open Workshop%'
                   and body like '%10 Mar 2035, 09:00%'
                   and body like '%US15 Main Hall (Level 1)%')
     from public.notification_outbox
    where event_id = '15100000-0000-0000-0000-000000000001'),
  'AC-015.3.1: a successful registration queues one confirmation email to the attendee');

create temp table us15_outbox_count as select count(*) as n from public.notification_outbox;

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);
do $$
begin
  begin
    perform public.register_for_event('15100000-0000-0000-0000-000000000003', '91234567', null, null, true);
  exception when others then null;
  end;
  begin
    perform public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true);
  exception when others then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- The duplicate attempt only means something if A1's first registration exists.
select pg_temp.assert_true(
  exists (select 1 from public.event_registrations
           where attendee_id = '15000000-0000-0000-0000-000000000001'
             and event_id = '15100000-0000-0000-0000-000000000001')
  and (select count(*) from public.notification_outbox) = (select n from us15_outbox_count),
  'AC-015.3.2: a refused registration (closed event, duplicate) queues nothing');

select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(body like '%Venue to be confirmed%')
     from public.notification_outbox
    where event_id = '15100000-0000-0000-0000-000000000002'
      and recipient_email = 'a2-us15@example.test'),
  'AC-015.3.3: with no confirmed venue, the email says the venue is to be confirmed');

-- Make queueing fail for A2 only, then try a registration that would otherwise succeed.
alter table public.notification_outbox add constraint us15_reject_a2
  check (recipient_email is distinct from 'a2-us15@example.test') not valid;

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', false);
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '23514', 'AC-015.3.4: if the email cannot be queued, the registration is refused');
reset role;
select set_config('request.jwt.claim.sub', '', false);

alter table public.notification_outbox drop constraint us15_reject_a2;

select pg_temp.assert_true(
  not exists (select 1 from public.event_registrations
               where attendee_id = '15000000-0000-0000-0000-000000000002'
                 and event_id = '15100000-0000-0000-0000-000000000001'),
  'AC-015.3.4: and nothing is kept: the registration rolls back with the email');

-- The outbox is service-role only (0009): browsers have no grant on it, so reading it is
-- refused outright rather than returning no rows.
set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error($q$select count(*) from public.notification_outbox$q$, '42501',
  'AC-015.3.5: attendees cannot read the email queue');

-- ---------------------------------------------------------------------------
-- AC-015.4: registration only where it is enabled
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000003', '91234567', null, null, true)$q$,
  '22000', 'AC-015.4.1: a confirmed event with registration disabled refuses registration');

do $$
declare
  event_id uuid;
begin
  for event_id in
    select ('15100000-0000-0000-0000-0000000000' || n::text)::uuid from generate_series(11, 18) n
  loop
    begin
      perform public.register_for_event(event_id, '91234567', null, null, true);
      raise exception 'FAIL: AC-015.4.2: registration accepted for event %', event_id;
    exception when sqlstate '22000' then null;
    end;
  end loop;
  raise notice 'PASS: AC-015.4.2: every status other than confirmed refuses registration';
end $$;

select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000004', '91234567', null, null, true)$q$,
  '22000', 'AC-015.4.3: an event that has already started refuses registration');

select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-0000000000ff', '91234567', null, null, true)$q$,
  '22000', 'AC-015.4.4: an event that does not exist refuses registration');

-- ---------------------------------------------------------------------------
-- AC-015.5: no double registration
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '91234567', null, null, true)$q$,
  '23505', 'AC-015.5.1: a second registration by the same attendee is refused');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 1 from public.event_registrations
    where attendee_id = '15000000-0000-0000-0000-000000000001'
      and event_id = '15100000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.notification_outbox
        where event_id = '15100000-0000-0000-0000-000000000001'
          and recipient_email = 'a1-us15@example.test'),
  'AC-015.5.1: still one registration and one email');

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);
select public.register_for_event('15100000-0000-0000-0000-000000000002', '91234567', null, null, false);
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', false);
select public.register_for_event('15100000-0000-0000-0000-000000000001', '81234567', null, null, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 2 from public.event_registrations
    where (attendee_id, event_id) in (
      ('15000000-0000-0000-0000-000000000001'::uuid, '15100000-0000-0000-0000-000000000002'::uuid),
      ('15000000-0000-0000-0000-000000000002'::uuid, '15100000-0000-0000-0000-000000000001'::uuid))),
  'AC-015.5.2: another event, or another attendee, can still register');

-- US23 will withdraw through its own function; an administrator stands in for it here.
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
where attendee_id = '15000000-0000-0000-0000-000000000001'
  and event_id = '15100000-0000-0000-0000-000000000002';

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);
select public.register_for_event('15100000-0000-0000-0000-000000000002', '91234567', null, null, false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) filter (where status = 'registered') = 1
      and count(*) filter (where status = 'withdrawn') = 1
     from public.event_registrations
    where attendee_id = '15000000-0000-0000-0000-000000000001'
      and event_id = '15100000-0000-0000-0000-000000000002'),
  'AC-015.5.3: a withdrawn registration does not block a new one');

-- Two real sessions register A3 at once (pg_temp.us14_race is US14's helper, defined earlier
-- in this run by equipment_reservations.sql). The race runs as its own statement: a statement
-- cannot see writes made by functions it calls, so counting in the same statement reads 0.
create temp table us15_race as
select * from pg_temp.us14_race(
  '15000000-0000-0000-0000-000000000003',
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '71234567', null, null, true)::text$q$,
  '15000000-0000-0000-0000-000000000003',
  $q$select public.register_for_event('15100000-0000-0000-0000-000000000001', '71234567', null, null, true)::text$q$);

select pg_temp.assert_true(
  (select (first_error is null) <> (second_error is null) from us15_race)
  and (select count(*) = 1 from public.event_registrations
        where attendee_id = '15000000-0000-0000-0000-000000000003'),
  'AC-015.5.4: two simultaneous registrations create only one');

-- ---------------------------------------------------------------------------
-- AC-015.6: the list of events open for registration
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);

select pg_temp.assert_true(
  (select array_agg(id order by id) from public.list_open_events())
    = array['15100000-0000-0000-0000-000000000001'::uuid, '15100000-0000-0000-0000-000000000002'::uuid],
  'AC-015.6.1: only open events are listed');

select pg_temp.assert_true(
  (select array_agg(id) from public.list_open_events())
    = array['15100000-0000-0000-0000-000000000002'::uuid, '15100000-0000-0000-0000-000000000001'::uuid],
  'AC-015.6.2: soonest first');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc p, unnest(p.proargnames) as arg(name)
    where p.oid = 'public.list_open_events()'::regprocedure
      and arg.name in ('purpose', 'expected_attendance', 'reference', 'organiser_id',
                       'layout_preference', 'equipment_requirements',
                       'accessibility_requirements', 'facility_requirements',
                       'special_arrangements', 'status')),
  'AC-015.6.3: each row has only public fields');

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);

select pg_temp.assert_true(
  (select venue = 'US15 Main Hall (Level 1)' from public.list_open_events()
    where id = '15100000-0000-0000-0000-000000000001')
  and (select venue is null from public.list_open_events()
        where id = '15100000-0000-0000-0000-000000000002'),
  'AC-015.6.3: and its venue from confirmed bookings');

-- A1 and A2 are registered for both events by now; A3 registered only for E-OPEN (AC-015.5.4).
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000003', false);
select pg_temp.assert_true(
  (select registered from public.list_open_events() where id = '15100000-0000-0000-0000-000000000001')
  and not (select registered from public.list_open_events() where id = '15100000-0000-0000-0000-000000000002'),
  'AC-015.6.4: the list shows whether the caller is registered');

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error($q$select * from public.list_open_events()$q$, '42501',
  'AC-015.6.5: visitors who are not signed in cannot list open events');
select pg_temp.expect_error(
  $q$select * from public.get_open_event('15100000-0000-0000-0000-000000000001')$q$, '42501',
  'AC-015.6.5: or read an open event''s details');
reset role;

-- ---------------------------------------------------------------------------
-- AC-015.7: the attendee's own registrations
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);

select pg_temp.assert_true(
  (select count(*) = 3
      and bool_and(event_name is not null and proposed_start is not null
                   and event_status = 'confirmed'
                   and registration_status in ('registered', 'withdrawn'))
      and bool_or(venue = 'US15 Main Hall (Level 1)')
     from public.list_my_registrations())
  and not exists (
    select 1 from public.list_my_registrations() mine
    join public.event_registrations r on r.id = mine.registration_id
    where r.attendee_id <> '15000000-0000-0000-0000-000000000001'),
  'AC-015.7.1: only the caller''s registrations are listed, with the required details');

select pg_temp.assert_true(
  (select count(*) = 3 and bool_and(attendee_id = '15000000-0000-0000-0000-000000000001')
     from public.event_registrations),
  'AC-015.7.2: another attendee''s registrations are invisible');

reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.events set status = 'cancelled' where id = '15100000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);
select pg_temp.assert_true(
  (select event_status = 'cancelled' from public.list_my_registrations()
    where event_id = '15100000-0000-0000-0000-000000000001'),
  'AC-015.7.3: the current event status follows the event');

select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000004', false);
select pg_temp.assert_true(
  not exists (select 1 from public.list_my_registrations()),
  'AC-015.7.4: a non-attendee has no registrations');

reset role;
select set_config('request.jwt.claim.sub', '', false);
