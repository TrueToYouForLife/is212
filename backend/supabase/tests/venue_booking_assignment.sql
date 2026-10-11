-- US17 AC1 x venue booking (0049, SCRUM-250). Disposable PostgreSQL only; run through the runner.
-- Fixtures run inside a transaction that is rolled back. Auth is simulated; RLS is real.
-- Each action runs in its own statement before it is asserted: a statement cannot see the
-- writes made by functions it calls.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('49000000-0000-0000-0000-000000000001', 'lead-0049@example.test'),
  ('49000000-0000-0000-0000-000000000002', 'organiser-0049@example.test'),
  ('49000000-0000-0000-0000-000000000003', 'coordinator-a-0049@example.test'),
  ('49000000-0000-0000-0000-000000000004', 'coordinator-b-0049@example.test'),
  ('49000000-0000-0000-0000-000000000005', 'coordinator-c-0049@example.test');
update public.profiles set role = 'coordinator_lead'
  where id = '49000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator'
  where id in ('49000000-0000-0000-0000-000000000003',
               '49000000-0000-0000-0000-000000000004',
               '49000000-0000-0000-0000-000000000005');

insert into public.venues (id, name, location, capacity, layout, status) values
  ('49100000-0000-0000-0000-000000000001', '0049 Hall', 'Test', 100, 'Theatre', 'active'),
  ('49100000-0000-0000-0000-000000000002', '0049 Annex', 'Test', 50, 'Theatre', 'active');

-- E1: approved, assigned to A, reassigned to B below. E2: approved, unassigned.
-- E3: approved, assigned to A, with a lapsed hold. E4: approved, assigned to B.
insert into public.events (id, organiser_id, coordinator_id, name, purpose,
  proposed_start, proposed_end, expected_attendance, status)
values
  ('49200000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000002',
   '49000000-0000-0000-0000-000000000003', '0049 reassigned event', 'Fixture',
   '2031-03-10 09:00+08', '2031-03-10 11:00+08', 40, 'approved'),
  ('49200000-0000-0000-0000-000000000002', '49000000-0000-0000-0000-000000000002',
   null, '0049 unassigned event', 'Fixture',
   '2031-03-11 09:00+08', '2031-03-11 11:00+08', 40, 'approved'),
  ('49200000-0000-0000-0000-000000000003', '49000000-0000-0000-0000-000000000002',
   '49000000-0000-0000-0000-000000000003', '0049 lapsed hold event', 'Fixture',
   '2031-03-12 09:00+08', '2031-03-12 11:00+08', 40, 'approved'),
  ('49200000-0000-0000-0000-000000000004', '49000000-0000-0000-0000-000000000002',
   '49000000-0000-0000-0000-000000000004', '0049 other event of B', 'Fixture',
   '2031-03-13 09:00+08', '2031-03-13 11:00+08', 40, 'approved');

-- A's live hold on E1 and A's lapsed hold on E3, each with an event cell and a buffer cell.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values
  ('49300000-0000-0000-0000-000000000001', '49200000-0000-0000-0000-000000000001',
   '49100000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000003',
   'held', now() + interval '3 days'),
  ('49300000-0000-0000-0000-000000000003', '49200000-0000-0000-0000-000000000003',
   '49100000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000003',
   'held', now() - interval '1 hour');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id) values
  ('49100000-0000-0000-0000-000000000001', '2031-03-10', 'AM', 'event',
   '49300000-0000-0000-0000-000000000001'),
  ('49100000-0000-0000-0000-000000000001', '2031-03-10', 'PM', 'buffer',
   '49300000-0000-0000-0000-000000000001'),
  ('49100000-0000-0000-0000-000000000001', '2031-03-12', 'AM', 'event',
   '49300000-0000-0000-0000-000000000003'),
  ('49100000-0000-0000-0000-000000000001', '2031-03-12', 'PM', 'buffer',
   '49300000-0000-0000-0000-000000000003');

-- Runs one statement as a browser user. Returns the affected row count, or the SQLSTATE of
-- a refusal, so "denied by RLS" (rows:0 or 42501) is distinguishable from an unrelated error.
create function pg_temp.us49_as(actor uuid, statement text)
returns text language plpgsql as $$
declare affected integer;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  get diagnostics affected = row_count;
  return 'rows:' || affected;
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us49_claims(booking uuid) returns integer
language sql as $$
  select count(*)::integer from public.venue_slot_claims where booking_id = booking;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- AC-017.1: unassigned events are the Lead's, not any coordinator's
-- ---------------------------------------------------------------------------
select pg_temp.us49_as('49000000-0000-0000-0000-000000000005', $sql$
  insert into public.venue_bookings (event_id, venue_id, requested_by, status, hold_expires_at)
  values ('49200000-0000-0000-0000-000000000002', '49100000-0000-0000-0000-000000000001',
          '49000000-0000-0000-0000-000000000005', 'held', now() + interval '3 days')
$sql$) as us49_unassigned_hold \gset
reset role;
select pg_temp.assert_true(
  :'us49_unassigned_hold' = '42501'
  and not exists (select 1 from public.venue_bookings
                  where event_id = '49200000-0000-0000-0000-000000000002'),
  'AC-017.1.12: a coordinator cannot hold a venue for an approved event with no coordinator');

rollback;
