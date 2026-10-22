-- US33 slice 2b (SCRUM-230), 0103: US12 venue closure alerts follow the Coordinator's channel
-- choices, for both continuous-period blocks and the legacy block_venue() wrapper. Runs in
-- run_venue_time_conversion.sh straight after 0103, which is applied after 0100. Fixtures run
-- inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
create function pg_temp.us33_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

insert into auth.users (id, email) values
  ('a1010000-0000-0000-0000-000000000001', 'organiser-0103@example.test'), ('a1010000-0000-0000-0000-000000000002', 'coordinator-0103@example.test'), ('a1010000-0000-0000-0000-000000000003', 'venue-0103@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a1010000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a1010000-0000-0000-0000-000000000002';
update public.profiles set role = 'venue_staff' where id = 'a1010000-0000-0000-0000-000000000003';

select set_config('request.jwt.claim.sub', 'a1010000-0000-0000-0000-000000000003', true);
insert into public.venues (id, name, location, capacity, layout, opens_at, closes_at, setup_minutes, turnaround_minutes) values
  ('a1011000-0000-0000-0000-000000000001', '0103 Hall', 'Level 1', 100, 'theatre', '00:00', '24:00', 0, 0),
  ('a1011000-0000-0000-0000-000000000002', '0103 Annex', 'Level 2', 50, 'theatre', '00:00', '24:00', 0, 0);
select set_config('request.jwt.claim.sub', '', true);

insert into public.events (id, organiser_id, coordinator_id, name, purpose, status, proposed_start, proposed_end, expected_attendance, layout_preference, reference) values
  ('a1013000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000002', '0103 One', 'Fixture', 'planning', '2049-12-01 10:00+08', '2049-12-01 11:00+08', 20, 'theatre', 'EVT-0103-1'),
  ('a1013000-0000-0000-0000-000000000002', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000002', '0103 Two', 'Fixture', 'planning', '2049-12-02 10:00+08', '2049-12-02 11:00+08', 20, 'theatre', 'EVT-0103-2');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status) values
  ('a1015000-0000-0000-0000-000000000001', 'a1013000-0000-0000-0000-000000000001', 'a1011000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000002', 'confirmed'),
  ('a1015000-0000-0000-0000-000000000002', 'a1013000-0000-0000-0000-000000000002', 'a1011000-0000-0000-0000-000000000002', 'a1010000-0000-0000-0000-000000000002', 'confirmed');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
select b.venue_id, c.slot_date, c.slot, c.kind, b.id
from public.venue_bookings b join public.events e on e.id = b.event_id
cross join lateral public.venue_review_cells(b.venue_id, e.proposed_start, e.proposed_end) c
where b.id in ('a1015000-0000-0000-0000-000000000001', 'a1015000-0000-0000-0000-000000000002');

-- A continuous-period block over the first booking, with no choices made.
select set_config('request.jwt.claim.sub', 'a1010000-0000-0000-0000-000000000003', true);
select public.block_venue_period('a1011000-0000-0000-0000-000000000001', '2049-12-01 09:00+08', '2049-12-01 12:00+08', 'Burst pipe');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.us33_assert(
  (select count(*) = 1 from public.venue_booking_flags where booking_id = 'a1015000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.notification_outbox where recipient_id = 'a1010000-0000-0000-0000-000000000002' and notification_type = 'venue_block_alert'
       and event_id = 'a1013000-0000-0000-0000-000000000001' and subject = 'Venue booking needs review: 0103 Hall')
  and (select count(*) = 1 from public.user_notifications where recipient_id = 'a1010000-0000-0000-0000-000000000002' and event_id = 'a1013000-0000-0000-0000-000000000001'
       and subject = 'Venue booking needs review: 0103 Hall'),
  'AC-033.4.25: a venue closure still flags the booking and reaches its Coordinator by email as before, and in the app');

-- The legacy slot-based block, after the Coordinator turned closure emails off.
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a1010000-0000-0000-0000-000000000002', 'venue_block_alert', true, false);
select set_config('request.jwt.claim.sub', 'a1010000-0000-0000-0000-000000000003', true);
select public.block_venue('a1011000-0000-0000-0000-000000000002', '2049-12-02', '2049-12-02', array['T1000'], 'Power cut');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.us33_assert(
  (select count(*) = 1 from public.venue_booking_flags where booking_id = 'a1015000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.notification_outbox where event_id = 'a1013000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.user_notifications where recipient_id = 'a1010000-0000-0000-0000-000000000002' and event_id = 'a1013000-0000-0000-0000-000000000002'),
  'AC-033.4.26: a Coordinator who turns closure emails off still gets the alert in the app, and the booking is still flagged');

rollback;
