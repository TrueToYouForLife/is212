-- US31 slice 2 (SCRUM-228): AC-031.1 to AC-031.3 — colleagues in one client organisation
-- can see each other's events, nobody outside it can, and seeing is all a colleague may do.
--
-- Slice 1's checks (client_organisations.sql) prove every Organiser has an organisation.
-- These prove that ownership actually decides what is visible, which is the point of
-- having recorded it.
--
-- The write halves of AC-031.2 are tested here even though 0078 adds no policy. They were
-- already enforced by the ownership-scoped policies in 0006 and 0007, and a read-widening
-- migration is exactly the change that could quietly loosen them, so they are pinned.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('31100000-0000-0000-0000-000000000001', 'us31-a1@example.test', '{"full_name":"Ama One"}'),
 ('31100000-0000-0000-0000-000000000002', 'us31-a2@example.test', '{"full_name":"Ada Two"}'),
 ('31100000-0000-0000-0000-000000000003', 'us31-b1@example.test', '{"full_name":"Bo Three"}'),
 ('31100000-0000-0000-0000-000000000004', 'us31-coord@example.test', '{"full_name":"Cy Four"}'),
 ('31100000-0000-0000-0000-000000000005', 'us31-coord-stray@example.test', '{"full_name":"Dee Five"}');

-- A1 and A2 work for Northwind; B1 works for Harbourline.
update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id in ('31100000-0000-0000-0000-000000000001',
              '31100000-0000-0000-0000-000000000002');
update public.profiles set role = 'organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000002'
 where id = '31100000-0000-0000-0000-000000000003';
update public.profiles set role = 'coordinator'
 where id = '31100000-0000-0000-0000-000000000004';

-- A Coordinator carrying a client organisation left over from a spell as an Organiser.
-- 0069's CHECK is one-directional on purpose, so this row is legal — and it is the exact
-- shape that would leak a client's events if the functions read the column without
-- checking the role first.
update public.profiles set role = 'coordinator',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = '31100000-0000-0000-0000-000000000005';

insert into public.events (id, organiser_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status,
                           review_note, special_arrangements)
values
 ('31100000-1111-0000-0000-000000000001', '31100000-0000-0000-0000-000000000001',
  'Northwind kickoff', 'Northwind Kickoff', 'EVT-US31-A1',
  '2046-06-01T10:00:00+08', '2046-06-01T12:00:00+08', 30, 'submitted',
  'Internal reviewer note', 'Step-free access to the stage'),
 ('31100000-1111-0000-0000-000000000002', '31100000-0000-0000-0000-000000000002',
  'Northwind awards', 'Northwind Awards', 'EVT-US31-A2',
  '2046-07-01T10:00:00+08', '2046-07-01T12:00:00+08', 40, 'approved', null, null),
 ('31100000-1111-0000-0000-000000000003', '31100000-0000-0000-0000-000000000003',
  'Harbourline offsite', 'Harbourline Offsite', 'EVT-US31-B1',
  '2046-08-01T10:00:00+08', '2046-08-01T12:00:00+08', 20, 'submitted', null, null),
 ('31100000-1111-0000-0000-000000000004', '31100000-0000-0000-0000-000000000001',
  'Northwind idea', 'Northwind Draft', null,
  '2046-09-01T10:00:00+08', '2046-09-01T12:00:00+08', 10, 'draft', null, null);

set role authenticated;

-- ===== AC-031.1 an Organiser can view and act on the events they are responsible for =====

select pg_temp.as_user('31100000-0000-0000-0000-000000000001');

