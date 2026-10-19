begin;
update public.profiles set role='coordinator' where id='47750000-0000-0000-0000-000000000001';
update public.venues set setup_minutes=30,turnaround_minutes=45
 where id='47750000-0000-0000-0000-000000000002';
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000001','47750000-0000-0000-0000-000000000001',
 'approved','Hold test','2047-10-25 10:00+08','2047-10-25 12:00+08',10
from generate_series(100,102) n;
update public.events set coordinator_id=null where id='47750000-0000-0000-0000-000000000102';
set local role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
create temp table us47_hold as select public.hold_venue(
 '47750000-0000-0000-0000-000000000100','47750000-0000-0000-0000-000000000002') id;
select pg_temp.us47_assert(
 (select count(*)=13 and count(*) filter(where kind='event')=8
 from public.venue_slot_claims where booking_id=(select id from us47_hold))
 and exists(select 1 from public.venue_bookings where id=(select id from us47_hold)
 and requested_by=auth.uid() and status='held' and hold_expires_at=now()+interval '72 hours'),
 'AC-047.2.9: assigned Coordinator creates a hold with venue-specific buffers and unchanged default expiry');
do $$ begin
 begin
  perform public.hold_venue('47750000-0000-0000-0000-000000000101','47750000-0000-0000-0000-000000000002');
  raise exception 'Overlapping hold accepted';
 exception when unique_violation then null; end;
 begin
  perform public.hold_venue('47750000-0000-0000-0000-000000000102','47750000-0000-0000-0000-000000000002');
  raise exception 'Unassigned event accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.hold_venue('47750000-0000-0000-0000-000000000101','47750000-0000-0000-0000-000000000002',0);
  raise exception 'Zero expiry accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
select pg_temp.us47_assert(
 not exists(select 1 from public.venue_bookings where event_id in
 ('47750000-0000-0000-0000-000000000101','47750000-0000-0000-0000-000000000102'))
 and (select count(*)=13 from public.venue_slot_claims where booking_id=(select id from us47_hold)),
 'AC-047.2.10: conflicts and invalid/unauthorised requests leave no partial booking or lost reservation');
-- Expiring exactly now frees the cells, with the original booking retained.
update public.venue_bookings set hold_expires_at=now() where id=(select id from us47_hold);
set local role authenticated;
create temp table us47_replacement_hold as select public.hold_venue(
 '47750000-0000-0000-0000-000000000101','47750000-0000-0000-0000-000000000002') id;
reset role;
select pg_temp.us47_assert(
 exists(select 1 from public.venue_bookings where id=(select id from us47_hold) and status='expired')
 and not exists(select 1 from public.venue_slot_claims where booking_id=(select id from us47_hold))
 and (select count(*)=13 from public.venue_slot_claims where booking_id=(select id from us47_replacement_hold)),
 'AC-047.2.11: expiry boundary releases the old cells atomically and preserves the expired booking');
-- A block only touching setup time must also refuse a hold. Keep a hidden block
-- under the expiring reservation to check closure definitions and rollback.
update public.venue_bookings set hold_expires_at=now() where id=(select id from us47_replacement_hold);
insert into public.venue_closures(venue_id,starts_on,ends_on,slots,reason,created_by)
values('47750000-0000-0000-0000-000000000002','2047-10-25','2047-10-25',
 array['T0930'],'Setup-only block','47750000-0000-0000-0000-000000000001');
set local role authenticated;
do $$ begin
 begin
  perform public.hold_venue('47750000-0000-0000-0000-000000000100','47750000-0000-0000-0000-000000000002');
  raise exception 'Setup-only block accepted';
 exception when unique_violation then null; end;
end $$;
reset role;
select pg_temp.us47_assert(
 (select count(*)=13 from public.venue_slot_claims where booking_id=(select id from us47_replacement_hold))
 and exists(select 1 from public.venue_bookings where id=(select id from us47_replacement_hold) and status='held')
 and (select count(*)=1 from public.venue_bookings where event_id='47750000-0000-0000-0000-000000000100'),
 'AC-047.2.12: a block covering only setup refuses the hold and rolls back expiry cleanup without losing reservations');
rollback;
