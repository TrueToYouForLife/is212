begin;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set role='coordinator' where id='47750000-0000-0000-0000-000000000001';
insert into public.venues(id,name,location,capacity,layout,setup_minutes,turnaround_minutes)
values('47750000-0000-0000-0000-000000000601','Setup hall','Test',100,'theatre',30,0),
 ('47750000-0000-0000-0000-000000000602','Zero buffer hall','Test',100,'theatre',0,0);
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
values('47750000-0000-0000-0000-000000000600','47750000-0000-0000-0000-000000000001',
 '47750000-0000-0000-0000-000000000001','approved','Revalidation','2047-12-10 11:00+08','2047-12-10 12:00+08',10);
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
select ('47750000-0000-0000-0000-'||lpad((n+2)::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000600',('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000001','confirmed' from generate_series(601,602) n;
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_bookings b
cross join lateral public.venue_review_cells(b.venue_id,'2047-12-10 11:00+08','2047-12-10 12:00+08') c
where b.event_id='47750000-0000-0000-0000-000000000600';
insert into public.venue_closures(venue_id,starts_on,ends_on,slots,reason,created_by)
select ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'2047-12-10','2047-12-10',
 array['T0930'],'Before event','47750000-0000-0000-0000-000000000001' from generate_series(601,602) n;
create temp table us47_revalidation_claims as select c.* from public.venue_slot_claims c
join public.venue_bookings b on b.id=c.booking_id where b.event_id='47750000-0000-0000-0000-000000000600';
set local role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
create temp table us47_planning_change as select public.update_event_planning(
 '47750000-0000-0000-0000-000000000600',public.get_event_planning('47750000-0000-0000-0000-000000000600')->>'version',
 '{"proposedStart":"2047-12-10T10:00:00+08:00","proposedEnd":"2047-12-10T11:00:00+08:00"}'::jsonb) id;
reset role;
select pg_temp.us47_assert(
 (select count(*)=1 and bool_and(venue_booking_id='47750000-0000-0000-0000-000000000603')
 from public.arrangement_review_flags where event_id='47750000-0000-0000-0000-000000000600' and reason_code='venue_time_conflict')
 and (select count(*)=2 from public.arrangement_review_flags where event_id='47750000-0000-0000-0000-000000000600' and reason_code='venue_timing_changed'),
 'AC-047.2.21: planning timing change checks each venue buffer; setup-only block flags only the buffered venue');
-- Recheck the same audit source to ensure existing idempotent flag creation survives.
select public.revalidate_event_arrangements('47750000-0000-0000-0000-000000000600',array['proposedStart','proposedEnd'],true,false,null,(select id from us47_planning_change));
select pg_temp.us47_assert(
 not exists((select * from us47_revalidation_claims except select * from public.venue_slot_claims)
 union all(select c.* from public.venue_slot_claims c join public.venue_bookings b on b.id=c.booking_id
 where b.event_id='47750000-0000-0000-0000-000000000600' except select * from us47_revalidation_claims))
 and (select count(*)=2 from public.venue_bookings where event_id='47750000-0000-0000-0000-000000000600' and status='confirmed')
 and (select count(*)=3 from public.arrangement_review_flags where event_id='47750000-0000-0000-0000-000000000600')
 and (select count(*)=3 and bool_and(recipient_id='47750000-0000-0000-0000-000000000001') from public.arrangement_review_notifications where event_id='47750000-0000-0000-0000-000000000600'),
 'AC-047.2.22: revalidation preserves saved reservations and records each flag and coordinator notification once');
rollback;