select pg_temp.assert_true(
 (select count(*) = 1 from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000001'),
 'AC-031.1.1: an Organiser sees their own event in their organisation''s list');

select pg_temp.assert_true(
 (select is_mine from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000001'),
 'AC-031.1.2: their own event is marked as theirs, so the UI can offer the actions');

-- The read widening must not have disturbed the write path the owner still needs. A
-- submitted event's details cannot be edited directly by anyone (0008), so the owner's
-- "act on" here is the change request US6 gives them — which is also precisely what
-- AC-031.2.6 refuses a colleague, making the two a matched pair rather than two
-- unrelated assertions.
insert into public.event_change_requests (event_id, organiser_id, proposed_changes, reason)
values ('31100000-1111-0000-0000-000000000001',
        '31100000-0000-0000-0000-000000000001',
        '{"name":"Northwind Kickoff (revised)"}'::jsonb, 'Venue asked us to rename it');

select pg_temp.assert_true(
 (select count(*) = 1 from public.event_change_requests
   where event_id = '31100000-1111-0000-0000-000000000001'
     and organiser_id = '31100000-0000-0000-0000-000000000001'),
 'AC-031.1.3: the owner can still act on their own event after the read is widened');

-- ===== AC-031.2 colleagues may view, and only view =====

select pg_temp.as_user('31100000-0000-0000-0000-000000000002');

select pg_temp.assert_true(
 (select count(*) = 1 from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000001'),
 'AC-031.2.1: a colleague in the same organisation sees the event');

select pg_temp.assert_true(
 (select not is_mine from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000001'),
 'AC-031.2.2: a colleague''s view does not claim the event as theirs');

-- The returned column list is the access control, so it is asserted directly rather than
-- inferred from a row. RLS can hide rows but not columns; this is what replaces that.
select pg_temp.assert_true(
 (select not ('review_note' = any(p.proargnames))
     and not ('special_arrangements' = any(p.proargnames))
     and not ('description' = any(p.proargnames))
    from pg_proc p
   where p.oid = 'public.list_organisation_events()'::regprocedure),
 'AC-031.2.3: the projection carries no reviewer note, arrangements or description');

select pg_temp.assert_true(
 (select not ('review_note' = any(p.proargnames))
     and not ('special_arrangements' = any(p.proargnames))
    from pg_proc p
   where p.oid = 'public.get_organisation_event(uuid)'::regprocedure),
 'AC-031.2.4: the single-event projection withholds the same fields');

-- A refused UPDATE and a refused INSERT do not look the same, and the difference is worth
-- knowing rather than papering over: events_update_own (0006) is a USING clause, so a
-- colleague's update matches no rows and reports success having changed nothing, while an
-- INSERT has only a WITH CHECK to fail and raises 42501. Both are refusals; only one is an
-- error. Asserting the row is untouched is what actually proves the first.
update public.events set name = 'Hijacked'
 where id = '31100000-1111-0000-0000-000000000001';

select pg_temp.expect_error(
 $q$insert into public.event_change_requests (event_id, organiser_id, proposed_changes, reason)
    values ('31100000-1111-0000-0000-000000000001',
            '31100000-0000-0000-0000-000000000002', '{"name":"Theirs"}'::jsonb, 'Not mine')$q$,
 '42501',
 'AC-031.2.6: a colleague cannot request changes on an event they can see');

update public.events set status = 'cancelled'
 where id = '31100000-1111-0000-0000-000000000001';

-- Both attempts are checked from outside the colleague's session on purpose: a colleague
-- cannot SELECT the row from events at all, which is the whole point of reading through a
-- projection. Asserting from inside their session would read nothing and pass whatever
-- happened, so the check is made where the real row is visible.
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select name <> 'Hijacked' from public.events
   where id = '31100000-1111-0000-0000-000000000001'),
 'AC-031.2.5: a colleague cannot edit an event they can see');

select pg_temp.assert_true(
 (select status = 'submitted' from public.events
   where id = '31100000-1111-0000-0000-000000000001'),
 'AC-031.2.7: a colleague cannot withdraw an event they can see');

set role authenticated;
select pg_temp.as_user('31100000-0000-0000-0000-000000000002');

-- Boundary: 0005 calls drafts private working copies "including when accessed by URL",
-- and that holds between colleagues too. An Organiser's own drafts are reached from
-- /drafts, not from a shared organisation view.
select pg_temp.assert_true(
 (select count(*) = 0 from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000004'),
 'AC-031.2.8: a colleague does not see another Organiser''s draft');

-- ===== AC-031.3 nothing from another client organisation =====

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000003'),
 'AC-031.3.1: another client''s event is absent from the list');

select pg_temp.as_user('31100000-0000-0000-0000-000000000003');

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_organisation_events()
   where id in ('31100000-1111-0000-0000-000000000001',
                '31100000-1111-0000-0000-000000000002')),
 'AC-031.3.2: an Organiser elsewhere sees none of this organisation''s events');

-- "Including through a direct link": no row, and no error that would confirm the event
-- exists at all. The positive control below is what stops this passing vacuously.
select pg_temp.assert_true(
 (select count(*) = 0 from public.get_organisation_event(
    '31100000-1111-0000-0000-000000000001')),
 'AC-031.3.3: a direct link to another client''s event returns nothing, not an error');

select pg_temp.assert_true(
 (select count(*) = 1 from public.get_organisation_event(
    '31100000-1111-0000-0000-000000000003')),
 'AC-031.3.4: the same call does return the caller''s own organisation''s event');

-- Role is the authority, not the column. This Coordinator's profile carries Northwind's
-- id; if the functions read client_org_id without checking the role they would hand over
-- a client's events to someone who merely used to work for them.
select pg_temp.as_user('31100000-0000-0000-0000-000000000005');

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_organisation_events()),
 'AC-031.3.5: a Coordinator holding a client organisation still sees nothing');

select pg_temp.as_user('31100000-0000-0000-0000-000000000004');

select pg_temp.assert_true(
 (select count(*) = 0 from public.list_organisation_events()),
 'AC-031.3.6: a Coordinator with no client organisation sees nothing');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select public.current_user_client_org() is null),
 'AC-031.3.7: with no signed-in user there is no organisation, so the list is empty');
