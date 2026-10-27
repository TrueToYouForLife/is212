select pg_temp.us47_assert(
 (select count(*)=96 from public.time_slots)
 and not exists((select * from public.venue_bookings except select * from us47_before_bookings)
 union all(select * from us47_before_bookings except select * from public.venue_bookings))
 and not exists(
 (select c.venue_id,c.slot_date,c.kind,c.booking_id,c.closure_id,c.slot_date+t.starts_at
 from public.venue_slot_claims c join public.time_slots t on t.code=c.slot
 except select * from us47_expected_claims)
 union all
 (select * from us47_expected_claims except
 select c.venue_id,c.slot_date,c.kind,c.booking_id,c.closure_id,c.slot_date+t.starts_at
 from public.venue_slot_claims c join public.time_slots t on t.code=c.slot)),
 'AC-047.2.3: conversion preserves exact booking/buffer/maintenance occupancy and all booking metadata');
select pg_temp.us47_assert(
 not exists((select to_jsonb(c)-'slots' from public.venue_closures c except select data from us47_before_closures)
 union all(select data from us47_before_closures except select to_jsonb(c)-'slots' from public.venue_closures c))
 and not exists(
 (select c.id,date '2047-01-01'+t.starts_at from public.venue_closures c
 cross join lateral unnest(c.slots) s join public.time_slots t on t.code=s
 except select * from us47_expected_blocks)
 union all(select * from us47_expected_blocks except
 select c.id,date '2047-01-01'+t.starts_at from public.venue_closures c
 cross join lateral unnest(c.slots) s join public.time_slots t on t.code=s))
 and not exists(select 1 from public.venue_slot_claims where closure_id='47750000-0000-0000-0000-000000000031')
 and (select count(*)=2 from pg_trigger where tgrelid='public.venue_slot_claims'::regclass
 and tgname in ('venue_slot_claims_reblock','venue_claims_protect_confirmed') and tgenabled='O'),
 'AC-047.2.4: overlapping and removed block definitions retain their exact periods, gaps and metadata; triggers restored');
create temp table us47_after_slots as select * from public.time_slots;
create temp table us47_after_claims as select * from public.venue_slot_claims;
create temp table us47_after_closures as select * from public.venue_closures;
