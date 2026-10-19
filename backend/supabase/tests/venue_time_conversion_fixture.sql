-- Populated legacy state for the standalone US47 conversion runner.
create function pg_temp.us47_assert(ok boolean, label text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
insert into auth.users(id,email) values
 ('47750000-0000-0000-0000-000000000001','us47-conversion@example.test');
insert into public.venues(id,name,location,capacity,layout) values
 ('47750000-0000-0000-0000-000000000002','US47 Conversion Hall','Test',100,'theatre');
insert into public.events(id,organiser_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000001','approved','Conversion test',
 '2047-12-01 10:00+08','2047-12-01 11:00+08',10 from generate_series(10,12) n;
-- Event dates intentionally differ from reserved dates: conversion must use saved cells.
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status,hold_expires_at)
select ('47750000-0000-0000-0000-'||lpad((n+10)::text,12,'0'))::uuid,
 ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000002','47750000-0000-0000-0000-000000000001',
 case n when 10 then 'confirmed' when 11 then 'held' else 'pending_approval' end,
 '2047-11-01 00:00+08' from generate_series(10,12) n;
insert into public.venue_closures(id,venue_id,starts_on,ends_on,slots,reason,created_by,removed_at,removed_by)
values
 ('47750000-0000-0000-0000-000000000030','47750000-0000-0000-0000-000000000002','2047-10-20','2047-10-20',array['AM','PM'],'Active overlapping block','47750000-0000-0000-0000-000000000001',null,null),
 ('47750000-0000-0000-0000-000000000031','47750000-0000-0000-0000-000000000002','2047-10-21','2047-10-21',array['NIGHT'],'Removed block','47750000-0000-0000-0000-000000000001',now(),'47750000-0000-0000-0000-000000000001');
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('47750000-0000-0000-0000-000000000002','2047-10-19','NIGHT','buffer','47750000-0000-0000-0000-000000000020'),
 ('47750000-0000-0000-0000-000000000002','2047-10-20','AM','event','47750000-0000-0000-0000-000000000020'),
 ('47750000-0000-0000-0000-000000000002','2047-10-22','PM','event','47750000-0000-0000-0000-000000000021'),
 ('47750000-0000-0000-0000-000000000002','2047-10-23','NIGHT','event','47750000-0000-0000-0000-000000000022');
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,closure_id) values
 ('47750000-0000-0000-0000-000000000002','2047-10-20','PM','maintenance','47750000-0000-0000-0000-000000000030');
create temp table us47_before_bookings as select * from public.venue_bookings;
create temp table us47_before_closures as select to_jsonb(c)-'slots' data from public.venue_closures c;
-- Independently expand actual occupied instants into expected 15-minute start times.
create temp table us47_expected_claims as
 select c.venue_id,c.slot_date,c.kind,c.booking_id,c.closure_id,
 generate_series(c.slot_date+t.starts_at,c.slot_date+t.ends_at-interval '15 minutes',interval '15 minutes') instant
 from public.venue_slot_claims c join public.time_slots t on t.code=c.slot;
create temp table us47_expected_blocks as
 select c.id,generate_series(date '2047-01-01'+t.starts_at,
 date '2047-01-01'+t.ends_at-interval '15 minutes',interval '15 minutes') instant
 from public.venue_closures c cross join lateral unnest(c.slots) s
 join public.time_slots t on t.code=s;
