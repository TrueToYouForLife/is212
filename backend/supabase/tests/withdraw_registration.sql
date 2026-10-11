-- US23 (SCRUM-68): an Attendee withdraws their own registration. Disposable PostgreSQL only; run
-- through the database test runner, after event_registrations.sql (it reuses pg_temp.us14_race).
-- Not wrapped in a transaction: AC-023.5.7 races two real sessions (dblink), which can only see
-- committed fixtures. Acting as a user is session-level (set role / set_config(..., false)).
-- Fixtures are this file's own (ids start 23), so no US15 state is assumed.
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT)
-- ---------------------------------------------------------------------------
-- Users: 01-04 A1-A4 (attendees); 05 O1 organiser; 06 C1 coordinator; 07 M1 operations manager;
-- 08 V1 venue staff; 09 T1 tech support.
insert into auth.users (id, email, raw_user_meta_data) values
  ('23000000-0000-0000-0000-000000000001', 'a1-us23@example.test', '{"full_name":"Ann One"}'),
  ('23000000-0000-0000-0000-000000000002', 'a2-us23@example.test', '{"full_name":"Ben Two"}'),
  ('23000000-0000-0000-0000-000000000003', 'a3-us23@example.test', '{"full_name":"Cal Three"}'),
  ('23000000-0000-0000-0000-000000000004', 'a4-us23@example.test', '{"full_name":"Dee Four"}'),
  ('23000000-0000-0000-0000-000000000005', 'o1-us23@example.test', '{"full_name":"Olive Org"}'),
  ('23000000-0000-0000-0000-000000000006', 'c1-us23@example.test', '{"full_name":"Cory Coord"}'),
  ('23000000-0000-0000-0000-000000000007', 'm1-us23@example.test', '{"full_name":"Mia Manager"}'),
  ('23000000-0000-0000-0000-000000000008', 'v1-us23@example.test', '{"full_name":"Vic Venue"}'),
  ('23000000-0000-0000-0000-000000000009', 't1-us23@example.test', '{"full_name":"Tess Tech"}');
-- New accounts are Attendees since US29; every other role is assigned by an administrator.
update public.profiles set role = 'organiser' where id = '23000000-0000-0000-0000-000000000005';
update public.profiles set role = 'coordinator' where id = '23000000-0000-0000-0000-000000000006';
update public.profiles set role = 'operations_manager' where id = '23000000-0000-0000-0000-000000000007';
update public.profiles set role = 'venue_staff' where id = '23000000-0000-0000-0000-000000000008';
update public.profiles set role = 'tech_support' where id = '23000000-0000-0000-0000-000000000009';

-- Events: 01 E-OPEN, 02 E-MOVED (rescheduled below), 03 E-STARTED, 04 E-CANCELLED, 05 E-COMPLETED.
-- All confirmed-or-later fixtures start in 2035 except E-STARTED, which began a minute ago.
insert into public.events (id, organiser_id, name, purpose, event_type, proposed_start, proposed_end,
  expected_attendance, registration_required, status)
values
  ('23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000005',
   'US23 Open Workshop', 'Workshop', 'Workshop', '2035-03-10 01:00+00', '2035-03-10 09:00+00', 80, true, 'confirmed'),
  ('23100000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000005',
   'US23 Moved Talk', 'Talk', 'Talk', '2035-03-20 01:00+00', '2035-03-20 03:00+00', 30, true, 'confirmed'),
  ('23100000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000005',
   'US23 Started Meetup', 'Meetup', 'Meetup', now() - interval '1 minute', now() + interval '1 hour', 20, true, 'confirmed'),
  ('23100000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000005',
   'US23 Cancelled Gala', 'Gala', 'Gala', '2035-04-01 10:00+00', '2035-04-01 14:00+00', 100, true, 'cancelled'),
  ('23100000-0000-0000-0000-000000000005', '23000000-0000-0000-0000-000000000005',
   'US23 Completed Summit', 'Summit', 'Summit', '2035-05-01 01:00+00', '2035-05-01 03:00+00', 100, true, 'completed');

