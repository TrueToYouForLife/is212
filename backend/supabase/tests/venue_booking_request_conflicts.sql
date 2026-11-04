-- US9 AC-009.6 (SCRUM-15): a booking cannot take a venue and slot that conflicts with an
-- existing booking, its setup/turnaround slots, or a period where the venue is blocked.
--
-- Regression coverage of behaviour that has always been correct, not a red-green cycle: the
-- refusal is the primary key on venue_slot_claims (venue_id, slot_date, slot), in place since
-- 0018. These cases exist because AC-009.6 had no test ID in its own story's numbering — the
-- rule was exercised only as AC-010.3.1 to .3.11 in venue_booking_conflicts.sql, which asserts
-- what the reviewer is shown rather than that the claim is refused. See
-- docs/test-cases/US9_test_cases.md.
--
-- Disposable PostgreSQL only; run through the database runner, which skips 0075, so the legacy
-- AM/PM/NIGHT catalogue applies here as it does in venue_booking_conflicts.sql. Fixtures run
-- inside a transaction that is rolled back. Ledger rows are written as the superuser, the way
-- venue_booking_conflicts.sql sets its ledger up, because what is under test is the constraint
-- rather than who may reach it.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('09c60000-0000-0000-0000-000000000001', 'organiser-09c6@example.test'),
  ('09c60000-0000-0000-0000-000000000002', 'coordinator-09c6@example.test'),
  ('09c60000-0000-0000-0000-000000000003', 'venue-09c6@example.test');
update public.profiles set role = 'venue_staff', full_name = 'Vera Venue'
 where id = '09c60000-0000-0000-0000-000000000003';
-- 0069 requires an organiser to belong to a client organisation; 0c0a0000-...-0001 is the
-- organisation it seeds.
update public.profiles set role = 'organiser', full_name = 'Oona Organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = '09c60000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator', full_name = 'Caleb Coordinator'
 where id = '09c60000-0000-0000-0000-000000000002';

insert into public.venues (id, name, location, capacity, layout, status)
  values ('09c61000-0000-0000-0000-000000000001', 'US9 Conflict Hall', 'Level 3', 120, 'theatre', 'active');

-- E1 already holds the venue; E2 is the event whose booking must be refused.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start,
  proposed_end, expected_attendance, status, reference, programme) values
  ('09c62000-0000-0000-0000-000000000001', '09c60000-0000-0000-0000-000000000001', '09c60000-0000-0000-0000-000000000002', 'US9 Conflict 1', 'Fixture', '2046-04-10 09:00+08', '2046-04-10 11:00+08', 40, 'planning', 'EVT-09C6-1', 'Talks'),
  ('09c62000-0000-0000-0000-000000000002', '09c60000-0000-0000-0000-000000000001', '09c60000-0000-0000-0000-000000000002', 'US9 Conflict 2', 'Fixture', '2046-04-10 13:00+08', '2046-04-10 16:00+08', 40, 'planning', 'EVT-09C6-2', 'Talks');

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status) values
  ('09c63000-0000-0000-0000-000000000001', '09c62000-0000-0000-0000-000000000001', '09c61000-0000-0000-0000-000000000001', '09c60000-0000-0000-0000-000000000002', 'confirmed'),
  ('09c63000-0000-0000-0000-000000000002', '09c62000-0000-0000-0000-000000000002', '09c61000-0000-0000-0000-000000000001', '09c60000-0000-0000-0000-000000000002', 'held');

