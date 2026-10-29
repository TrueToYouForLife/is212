-- US26 Confirm an event (SCRUM-71), 0117: AC-026.3 with the current booking model. Run by
-- run_venue_time_conversion.sh straight after 0117 is applied again. Fixtures roll back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.us26_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users (id, email) values
  ('26b00000-0000-0000-0000-000000000001', 'organiser-26b@example.test'), ('26b00000-0000-0000-0000-000000000002', 'coordinator-26b@example.test'), ('26b00000-0000-0000-0000-000000000003', 'other-coordinator-26b@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '26b00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('26b00000-0000-0000-0000-000000000002', '26b00000-0000-0000-0000-000000000003');

insert into public.venues (id, name, location, capacity, layout, opens_at, closes_at, setup_minutes, turnaround_minutes)
  values ('26b10000-0000-0000-0000-000000000001', 'US26 Booking Hall', 'Level 1', 200, 'theatre', '00:00', '24:00', 0, 0);

-- F1 is ready and gets confirmed; F2 (same time) and F3 (next day) belong to another Coordinator.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, layout_preference) values
  ('26b30000-0000-0000-0000-000000000001', '26b00000-0000-0000-0000-000000000001', '26b00000-0000-0000-0000-000000000002', 'US26 Confirmed', 'Fixture', '2044-11-10 10:00+08', '2044-11-10 12:00+08', 40, 'planning', 'EVT-26B-1', 'Talks', 'theatre'),
  ('26b30000-0000-0000-0000-000000000002', '26b00000-0000-0000-0000-000000000001', '26b00000-0000-0000-0000-000000000003', 'US26 Same time', 'Fixture', '2044-11-10 10:00+08', '2044-11-10 12:00+08', 40, 'planning', 'EVT-26B-2', 'Talks', 'theatre'),
  ('26b30000-0000-0000-0000-000000000003', '26b00000-0000-0000-0000-000000000001', '26b00000-0000-0000-0000-000000000003', 'US26 Next day', 'Fixture', '2044-11-11 10:00+08', '2044-11-11 12:00+08', 40, 'planning', 'EVT-26B-3', 'Talks', 'theatre');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status) values ('26b50000-0000-0000-0000-000000000001', '26b30000-0000-0000-0000-000000000001', '26b10000-0000-0000-0000-000000000001', '26b00000-0000-0000-0000-000000000002', 'confirmed');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
select b.venue_id, c.slot_date, c.slot, c.kind, b.id
from public.venue_bookings b join public.events e on e.id = b.event_id
cross join lateral public.venue_review_cells(b.venue_id, e.proposed_start, e.proposed_end) c
where b.id = '26b50000-0000-0000-0000-000000000001';

create function pg_temp.us26_as(actor uuid, statement text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

select pg_temp.us26_as('26b00000-0000-0000-0000-000000000002', $sql$update public.events set status = 'confirmed' where id = '26b30000-0000-0000-0000-000000000001'$sql$) as us26_confirm \gset
select pg_temp.us26_as('26b00000-0000-0000-0000-000000000003', $sql$select public.hold_venue('26b30000-0000-0000-0000-000000000002', '26b10000-0000-0000-0000-000000000001')$sql$) as us26_same_time \gset
select pg_temp.us26_as('26b00000-0000-0000-0000-000000000003', $sql$select public.hold_venue('26b30000-0000-0000-0000-000000000003', '26b10000-0000-0000-0000-000000000001')$sql$) as us26_next_day \gset
select pg_temp.us26_assert(
  :'us26_confirm' = 'ok' and (select status = 'confirmed' from public.events where id = '26b30000-0000-0000-0000-000000000001')
  and :'us26_same_time' <> 'ok' and not exists (select 1 from public.venue_bookings where event_id = '26b30000-0000-0000-0000-000000000002')
  and :'us26_next_day' = 'ok' and exists (select 1 from public.venue_bookings where event_id = '26b30000-0000-0000-0000-000000000003'),
  'AC-026.3.1: once an event is confirmed, another Coordinator cannot book its venue at the same time; another time is still free');

rollback;
