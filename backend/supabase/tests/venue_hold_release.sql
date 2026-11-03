-- US11 AC-011.9 (SCRUM-16): a tentative hold is released when its event closes.
--
-- The first SQL coverage under an AC-011 ID. Every other AC-011 case is a component test, which
-- is why 0035's status list could be left behind by US22's 'withdrawn' and US38's 'postponed'
-- without anything going red.
--
-- Disposable PostgreSQL only; run through the database runner. Fixtures run inside a transaction
-- that is rolled back. Status changes are made with a Coordinator's JWT set but as the superuser,
-- so the triggers see a real auth.uid() while RLS does not hide the rows being asserted on —
-- the same approach as safety_review_revision.sql.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('11b90000-0000-0000-0000-000000000001', 'organiser-11b9@example.test'),
  ('11b90000-0000-0000-0000-000000000002', 'coordinator-11b9@example.test');
-- client_org_id is required for an organiser by 0069's profiles_client_org_required check;
-- 0c0a0000-...-0001 is the organisation 0069 seeds. Northwind Trading is reused by the other
-- suites rather than inserting another organisation this story has no interest in.
update public.profiles set role = 'organiser', full_name = 'Olive Organiser',
       client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id = '11b90000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator', full_name = 'Cora Coordinator'
 where id = '11b90000-0000-0000-0000-000000000002';

insert into public.venues (id, name, location, capacity, layout, status)
  values ('11b91000-0000-0000-0000-000000000001', 'US11 Hold Hall', 'Level 2', 150, 'theatre', 'active');

