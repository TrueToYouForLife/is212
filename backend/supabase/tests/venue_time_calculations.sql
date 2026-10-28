-- Run after the populated conversion and replay checks; all changes roll back.
begin;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set role='venue_staff' where id='47750000-0000-0000-0000-000000000001';
update public.venues set setup_minutes=30,turnaround_minutes=45
 where id='47750000-0000-0000-0000-000000000002';
select pg_temp.us47_assert(
 (select count(*)=13 and count(*) filter(where kind='event')=8
  and min(slot)='T0930' and max(slot)='T1230'
 from public.venue_review_cells('47750000-0000-0000-0000-000000000002',
 '2047-10-25 10:00+08','2047-10-25 12:00+08'))
 and (select count(*)=6 and min(slot_date)='2047-10-24'::date and max(slot_date)='2047-10-25'::date
 from public.venue_review_cells('47750000-0000-0000-0000-000000000002',
 '2047-10-25 00:00+08','2047-10-25 00:15+08')),
 'AC-047.2.6: venue durations generate the exact customer-example and cross-midnight quarter-hour cells');
update public.venues set setup_minutes=0,turnaround_minutes=0
 where id='47750000-0000-0000-0000-000000000002';
select pg_temp.us47_assert(
 (select count(*)=1 and bool_and(kind='event') and min(slot)='T1200'
 from public.venue_review_cells('47750000-0000-0000-0000-000000000002',
 '2047-10-25 12:00+08','2047-10-25 12:15+08'))
 and (select count(*)=2 and bool_and(kind='event')
 from public.venue_review_cells('47750000-0000-0000-0000-000000000002',
 '2047-10-25 12:07+08','2047-10-25 12:22+08')),
 'AC-047.2.6: zero durations add no buffer; partial quarter-hours occupy every touched cell without changing event times');

set local role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
do $$
declare slots text[]; invalid text[];
begin
 foreach invalid slice 1 in array array[array['AM'],array['T1260'],array[null::text]] loop
  begin
   perform public.preview_venue_block('47750000-0000-0000-0000-000000000002','2047-10-25','2047-10-25',invalid);
   raise exception 'Invalid block code accepted';
  exception when invalid_parameter_value then null;
  end;
 end loop;
 foreach slots slice 1 in array array[array['T1200']] loop
  begin
   perform public.preview_venue_block('47750000-0000-0000-0000-000000000002',null,'2047-10-25',slots);
   raise exception 'Null date accepted';
  exception when invalid_parameter_value then null;
  end;
 end loop;
 begin
  perform public.preview_venue_block('47750000-0000-0000-0000-000000000002','2047-10-25','2047-10-25',array[]::text[]);
  raise exception 'Empty block accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.venue_review_cells('47750000-0000-0000-0000-000000000002','2047-10-25 10:00+08','2047-10-25 12:00+08');
  raise exception 'Internal calculation exposed';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.preview_venue_block('47750000-0000-0000-0000-000000000002','2047-10-25','2047-10-25',array['T1200']);
  raise exception 'Unauthenticated block preview allowed';
 exception when insufficient_privilege then null;
 end;
 raise notice 'PASS: AC-047.2.7: invalid block inputs refused and internal/unauthenticated access remains restricted';
end $$;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
-- Block a lunch-time cell (old blackout gap) plus two cells already held by a booking.
create temp table us47_new_block as select public.block_venue(
 '47750000-0000-0000-0000-000000000002','2047-10-22','2047-10-22',
 array['T1315','T1200','T1300','T1200'],'US47 quarter-hour block') id;
select pg_temp.us47_assert(
 (select slots=array['T1200','T1300','T1315'] from public.venue_closures where id=(select id from us47_new_block))
 and (select count(*)=2 from public.preview_venue_block(
  '47750000-0000-0000-0000-000000000002','2047-10-22','2047-10-22',array['T1300','T1315']) where overlap_type='booking')
 and (select count(*)=20 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000021')
 and (select count(*)=1 from public.venue_booking_flags where closure_id=(select id from us47_new_block))
 and exists(select 1 from public.venue_slot_claims where closure_id=(select id from us47_new_block) and slot='T1200'),
 'AC-047.2.8: quarter-hour block normalises codes, includes lunch time and flags overlapping holds without removing their cells');
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000021' and slot='T1300';
select pg_temp.us47_assert(exists(select 1 from public.venue_slot_claims
 where closure_id=(select id from us47_new_block) and slot='T1300'),
 'AC-047.2.8: released quarter-hour reservation cells revert to their covering block');
set local role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
select public.remove_venue_block(id) from us47_new_block;
select pg_temp.us47_assert(
 not exists(select 1 from public.venue_slot_claims where closure_id=(select id from us47_new_block))
 and (select count(*)=19 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000021'),
 'AC-047.2.8: removing a quarter-hour block preserves remaining booking cells');
reset role;
rollback;