-- Registrations are inserted directly, as the owner: register_for_event refuses events that
-- have started or are no longer open, and these fixtures need exactly those states.
-- R-A1..R-A4 are the four Attendees on E-OPEN; R-MOVED, R-STARTED, R-CANC, R-COMP are A1's.
insert into public.event_registrations (id, event_id, attendee_id, phone, dietary_requirements) values
  ('23400000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '91234567', 'Vegan'),
  ('23400000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000002', '92234567', null),
  ('23400000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000003', '93234567', null),
  ('23400000-0000-0000-0000-000000000004', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000004', '94234567', null),
  ('23400000-0000-0000-0000-000000000011', '23100000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000001', '91234567', null),
  ('23400000-0000-0000-0000-000000000012', '23100000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000001', '91234567', null),
  ('23400000-0000-0000-0000-000000000013', '23100000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000001', '91234567', null),
  ('23400000-0000-0000-0000-000000000014', '23100000-0000-0000-0000-000000000005', '23000000-0000-0000-0000-000000000001', '91234567', null);

-- E-MOVED is rescheduled after people registered: the rule reads the current start (D4).
update public.events set proposed_start = '2035-06-20 01:00+00', proposed_end = '2035-06-20 03:00+00'
where id = '23100000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- AC-023.1: withdraw own registration for an event that has not started
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);
select public.withdraw_registration('23400000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select status = 'withdrawn' and withdrawn_at is not null
     from public.event_registrations where id = '23400000-0000-0000-0000-000000000001'),
  'AC-023.1.1: an Attendee withdraws their own active registration for a future event');

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);
select public.withdraw_registration('23400000-0000-0000-0000-000000000011');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select status = 'withdrawn' from public.event_registrations where id = '23400000-0000-0000-0000-000000000011'),
  'AC-023.1.2: withdrawal is still allowed after the event was rescheduled to a later start');

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000012')$q$,
  '22000', 'AC-023.1.3: an event that started a minute ago cannot be withdrawn from');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select status = 'registered' and withdrawn_at is null
     from public.event_registrations where id = '23400000-0000-0000-0000-000000000012'),
  'AC-023.1.3: and the registration is left active');

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000013')$q$,
  '22000', 'AC-023.1.4: a cancelled event cannot be withdrawn from');
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000014')$q$,
  '22000', 'AC-023.1.4: nor a completed one');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(status = 'registered')
     from public.event_registrations
    where id in ('23400000-0000-0000-0000-000000000013', '23400000-0000-0000-0000-000000000014')),
  'AC-023.1.4: and both registrations are unchanged');

select pg_temp.assert_true(
  (select count(*) = 4 and count(*) filter (where status = 'registered') = 3
     from public.event_registrations where event_id = '23100000-0000-0000-0000-000000000001'),
  'AC-023.1.5: only the one registration changes; nothing is deleted');

-- ---------------------------------------------------------------------------
-- AC-023.2: confirmation email once the withdrawal succeeds
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select count(*) = 1
      and bool_and(status = 'pending' and recipient_email = 'a1-us23@example.test'
                   and subject like 'You have withdrawn from%US23 Open Workshop%'
                   and body like '%US23 Open Workshop%'
                   and body like '%10 Mar 2035, 09:00%')
     from public.notification_outbox
    where event_id = '23100000-0000-0000-0000-000000000001'
      and subject like 'You have withdrawn from%'),
  'AC-023.2.6: a successful withdrawal queues one confirmation email to the Attendee');

-- Refused attempts: the started, cancelled and completed events above, plus a stranger's id.
set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000002', false);
do $$
begin
  begin
    perform public.withdraw_registration('23400000-0000-0000-0000-000000000003');
  exception when others then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  -- Scoped to this file's events: US15's tests also withdraw a registration as administrator.
  (select count(*) = 2 from public.notification_outbox
    where subject like 'You have withdrawn from%' and event_id::text like '23100000-%')
  and not exists (select 1 from public.notification_outbox
                   where subject like 'You have withdrawn from%'
                     and event_id in ('23100000-0000-0000-0000-000000000003',
                                      '23100000-0000-0000-0000-000000000004',
                                      '23100000-0000-0000-0000-000000000005')),
  'AC-023.2.7: refused withdrawals queue nothing (only E-OPEN and E-MOVED have emails)');

-- Make queueing fail for A3 only, then withdraw something that would otherwise succeed.
alter table public.notification_outbox add constraint us23_reject_a3
  check (recipient_email is distinct from 'a3-us23@example.test' or subject not like 'You have withdrawn%')
  not valid;

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000003', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '23514', 'AC-023.2.8: if the email cannot be queued, the withdrawal is refused');
reset role;
select set_config('request.jwt.claim.sub', '', false);

alter table public.notification_outbox drop constraint us23_reject_a3;

select pg_temp.assert_true(
  (select status = 'registered' and withdrawn_at is null
     from public.event_registrations where id = '23400000-0000-0000-0000-000000000003'),
  'AC-023.2.8: and nothing is kept: the withdrawal rolls back with the email');

-- ---------------------------------------------------------------------------
-- AC-023.3: a withdrawn registration no longer counts and the place is available again
-- ---------------------------------------------------------------------------
-- Active registrations on E-OPEN now: A2, A3, A4.
create temp table us23_active_before as
select count(*) as n from public.event_registrations
where event_id = '23100000-0000-0000-0000-000000000001' and status = 'registered';

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000004', false);
select public.withdraw_registration('23400000-0000-0000-0000-000000000004');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select n = 3 from us23_active_before)
  and (select count(*) = 2 from public.event_registrations
        where event_id = '23100000-0000-0000-0000-000000000001' and status = 'registered'),
  'AC-023.3.1: the active registration count for the event drops by one');

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);
select public.register_for_event('23100000-0000-0000-0000-000000000001', '91234567', null, null, false);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) filter (where status = 'registered') = 1
      and count(*) filter (where status = 'withdrawn') = 1
     from public.event_registrations
    where attendee_id = '23000000-0000-0000-0000-000000000001'
      and event_id = '23100000-0000-0000-0000-000000000001'),
  'AC-023.3.2: the same person can register again: one withdrawn row and one active row');

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000004', false);
select pg_temp.assert_true(
  (select registered = false from public.list_open_events()
    where id = '23100000-0000-0000-0000-000000000001'),
  'AC-023.3.3: the open-events list shows the withdrawn Attendee as not registered');
