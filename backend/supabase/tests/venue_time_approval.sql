begin;
update public.profiles set role='venue_staff' where id='47750000-0000-0000-0000-000000000001';
update public.venues set setup_minutes=30,turnaround_minutes=45 where id='47750000-0000-0000-0000-000000000002';
insert into public.events(id,organiser_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000001','approved','Approval test',
 '2047-11-01 10:00+08','2047-11-01 12:00+08',10 from generate_series(300,301) n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
select ('47750000-0000-0000-0000-'||lpad((n+10)::text,12,'0'))::uuid,
 ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000002','47750000-0000-0000-0000-000000000001','pending_approval'
from generate_series(300,301) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
create temp table us47_review as select public.get_venue_booking_review('47750000-0000-0000-0000-000000000310') value;
select pg_temp.us47_assert(
 (select jsonb_array_length(value->'requestedCells')=13 and value->>'reviewVersion' is not null
 and value->'details' ? 'facilityRequirements' and value->'details' ? 'accessibilityRequirements' from us47_review),
 'AC-047.2.14: review returns venue-specific cells, structured requirements and review version');
select public.approve_venue_booking('47750000-0000-0000-0000-000000000310',(select value->>'reviewVersion' from us47_review));
select pg_temp.us47_assert(
 exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000310' and status='confirmed' and reviewed_by=auth.uid())
 and (select count(*)=13 and count(*) filter(where kind='event')=8 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000310'),
 'AC-047.2.14: approval reserves event and venue-specific buffer cells together');
create temp table us47_stale as select public.get_venue_booking_review('47750000-0000-0000-0000-000000000311')->>'reviewVersion' version;
reset role;
update public.venues set setup_minutes=45 where id='47750000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
 begin
  perform public.approve_venue_booking('47750000-0000-0000-0000-000000000311',(select version from us47_stale));
  raise exception 'Stale venue settings accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.approve_venue_booking('47750000-0000-0000-0000-000000000311',public.get_venue_booking_review('47750000-0000-0000-0000-000000000311')->>'reviewVersion');
  raise exception 'Overlapping approval accepted';
 exception when unique_violation then null; end;
end $$;
select pg_temp.us47_assert(
 exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000311' and status='pending_approval')
 and not exists(select 1 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000311'),
 'AC-047.2.15: venue edits invalidate open reviews; conflicting approval rolls back without partial cells');
-- The legacy fixture deliberately has event dates different from saved claims.
create temp table us47_legacy_before as select * from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000022';
do $$ begin
 begin
  perform public.approve_venue_booking('47750000-0000-0000-0000-000000000022',public.get_venue_booking_review('47750000-0000-0000-0000-000000000022')->>'reviewVersion');
  raise exception 'Changed legacy reservation accepted';
 exception when serialization_failure then null; end;
end $$;
select pg_temp.us47_assert(
 not exists((select * from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000022' except select * from us47_legacy_before)
 union all(select * from us47_legacy_before except select * from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000022'))
 and exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000022' and status='pending_approval'),
 'AC-047.2.16: mismatched converted reservation is refused without deleting or shortening its saved occupancy');
reset role;
-- Draft event timing may be incomplete. Staff must still be
-- able to inspect the booking, with the unavailable conflict check explicit.
insert into public.events(id,organiser_id,status)
values('47750000-0000-0000-0000-000000000302','47750000-0000-0000-0000-000000000001','draft');
-- Administrative fixture for a review of a record with incomplete event data.
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
values('47750000-0000-0000-0000-000000000312','47750000-0000-0000-0000-000000000302',
 '47750000-0000-0000-0000-000000000002','47750000-0000-0000-0000-000000000001','pending_approval');
set local role authenticated;
select pg_temp.us47_assert(
 (select value->>'id'='47750000-0000-0000-0000-000000000312'
  and value->'conflictCheckAvailable'='false'::jsonb
  and value->'requestedCells'='[]'::jsonb
 from (select public.get_venue_booking_review('47750000-0000-0000-0000-000000000312') value) r),
 'AC-047.2.17: incomplete timing still allows staff to read booking details with conflict checking unavailable');
reset role;
rollback;
