-- US31 slice 1 (SCRUM-228): AC-031.4 — every Organiser account belongs to exactly one
-- client organisation.
--
-- Slice 1 is the ownership record only. The colleague read path (AC-031.1 to .3) is slice
-- 2 and has no tests here. What these checks are for is the invariant everything in slice
-- 2 will rest on: if an Organiser can exist without an organisation, or can choose their
-- own, then filtering events by organisation decides nothing.
--
-- Runs late in the suite on purpose. By this point every earlier fixture file has created
-- Organisers of its own, so AC-031.4.2 is a statement about the whole database rather than
-- about three rows this file made.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('31000000-0000-0000-0000-000000000001', 'us31-org-a1@example.test', '{}'),
 ('31000000-0000-0000-0000-000000000002', 'us31-org-a2@example.test', '{}'),
 ('31000000-0000-0000-0000-000000000003', 'us31-org-b1@example.test', '{}'),
 ('31000000-0000-0000-0000-000000000004', 'us31-coordinator@example.test', '{}'),
 ('31000000-0000-0000-0000-000000000005', 'us31-attendee@example.test', '{}');

-- 0042 makes every new account an Attendee, so each role is set explicitly here — and an
-- Organiser's organisation is now part of that same statement, which is the constraint
-- under test expressing itself in the fixtures.
update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id in ('31000000-0000-0000-0000-000000000001',
              '31000000-0000-0000-0000-000000000002');
update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000002'
 where id = '31000000-0000-0000-0000-000000000003';
update public.profiles set role = 'coordinator'
 where id = '31000000-0000-0000-0000-000000000004';

-- ===== the organisations exist =====

select pg_temp.assert_true(
 (select count(*) = 2 from public.client_organisations
   where id in ('0c0a0000-0000-4000-8000-000000000001',
                '0c0a0000-0000-4000-8000-000000000002')),
 'AC-031.4.1: 0069 seeds the client organisations the backfill and slice 2 depend on');

-- The backfill, measured across every Organiser the whole suite has created, not just the
-- three above. A migration that constrained new rows but left historical Organisers
-- unassigned would satisfy a narrower test and still fail the criterion.
select pg_temp.assert_true(
 (select count(*) = 0 from public.profiles
   where role = 'organiser' and client_org_id is null),
 'AC-031.4.2: no Organiser anywhere in the database is without an organisation');

-- ===== exactly one: the Organiser must have one =====

select pg_temp.expect_error(
 $q$update public.profiles set client_org_id = null
    where id = '31000000-0000-0000-0000-000000000001'$q$,
 '23514',
 'AC-031.4.3: an Organiser cannot be left without an organisation');

-- The constraint is one-directional by decision, not by omission: a profile that is not an
-- Organiser may still carry an organisation, which is what lets an Organiser be demoted
-- without a second statement. The guarantee that matters is the one above — no Organiser
-- without an organisation. This check pins the decision so that tightening it later is a
-- deliberate change with a failing test, rather than a silent one.
update public.profiles set client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = '31000000-0000-0000-0000-000000000004';

select pg_temp.assert_true(
 (select client_org_id is not null and role = 'coordinator' from public.profiles
   where id = '31000000-0000-0000-0000-000000000004'),
 'AC-031.4.4: a non-Organiser may hold an organisation — role, not this column, decides access');

select pg_temp.expect_error(
 $q$update public.profiles set client_org_id = '0c0a0000-0000-4000-8000-00000000ffff'
    where id = '31000000-0000-0000-0000-000000000001'$q$,
 '23503',
 'AC-031.4.5: an Organiser cannot be placed in an organisation that does not exist');

-- Boundary on the promotion path: an administrator turning an Attendee into an Organiser
-- has to say which client they work for, in the same statement. Without this the CHECK
-- would be satisfiable only by accident of ordering.
select pg_temp.expect_error(
 $q$update public.profiles set role = 'organiser'
    where id = '31000000-0000-0000-0000-000000000005'$q$,
 '23514',
 'AC-031.4.6: promoting an Attendee to Organiser requires naming the organisation');

-- ===== which organisation you belong to is not yours to choose =====
set role authenticated;

select pg_temp.as_user('31000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$update public.profiles
      set client_org_id = '0c0a0000-0000-4000-8000-000000000002'
    where id = '31000000-0000-0000-0000-000000000001'$q$,
 '42501',
 'AC-031.4.7: an Organiser cannot move themselves into another client''s organisation');

-- The same move by the same user through their own role column is already refused by
-- 0003; this checks the two guards do not leave a gap between them.
select pg_temp.expect_error(
 $q$update public.profiles set role = 'coordinator'
    where id = '31000000-0000-0000-0000-000000000001'$q$,
 '42501',
 'AC-031.4.8: the role guard still refuses a self-change with the organisation guard added');

-- ===== reading the organisation list =====

select pg_temp.assert_true(
 (select count(*) = 1 from public.client_organisations),
 'AC-031.4.9: an Organiser sees their own organisation and no other client''s');

select pg_temp.as_user('31000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
 (select count(*) >= 2 from public.client_organisations),
 'AC-031.4.10: a Coordinator works across clients and sees the whole list');

select pg_temp.as_user('31000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$insert into public.client_organisations (id, name)
    values ('0c0a0000-0000-4000-8000-0000000000aa', 'Invented Holdings')$q$,
 '42501',
 'AC-031.4.11: a signed-in user cannot create a client organisation');

select pg_temp.expect_error(
 $q$update public.client_organisations set name = 'Renamed'
    where id = '0c0a0000-0000-4000-8000-000000000001'$q$,
 '42501',
 'AC-031.4.12: a signed-in user cannot rename a client organisation');

-- ===== administrator paths and remaining integrity =====
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- auth.uid() is null for the service role and the SQL editor, so the guard lets an
-- administrator reassign. This is the path the team will actually use to correct the
-- backfill's default placement, which is why it is tested rather than assumed.
update public.profiles set client_org_id = '0c0a0000-0000-4000-8000-000000000002'
 where id = '31000000-0000-0000-0000-000000000002';

select pg_temp.assert_true(
 (select client_org_id = '0c0a0000-0000-4000-8000-000000000002' from public.profiles
   where id = '31000000-0000-0000-0000-000000000002'),
 'AC-031.4.13: an administrator can reassign an Organiser to another organisation');

select pg_temp.expect_error(
 $q$insert into public.client_organisations (id, name)
    values ('0c0a0000-0000-4000-8000-0000000000bb', 'Northwind Trading')$q$,
 '23505',
 'AC-031.4.14: two client organisations cannot share a name');

-- Restrict rather than cascade: deleting an organisation that still has Organisers would
-- silently strip their ownership, and the CHECK would then refuse every later write to
-- those rows. Failing the delete is the recoverable outcome.
select pg_temp.expect_error(
 $q$delete from public.client_organisations
    where id = '0c0a0000-0000-4000-8000-000000000001'$q$,
 '23503',
 'AC-031.4.15: an organisation with Organisers in it cannot be deleted');
