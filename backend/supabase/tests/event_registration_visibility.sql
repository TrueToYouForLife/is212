-- US54 (SCRUM-246): AC-054.1 to AC-054.4 — who can see an event's registrations.
--
-- 0043's own tests prove an Attendee reads only their own rows. These prove the three
-- audiences 0094 adds can read the event's rows, that everyone else still cannot, and that
-- a withdrawn registration is marked rather than hidden.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('54000000-0000-0000-0000-000000000001', 'us54-owner@example.test', '{"full_name":"Oona Owner"}'),
 ('54000000-0000-0000-0000-000000000002', 'us54-colleague@example.test', '{"full_name":"Cal Colleague"}'),
 ('54000000-0000-0000-0000-000000000003', 'us54-outsider@example.test', '{"full_name":"Otto Outsider"}'),
 ('54000000-0000-0000-0000-000000000004', 'us54-coord@example.test', '{"full_name":"Cora Coordinator"}'),
 ('54000000-0000-0000-0000-000000000005', 'us54-coord-other@example.test', '{"full_name":"Cliff Other"}'),
 ('54000000-0000-0000-0000-000000000006', 'us54-attendee-a@example.test', '{"full_name":"Ada Attendee"}'),
 ('54000000-0000-0000-0000-000000000007', 'us54-attendee-b@example.test', '{"full_name":"Ben Attendee"}');

-- Owner and colleague share Northwind; the outsider organises for Harbourline.
update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id in ('54000000-0000-0000-0000-000000000001',
              '54000000-0000-0000-0000-000000000002');
update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000002'
 where id = '54000000-0000-0000-0000-000000000003';
update public.profiles set role = 'coordinator'
 where id in ('54000000-0000-0000-0000-000000000004',
              '54000000-0000-0000-0000-000000000005');

insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status,
                           registration_required)
values ('54000000-1111-0000-0000-000000000001',
        '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000004',
        'Northwind conference', 'Northwind Conference', 'EVT-US54-1',
        '2046-10-01T10:00:00+08', '2046-10-01T18:00:00+08', 100, 'confirmed', true);

-- One active registration and one withdrawn, so AC-054.2 has both to tell apart.
insert into public.event_registrations (id, event_id, attendee_id, status, phone,
                                        registered_at, withdrawn_at)
values
 ('54000000-2222-0000-0000-000000000001', '54000000-1111-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000006', 'registered', '91234567',
  '2046-09-01T10:00:00+08', null),
 ('54000000-2222-0000-0000-000000000002', '54000000-1111-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000007', 'withdrawn', '98765432',
  '2046-09-02T10:00:00+08', '2046-09-03T10:00:00+08');

set role authenticated;

-- ===== AC-054.1 the Organiser sees each registration, with the attendee's details =====

select pg_temp.as_user('54000000-0000-0000-0000-000000000001');

select pg_temp.assert_true(
 (select count(*) = 2 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.1.1: the Organiser sees every registration for their event');

select pg_temp.assert_true(
 (select attendee_name = 'Ada Attendee'
     and attendee_email = 'us54-attendee-a@example.test'
     and registered_at = '2046-09-01T10:00:00+08'::timestamptz
     and status = 'registered'
    from public.list_event_registrations('54000000-1111-0000-0000-000000000001')
   where id = '54000000-2222-0000-0000-000000000001'),
 'AC-054.1.2: each row carries the attendee''s name, email, registration date and status');

-- The email is the reason this is a function rather than a policy: auth.users is not
-- readable by any browser role, so a widened policy could never have supplied it.
select pg_temp.assert_true(
 (select count(*) = 0 from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relname = 'users'
    and has_table_privilege('authenticated', c.oid, 'select')),
 'AC-054.1.3: authenticated cannot read auth.users directly, so the projection is the only path');

-- The answers an Attendee gave in order to take part are not roll-call information. No
-- criterion asks for them, and this pins that so sharing one later is a deliberate act.
select pg_temp.assert_true(
 (select not ('phone' = any(p.proargnames))
     and not ('dietary_requirements' = any(p.proargnames))
     and not ('accessibility_needs' = any(p.proargnames))
    from pg_proc p
   where p.oid = 'public.list_event_registrations(uuid)'::regprocedure),
 'AC-054.1.4: the projection withholds the attendee''s personal answers');

-- ===== AC-054.2 withdrawn registrations are marked, not hidden =====

select pg_temp.assert_true(
 (select status = 'withdrawn' and withdrawn_at is not null
    from public.list_event_registrations('54000000-1111-0000-0000-000000000001')
   where id = '54000000-2222-0000-0000-000000000002'),
 'AC-054.2.1: a withdrawn registration is returned and marked as withdrawn');

select pg_temp.assert_true(
 (select count(*) = 1 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001') where status = 'registered'),
 'AC-054.2.2: the active count excludes withdrawn registrations');

-- Boundary: the ordering the reader depends on, so the people coming lead the list.
select pg_temp.assert_true(
 (select status = 'registered' from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001') limit 1),
 'AC-054.2.3: active registrations are listed before withdrawn ones');

-- ===== AC-054.3 the assigned Coordinator sees the same list =====

select pg_temp.as_user('54000000-0000-0000-0000-000000000004');

select pg_temp.assert_true(
 (select count(*) = 2 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.3.1: the assigned Coordinator sees the same list as the Organiser');

-- Reassignment must move this access with it, as it does for every other coordinator
-- right since 0048. A Coordinator who is not the assignee is just another signed-in user.
select pg_temp.as_user('54000000-0000-0000-0000-000000000005');

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.3.2: a Coordinator who is not the assignee sees nothing');

-- ===== AC-054.4 colleagues may look; nobody else may =====

select pg_temp.as_user('54000000-0000-0000-0000-000000000002');

select pg_temp.assert_true(
 (select count(*) = 2 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.4.1: an Organiser in the same client organisation can view the list');

-- "but not change it" needs no new rule: 0043 grants SELECT on the table and nothing else,
-- so there has never been a browser write path to close. Asserted rather than assumed,
-- because a later migration widening the grants would make the criterion false in silence.
select pg_temp.assert_true(
 not has_table_privilege('authenticated', 'public.event_registrations', 'INSERT')
 and not has_table_privilege('authenticated', 'public.event_registrations', 'UPDATE')
 and not has_table_privilege('authenticated', 'public.event_registrations', 'DELETE'),
 'AC-054.4.2: nobody can change a registration from the browser, colleagues included');

select pg_temp.as_user('54000000-0000-0000-0000-000000000003');

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.4.3: an Organiser in another client organisation sees nothing');

-- The Attendee's own row is still theirs to see through 0043; what they must not get is
-- the roll call, which would tell them who else is coming and their email addresses.
select pg_temp.as_user('54000000-0000-0000-0000-000000000006');

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.4.4: an Attendee registered for the event cannot see the other registrations');

select pg_temp.assert_true(
 (select count(*) = 1 from public.event_registrations
   where attendee_id = '54000000-0000-0000-0000-000000000006'),
 'AC-054.4.5: that Attendee can still see their own registration, as 0043 intends');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_event_registrations(
    '54000000-1111-0000-0000-000000000001')),
 'AC-054.4.6: with nobody signed in the list is empty');
