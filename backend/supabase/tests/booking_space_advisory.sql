-- US11 AC-011.10 (SCRUM-16), 0125: accessibility and facility requirements are advisory, so the
-- "Book anyway" the criterion asks for can exist; capacity still refuses.
--
-- Exercises check_booking_space directly rather than through hold_venue_space. The function is
-- what 0125 changes, and all three of its callers -- hold_venue_space (0102) and
-- approve_venue_booking (0102, replaced by 0116) -- reach the same rule, so testing it here
-- covers the hold and the approval without rebuilding either path's fixtures.
--
-- Disposable PostgreSQL only; run through the database runner after 0102, 0116 and 0125.
-- Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('0ad00000-0000-0000-0000-000000000001', 'organiser-0ad0@example.test'),
  ('0ad00000-0000-0000-0000-000000000002', 'coordinator-0ad0@example.test');
update public.profiles set role = 'organiser', full_name = 'Ola Organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = '0ad00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator', full_name = 'Cal Coordinator'
 where id = '0ad00000-0000-0000-0000-000000000002';

-- A venue with no accessibility features and no projector, offering one layout for 100.
insert into public.venues (id, name, location, capacity, layout, status, accessibility, facility)
  values ('0ad01000-0000-0000-0000-000000000001', 'US11 Advisory Hall', 'Level 4', 100, 'theatre',
          'active', '{}', '{}'::jsonb);
insert into public.venue_layouts (venue_id, layout, capacity)
  values ('0ad01000-0000-0000-0000-000000000001', 'theatre', 100);

-- The organiser asked for wheelchair access and a projector; neither is present.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start,
  proposed_end, expected_attendance, status, reference, programme,
  accessibility_requirements, facility_requirements) values
  ('0ad02000-0000-0000-0000-000000000001', '0ad00000-0000-0000-0000-000000000001',
   '0ad00000-0000-0000-0000-000000000002', 'US11 Advisory 1', 'Fixture',
   '2046-07-10 09:00+08', '2046-07-10 11:00+08', 60, 'planning', 'EVT-0AD0-1', 'Talks',
   '{wheelchair_access}', '{projector}');

-- Runs the check and reports 'ok' or the SQLSTATE of the refusal.
create function pg_temp.us11_space(layout text, attendance integer) returns text language plpgsql as $$
begin
  perform public.check_booking_space('0ad02000-0000-0000-0000-000000000001',
    '0ad01000-0000-0000-0000-000000000001', layout, attendance);
  return 'ok';
exception when others then
  return sqlstate;
end $$;

-- ---------------------------------------------------------------------------
-- AC-011.10: suitability is advice, capacity is not
-- ---------------------------------------------------------------------------
-- The change. Before 0125 this raised 22023 at the first missing accessibility code, which is
-- what made "Book anyway" impossible to honour.
select pg_temp.us11_space('theatre', 60) as us11_advisory \gset
select pg_temp.assert_true(
  :'us11_advisory' = 'ok',
  'AC-011.10.11: a venue missing a required accessibility code and facility no longer refuses the space');

-- Boundary, and the half that must not move: the layout cannot hold the people this booking
-- declares. AC-049.2 gives the booking its own number, and no reviewer can make the room bigger.
select pg_temp.us11_space('theatre', 101) as us11_too_many \gset
select pg_temp.assert_true(
  :'us11_too_many' = '22023',
  'AC-011.10.12: a layout that cannot hold the declared attendance is still refused');

-- Conflict: a layout this venue does not offer is still refused, so 0125 did not turn the
-- function into a no-op.
select pg_temp.us11_space('banquet', 10) as us11_wrong_layout \gset
select pg_temp.assert_true(
  :'us11_wrong_layout' = '22023',
  'AC-011.10.13: a layout the venue does not offer is still refused');

-- Negative control on the boundary: exactly at capacity is accepted, so .10.12 is the count and
-- not an unrelated refusal.
select pg_temp.us11_space('theatre', 100) as us11_exactly_full \gset
select pg_temp.assert_true(
  :'us11_exactly_full' = 'ok',
  'AC-011.10.14: a layout filled exactly to its capacity is accepted');

-- Guards the change itself, as AC-011.9.7 guards 0124: a later replacement rebuilt from 0102
-- would restore the refusals and silently remove the override this story depends on.
select pg_temp.assert_true(
  (select prosrc not like '%lacks required accessibility%' and prosrc not like '%lacks required facility%'
     from pg_proc where oid = 'public.check_booking_space(uuid,uuid,text,integer)'::regprocedure),
  'AC-011.10.15: check_booking_space still carries 0125''s advisory treatment');

rollback;