-- E1's booking occupies AM as its event slot and PM as its turnaround buffer. A closure takes
-- NIGHT, which is how a blocked period reaches the same ledger (kind = 'maintenance').
insert into public.venue_closures (id, venue_id, reason, starts_on, ends_on, created_by)
  values ('09c64000-0000-0000-0000-000000000001', '09c61000-0000-0000-0000-000000000001', 'Floor repairs',
          '2046-04-10', '2046-04-10', '09c60000-0000-0000-0000-000000000003');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id, closure_id) values
  ('09c61000-0000-0000-0000-000000000001', '2046-04-10', 'AM',    'event',       '09c63000-0000-0000-0000-000000000001', null),
  ('09c61000-0000-0000-0000-000000000001', '2046-04-10', 'PM',    'buffer',      '09c63000-0000-0000-0000-000000000001', null),
  ('09c61000-0000-0000-0000-000000000001', '2046-04-10', 'NIGHT', 'maintenance', null, '09c64000-0000-0000-0000-000000000001');

-- Attempts one claim for E2's booking and reports the SQLSTATE of the refusal, or 'ok'.
create function pg_temp.us9_claim(slot_date date, slot text) returns text language plpgsql as $$
begin
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
    values ('09c61000-0000-0000-0000-000000000001', slot_date, slot, 'event',
            '09c63000-0000-0000-0000-000000000002');
  return 'ok';
exception when others then
  return sqlstate;
end $$;

-- ---------------------------------------------------------------------------
-- AC-009.6: the slot ledger refuses a conflicting claim
-- ---------------------------------------------------------------------------
-- Each attempt is its own statement before the assertion that reads it: a statement cannot see
-- the writes made by functions it calls, so folding the claim into the assert would check the
-- ledger as it stood beforehand (CLAUDE.md, US14).

-- Conflict. 23505 is a unique violation: the primary key is what makes two bookings of one cell
-- impossible, which is why no advisory check in the browser can be the control.
select pg_temp.us9_claim('2046-04-10', 'AM') as us9_event_slot \gset
select pg_temp.assert_true(
  :'us9_event_slot' = '23505'
  and (select count(*) = 1 from public.venue_slot_claims
        where venue_id = '09c61000-0000-0000-0000-000000000001' and slot_date = '2046-04-10'
          and slot = 'AM' and booking_id = '09c63000-0000-0000-0000-000000000001'),
  'AC-009.6.1: a slot an existing booking already holds cannot be claimed, and the original keeps it');

-- Boundary: a setup/turnaround slot is as unavailable as the event slot itself. The ledger does
-- not distinguish them, which is the point of recording buffers as claims rather than deriving
-- them when something asks.
select pg_temp.us9_claim('2046-04-10', 'PM') as us9_buffer_slot \gset
select pg_temp.assert_true(
  :'us9_buffer_slot' = '23505'
  and (select kind = 'buffer' from public.venue_slot_claims
        where venue_id = '09c61000-0000-0000-0000-000000000001' and slot_date = '2046-04-10' and slot = 'PM'),
  'AC-009.6.2: a slot held only as another booking''s setup or turnaround buffer is refused too');

-- Conflict. A blocked period occupies the ledger through a closure rather than a booking, so a
-- claim is refused by the same key with no reference to the block's own rules.
select pg_temp.us9_claim('2046-04-10', 'NIGHT') as us9_blocked_slot \gset
select pg_temp.assert_true(
  :'us9_blocked_slot' = '23505'
  and (select kind = 'maintenance' from public.venue_slot_claims
        where venue_id = '09c61000-0000-0000-0000-000000000001' and slot_date = '2046-04-10' and slot = 'NIGHT'),
  'AC-009.6.3: a slot inside a period the venue is blocked for is refused');

-- Negative control. Without this, a fixture that refused every insert for an unrelated reason --
-- a broken foreign key, say -- would pass all three cases above.
select pg_temp.us9_claim('2046-04-11', 'AM') as us9_free_slot \gset
select pg_temp.assert_true(
  :'us9_free_slot' = 'ok'
  and (select count(*) = 1 from public.venue_slot_claims
        where booking_id = '09c63000-0000-0000-0000-000000000002'),
  'AC-009.6.4: the same venue and slot on a free date is accepted, so the refusals are the clash');

rollback;