-- One event per case: 0036's unique index allows only one held/pending_approval booking per
-- event, so the held and pending cases cannot share one.
--   E1 planning,  held             -> postponed   the defect
--   E2 planning,  pending_approval -> postponed   the same release, other active status
--   E3 planning,  held             -> cancelled   regression: worked before this fix
--   E4 planning,  held             -> withdrawn   defensive; unreachable from planning today
--   E5 approved,  held             -> planning    negative control: an ordinary step keeps it
--   E6 planning,  confirmed        -> postponed   boundary: a confirmed booking is not a hold
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start,
  proposed_end, expected_attendance, status, reference, programme) values
  ('11b92000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'US11 Hold 1', 'Fixture', '2046-03-10 09:00+08', '2046-03-10 11:00+08', 50, 'planning', 'EVT-11B9-1', 'Talks'),
  ('11b92000-0000-0000-0000-000000000002', '11b90000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'US11 Hold 2', 'Fixture', '2046-03-11 09:00+08', '2046-03-11 11:00+08', 50, 'planning', 'EVT-11B9-2', 'Talks'),
  ('11b92000-0000-0000-0000-000000000003', '11b90000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'US11 Hold 3', 'Fixture', '2046-03-12 09:00+08', '2046-03-12 11:00+08', 50, 'planning', 'EVT-11B9-3', 'Talks'),
  ('11b92000-0000-0000-0000-000000000004', '11b90000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'US11 Hold 4', 'Fixture', '2046-03-13 09:00+08', '2046-03-13 11:00+08', 50, 'planning', 'EVT-11B9-4', 'Talks'),
  ('11b92000-0000-0000-0000-000000000005', '11b90000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'US11 Hold 5', 'Fixture', '2046-03-14 09:00+08', '2046-03-14 11:00+08', 50, 'approved', 'EVT-11B9-5', 'Talks'),
  ('11b92000-0000-0000-0000-000000000006', '11b90000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'US11 Hold 6', 'Fixture', '2046-03-15 09:00+08', '2046-03-15 11:00+08', 50, 'planning', 'EVT-11B9-6', 'Talks');

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('11b93000-0000-0000-0000-000000000001', '11b92000-0000-0000-0000-000000000001', '11b91000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'held', now() + interval '3 days'),
  ('11b93000-0000-0000-0000-000000000002', '11b92000-0000-0000-0000-000000000002', '11b91000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('11b93000-0000-0000-0000-000000000003', '11b92000-0000-0000-0000-000000000003', '11b91000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'held', now() + interval '3 days'),
  ('11b93000-0000-0000-0000-000000000004', '11b92000-0000-0000-0000-000000000004', '11b91000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'held', now() + interval '3 days'),
  ('11b93000-0000-0000-0000-000000000005', '11b92000-0000-0000-0000-000000000005', '11b91000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'held', now() + interval '3 days'),
  ('11b93000-0000-0000-0000-000000000006', '11b92000-0000-0000-0000-000000000006', '11b91000-0000-0000-0000-000000000001', '11b90000-0000-0000-0000-000000000002', 'confirmed', null);

-- One event cell plus its turnaround buffer per booking, on its own date so the slot ledger's
-- key cannot collide between cases.
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id) values
  ('11b91000-0000-0000-0000-000000000001', '2046-03-10', 'AM', 'event',  '11b93000-0000-0000-0000-000000000001'),
  ('11b91000-0000-0000-0000-000000000001', '2046-03-10', 'PM', 'buffer', '11b93000-0000-0000-0000-000000000001'),
  ('11b91000-0000-0000-0000-000000000001', '2046-03-11', 'AM', 'event',  '11b93000-0000-0000-0000-000000000002'),
  ('11b91000-0000-0000-0000-000000000001', '2046-03-12', 'AM', 'event',  '11b93000-0000-0000-0000-000000000003'),
  ('11b91000-0000-0000-0000-000000000001', '2046-03-13', 'AM', 'event',  '11b93000-0000-0000-0000-000000000004'),
  ('11b91000-0000-0000-0000-000000000001', '2046-03-14', 'AM', 'event',  '11b93000-0000-0000-0000-000000000005'),
  ('11b91000-0000-0000-0000-000000000001', '2046-03-15', 'AM', 'event',  '11b93000-0000-0000-0000-000000000006');

-- Runs one statement with a signed-in user's auth.uid(): 'ok', or the SQLSTATE of the refusal.
create function pg_temp.us11_as(actor uuid, statement text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

create function pg_temp.us11_set(event uuid, status text) returns text language sql as $$
  select format('update public.events set status = %L where id = %L', status, event) $$;

-- True when the booking is cancelled and not one of its slot claims is left: both halves
-- matter, because deleting the claims is what actually frees the slots for AC-011.2 while the
-- booking row stays as history.
create function pg_temp.us11_released(booking uuid) returns boolean language sql as $$
  select (select status from public.venue_bookings where id = booking) = 'cancelled'
     and not exists (select 1 from public.venue_slot_claims where booking_id = booking) $$;

create function pg_temp.us11_intact(booking uuid, expected_status text, claims int) returns boolean language sql as $$
  select (select status from public.venue_bookings where id = booking) = expected_status
     and (select count(*) from public.venue_slot_claims where booking_id = booking) = claims $$;

-- ---------------------------------------------------------------------------
-- AC-011.9: released when the event is cancelled, postponed or withdrawn
-- ---------------------------------------------------------------------------
-- Cancellation first: it is the one arm that has worked since 0035, so if this fails the fixture
-- is wrong rather than the trigger.
select pg_temp.us11_as('11b90000-0000-0000-0000-000000000002', pg_temp.us11_set('11b92000-0000-0000-0000-000000000003', 'cancelled')) as us11_cancel \gset
select pg_temp.assert_true(
  :'us11_cancel' = 'ok' and pg_temp.us11_released('11b93000-0000-0000-0000-000000000003'),
  'AC-011.9.1: cancelling an event releases its tentative hold and frees the slots');

-- The defect. Fails against 0035 alone: 'postponed' is not in its status list, so the hold and
-- both of its claims survive and no other event can take the slots until the hold lapses.
select pg_temp.us11_as('11b90000-0000-0000-0000-000000000002', pg_temp.us11_set('11b92000-0000-0000-0000-000000000001', 'postponed')) as us11_postpone \gset
select pg_temp.assert_true(
  :'us11_postpone' = 'ok' and pg_temp.us11_released('11b93000-0000-0000-0000-000000000001'),
  'AC-011.9.2: postponing an event releases its tentative hold and frees every slot it claimed');

select pg_temp.us11_as('11b90000-0000-0000-0000-000000000002', pg_temp.us11_set('11b92000-0000-0000-0000-000000000002', 'postponed')) as us11_postpone_pending \gset
select pg_temp.assert_true(
  :'us11_postpone_pending' = 'ok' and pg_temp.us11_released('11b93000-0000-0000-0000-000000000002'),
  'AC-011.9.3: postponing also releases a hold already submitted for review');

-- Withdrawal is unreachable from 'planning' under 0119, so this forces the status as an
-- administrator: with no JWT the lifecycle trigger returns before its validity check, while the
-- release trigger still fires. It pins the status list, not a route a coordinator can take.
select set_config('request.jwt.claim.sub', '', true);
update public.events set status = 'withdrawn' where id = '11b92000-0000-0000-0000-000000000004';
select pg_temp.assert_true(
  pg_temp.us11_released('11b93000-0000-0000-0000-000000000004'),
  'AC-011.9.4: a withdrawn event releases its tentative hold, for when the lifecycle allows it');

-- Negative control. Without this, a trigger that released on every status change would pass
-- every case above.
select pg_temp.us11_as('11b90000-0000-0000-0000-000000000002', pg_temp.us11_set('11b92000-0000-0000-0000-000000000005', 'planning')) as us11_ordinary \gset
select pg_temp.assert_true(
  :'us11_ordinary' = 'ok'
  and (select status from public.events where id = '11b92000-0000-0000-0000-000000000005') = 'planning'
  and pg_temp.us11_intact('11b93000-0000-0000-0000-000000000005', 'held', 1),
  'AC-011.9.5: moving an approved event into planning leaves its hold exactly as it was');

-- Boundary. AC-011.9 is about tentative holds; a confirmed booking is an arrangement, and
-- releasing those on postponement belongs to US21/US49, not here. If this ever starts failing,
-- someone has widened the booking statuses rather than the event statuses.
select pg_temp.us11_as('11b90000-0000-0000-0000-000000000002', pg_temp.us11_set('11b92000-0000-0000-0000-000000000006', 'postponed')) as us11_confirmed \gset
select pg_temp.assert_true(
  :'us11_confirmed' = 'ok' and pg_temp.us11_intact('11b93000-0000-0000-0000-000000000006', 'confirmed', 1),
  'AC-011.9.6: a confirmed booking is not a tentative hold and is left for US21 to deal with');

-- Guards the fix itself, the way AC-037.4.16 guards 0096: a later replacement of this function
-- that rebuilds it from 0035 would pass every case above only until the next replay.
select pg_temp.assert_true(
  (select prosrc like '%postponed%' and prosrc like '%withdrawn%'
     from pg_proc where oid = 'public.release_holds_on_event_close'::regproc),
  'AC-011.9.7: the release function still carries 0124''s widened status list');

rollback;