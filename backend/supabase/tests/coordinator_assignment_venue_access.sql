-- US17 follow-up: proposed reassignment rule, pending venue-story owner agreement.
-- Run only through the disposable database runner; no shared project is touched.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('17500000-0000-0000-0000-000000000001', 'lead-us17-venue@example.test'),
  ('17500000-0000-0000-0000-000000000002', 'organiser-us17-venue@example.test'),
  ('17500000-0000-0000-0000-000000000003', 'old-us17-venue@example.test'),
  ('17500000-0000-0000-0000-000000000004', 'new-us17-venue@example.test'),
  ('17500000-0000-0000-0000-000000000005', 'other-us17-venue@example.test');
update public.profiles set role = case id
  when '17500000-0000-0000-0000-000000000001'::uuid then 'coordinator_lead'
  when '17500000-0000-0000-0000-000000000002'::uuid then 'organiser'
  else 'coordinator' end
where id::text like '17500000-%';
insert into public.venues (id, name, location, capacity, layout, status) values
  ('17520000-0000-0000-0000-000000000001', 'US17 transfer hall', 'Test', 100, 'Theatre', 'active');
insert into public.events (id, organiser_id, coordinator_id, name, purpose,
  proposed_start, proposed_end, expected_attendance, status) values
  ('17510000-0000-0000-0000-000000000001', '17500000-0000-0000-0000-000000000002',
   '17500000-0000-0000-0000-000000000003', 'Venue handover', 'US17 access test',
   '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'approved');

-- A creates a real live hold before the Lead transfers responsibility to B.
set local role authenticated;
select set_config('request.jwt.claim.sub', '17500000-0000-0000-0000-000000000003', true);
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('17530000-0000-0000-0000-000000000001', '17510000-0000-0000-0000-000000000001',
   '17520000-0000-0000-0000-000000000001', auth.uid(), 'held', now() + interval '3 days');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id) values
  ('17520000-0000-0000-0000-000000000001', '2030-01-01', 'AM', 'event',
   '17530000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '17500000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17510000-0000-0000-0000-000000000001',
  '17500000-0000-0000-0000-000000000004');

do $$
declare actor text; operation text; affected integer;
begin
  foreach actor in array array[
    '17500000-0000-0000-0000-000000000003', -- original requester
    '17500000-0000-0000-0000-000000000005'  -- unrelated coordinator
  ] loop
    perform set_config('request.jwt.claim.sub', actor, true);
    foreach operation in array array['pending_approval', 'cancelled', 'delete_cells'] loop
      affected := 0;
      begin
        if operation = 'delete_cells' then
          delete from public.venue_slot_claims
            where booking_id = '17530000-0000-0000-0000-000000000001';
        else
          update public.venue_bookings set status = operation
            where id = '17530000-0000-0000-0000-000000000001';
        end if;
        get diagnostics affected = row_count;
        -- Roll back each probe so an incorrect permission cannot damage the
        -- fixture or affect the next assertion; local variables retain the count.
        raise exception using errcode = 'P1701', message = 'rollback permission probe';
      exception
        when sqlstate 'P1701' then null;
        when insufficient_privilege then affected := 0;
      end;
      if affected <> 0 then
        raise exception 'FAIL: AC-017.4.2: previous/unrelated coordinator % can still perform % on reassigned booking', actor, operation;
      end if;
    end loop;
  end loop;

  perform set_config('request.jwt.claim.sub', '17500000-0000-0000-0000-000000000004', true);
  update public.venue_bookings set status = 'pending_approval'
    where id = '17530000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (select 1 from public.venue_slot_claims
      where booking_id = '17530000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: AC-017.4.2: new coordinator must submit the existing hold without releasing its slots';
  end if;
  update public.venue_bookings set status = 'cancelled'
    where id = '17530000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: AC-017.4.2: new coordinator must release the existing booking';
  end if;
  delete from public.venue_slot_claims
    where booking_id = '17530000-0000-0000-0000-000000000001';
end $$;
reset role;
select pg_temp.assert_true(
  exists (select 1 from public.venue_bookings
    where id = '17530000-0000-0000-0000-000000000001' and status = 'cancelled'
      and requested_by = '17500000-0000-0000-0000-000000000003'
      and event_id = '17510000-0000-0000-0000-000000000001'
      and venue_id = '17520000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.venue_slot_claims
    where booking_id = '17530000-0000-0000-0000-000000000001'),
  'AC-017.4.2: booking management follows reassignment while preserving original requester and releasing slots');
rollback;