reset role;
select set_config('request.jwt.claim.sub', '', false);

create temp table us23_active_after as
select count(*) as n from public.event_registrations
where event_id = '23100000-0000-0000-0000-000000000001' and status = 'registered';

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000004', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000004')$q$,
  '55000', 'AC-023.3.4: withdrawing a second time is refused');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select count(*) = (select n from us23_active_after) from public.event_registrations
    where event_id = '23100000-0000-0000-0000-000000000001' and status = 'registered'),
  'AC-023.3.4: and the active count does not drop twice');

-- ---------------------------------------------------------------------------
-- AC-023.4: the withdrawn registration stays on record for the Organiser's and Coordinator's list
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select status = 'withdrawn' and withdrawn_at is not null and withdrawn_at >= registered_at
      and attendee_id = '23000000-0000-0000-0000-000000000001'
      and event_id = '23100000-0000-0000-0000-000000000001'
      and phone = '91234567' and dietary_requirements = 'Vegan'
     from public.event_registrations where id = '23400000-0000-0000-0000-000000000001'),
  'AC-023.4.1: the withdrawn registration is retained with its answers and a withdrawal time');

select pg_temp.assert_true(
  (select status = 'confirmed' and proposed_start = '2035-03-10 01:00+00'
     from public.events where id = '23100000-0000-0000-0000-000000000001'),
  'AC-023.4.2: withdrawing does not change the event');

-- ---------------------------------------------------------------------------
-- AC-023.5: nobody else's registration, nothing already withdrawn
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000002', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  'P0002', 'AC-023.5.1: an Attendee cannot withdraw another Attendee''s registration');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select status = 'registered' and withdrawn_at is null
     from public.event_registrations where id = '23400000-0000-0000-0000-000000000003'),
  'AC-023.5.1: and that registration is left active');

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-0000000000ff')$q$,
  'P0002', 'AC-023.5.2: an unknown registration looks exactly like someone else''s');

create temp table us23_withdrawn_at as
select withdrawn_at from public.event_registrations where id = '23400000-0000-0000-0000-000000000001';
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000001')$q$,
  '55000', 'AC-023.5.3: a registration that is already withdrawn cannot be withdrawn again');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select r.withdrawn_at = w.withdrawn_at
     from public.event_registrations r, us23_withdrawn_at w
    where r.id = '23400000-0000-0000-0000-000000000001'),
  'AC-023.5.3: and its withdrawal time is unchanged');

-- Every other role is refused, before ownership is even looked at.
set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000005', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '42501', 'AC-023.5.4: other roles cannot withdraw (organiser)');
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000006', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '42501', 'AC-023.5.4: other roles cannot withdraw (coordinator)');
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000007', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '42501', 'AC-023.5.4: other roles cannot withdraw (operations manager)');
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000008', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '42501', 'AC-023.5.4: other roles cannot withdraw (venue staff)');
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000009', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '42501', 'AC-023.5.4: other roles cannot withdraw (tech support)');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error(
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')$q$,
  '42501', 'AC-023.5.5: a visitor who is not signed in cannot withdraw');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000003', false);
do $$
declare
  changed integer;
begin
  begin
    update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
     where id = '23400000-0000-0000-0000-000000000003';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'FAIL: AC-023.5.6: an attendee updated a registration directly'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.event_registrations where id = '23400000-0000-0000-0000-000000000003';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'FAIL: AC-023.5.6: an attendee deleted a registration directly'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
  (select status = 'registered' from public.event_registrations where id = '23400000-0000-0000-0000-000000000003'),
  'AC-023.5.6: registrations still cannot be updated or deleted directly');

-- Two real sessions withdraw A3's registration at once. The race runs as its own statement: a
-- statement cannot see writes made by functions it calls, so counting in the same one reads 0.
create temp table us23_race as
select * from pg_temp.us14_race(
  '23000000-0000-0000-0000-000000000003',
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')::text$q$,
  '23000000-0000-0000-0000-000000000003',
  $q$select public.withdraw_registration('23400000-0000-0000-0000-000000000003')::text$q$);

select pg_temp.assert_true(
  (select (first_error is null) <> (second_error is null) from us23_race)
  and (select status = 'withdrawn' from public.event_registrations
        where id = '23400000-0000-0000-0000-000000000003')
  and (select count(*) = 1 from public.notification_outbox
        where recipient_email = 'a3-us23@example.test' and subject like 'You have withdrawn from%'),
  'AC-023.5.7: two simultaneous withdrawals succeed once, and send one email');
