-- US43 slice 1 (0108) after US49 slice 2 (0107): run by run_venue_time_conversion.sh straight
-- after 0107 and the 0108 re-apply. The readiness card and the safety review must share one rule,
-- with 0107's rejected-booking rule in it. Fixtures roll back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.us43r_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users (id, email) values ('43d00000-0000-0000-0000-000000000001', 'organiser-43d@example.test'), ('43d00000-0000-0000-0000-000000000002', 'coordinator-43d@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '43d00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '43d00000-0000-0000-0000-000000000002';
insert into public.venues (id, name, location, capacity, layout, status) values ('43d10000-0000-0000-0000-000000000001', 'US43 Order Hall', 'Level 1', 200, 'theatre', 'active');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, registration_required)
values ('43d30000-0000-0000-0000-000000000001', '43d00000-0000-0000-0000-000000000001', '43d00000-0000-0000-0000-000000000002', 'US43 Order Event', 'Fixture', '2041-10-01 09:00+08', '2041-10-01 11:00+08', 40, 'planning', 'EVT-43D-1', 'Talks', false);
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, review_note) values
  ('43d50000-0000-0000-0000-000000000001', '43d30000-0000-0000-0000-000000000001', '43d10000-0000-0000-0000-000000000001', '43d00000-0000-0000-0000-000000000002', 'confirmed', null), ('43d50000-0000-0000-0000-000000000002', '43d30000-0000-0000-0000-000000000001', '43d10000-0000-0000-0000-000000000001', '43d00000-0000-0000-0000-000000000002', 'rejected', 'Fixture rejection');
update public.safety_review_settings set enabled = true;

set local role authenticated;
select set_config('request.jwt.claim.sub', '43d00000-0000-0000-0000-000000000002', true);
select (select complete from public.get_event_readiness('43d30000-0000-0000-0000-000000000001') where arrangement = 'venue_booking') as us43r_card,
       (select count(*) from public.get_event_readiness('43d30000-0000-0000-0000-000000000001') where arrangement = 'safety_review') as us43r_safety_line \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.us43r_assert(
  position('event_readiness_lines' in (select prosrc from pg_proc where proname = 'get_event_readiness')) > 0
  and not :'us43r_card' and :'us43r_safety_line' = 1
  and not public.event_ready_for_safety_review('43d30000-0000-0000-0000-000000000001'),
  'AC-043.1.18: after 0107, readiness is still the shared rule: one approved and one rejected venue is outstanding on the card and not ready for review');

rollback;
