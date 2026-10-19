-- US42 equipment read: real reservation outcomes and browser-role access checks.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users(id,email) values
 ('42700000-0000-0000-0000-000000000001','us42-equipment-owner@example.test'),
 ('42700000-0000-0000-0000-000000000002','us42-equipment-other@example.test'),
 ('42700000-0000-0000-0000-000000000003','us42-equipment-tech@example.test');
update public.profiles set role='organiser'
 where id in ('42700000-0000-0000-0000-000000000001','42700000-0000-0000-0000-000000000002');
update public.profiles set role='tech_support' where id='42700000-0000-0000-0000-000000000003';
insert into public.events(id,organiser_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('42710000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '42700000-0000-0000-0000-000000000001','approved','US42 equipment read',
 '2042-03-20 01:00+00','2042-03-20 03:00+00',10
from generate_series(1,2) n;
insert into public.venues(id,name,location,capacity,layout) values
 ('42720000-0000-0000-0000-000000000001','US42 Equipment Store','Test',100,'theatre');
insert into public.equipment_types(id,name,category,notes) values
 ('42730000-0000-0000-0000-000000000001','US42 Read Microphone','Audio','PRIVATE catalogue note');
insert into public.equipment_items(id,type_id,asset_tag,home_venue_id,current_venue_id)
select ('42740000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '42730000-0000-0000-0000-000000000001','US42-PRIVATE-ASSET-'||n,
 '42720000-0000-0000-0000-000000000001','42720000-0000-0000-0000-000000000001'
from generate_series(1,3) n;
insert into public.event_equipment_requirements(id,event_id,type_id,quantity,technical_notes,created_by)
select ('42750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '42710000-0000-0000-0000-000000000001','42730000-0000-0000-0000-000000000001',
 (array[2,3,1,1])[n],'PRIVATE technical note','42700000-0000-0000-0000-000000000003'
from generate_series(1,4) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','42700000-0000-0000-0000-000000000003',true);
select public.reserve_equipment('42750000-0000-0000-0000-000000000001',2);
select public.reserve_equipment('42750000-0000-0000-0000-000000000002',1);
select public.reserve_equipment('42750000-0000-0000-0000-000000000003',0);
select set_config('request.jwt.claim.sub','42700000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
 (select jsonb_agg(jsonb_build_array(quantity_requested,quantity_reserved,status) order by requirement_id)
 from public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000001'))
 = '[[2,2,"reserved"],[3,1,"partially_reserved"],[1,0,"unavailable"],[1,0,"pending_review"]]'::jsonb
 and (select bool_and(equipment_name='US42 Read Microphone') from public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000001')),
 'AC-042.2.1: owner sees actual full, partial, unavailable and pending equipment outcomes');

-- A changed requirement releases old units and resets to pending through existing triggers.
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.event_equipment_requirements set quantity=4 where id='42750000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','42700000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
 not exists(select 1 from public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000002'))
 and (select quantity_requested=4 and quantity_reserved=0 and status='pending_review'
 from public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000001')
 where requirement_id='42750000-0000-0000-0000-000000000001'),
 'AC-042.2.2: empty events and changed requirements do not show historical reservations');
select pg_temp.assert_true(
 not exists(select 1 from public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000001') r
 where to_jsonb(r)-array['requirement_id','equipment_name','quantity_requested','quantity_reserved','status'] <> '{}'::jsonb)
 and not exists(select 1 from public.event_equipment_requirements where event_id='42710000-0000-0000-0000-000000000001')
 and not exists(select 1 from public.equipment_booking_lines where type_id='42730000-0000-0000-0000-000000000001')
 and not exists(select 1 from public.equipment_allocations where type_id='42730000-0000-0000-0000-000000000001'),
 'AC-042.3.5: equipment response contains only permitted fields and grants no direct staff-record reads');
do $$
declare target uuid; actor text; refused boolean;
begin
 foreach target in array array[null::uuid,'42710000-0000-0000-0000-000000000099'::uuid] loop
  refused:=false;
  begin perform public.get_organiser_equipment_arrangements(target);
  exception when insufficient_privilege then refused:=true; end;
  if not refused then raise exception 'AC-042.3.6: invalid event accepted'; end if;
 end loop;
 foreach actor in array array['42700000-0000-0000-0000-000000000002','42700000-0000-0000-0000-000000000003',''] loop
  perform set_config('request.jwt.claim.sub',actor,true);
  refused:=false;
  begin perform public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000001');
  exception when insufficient_privilege then refused:=true; end;
  if not refused then raise exception 'AC-042.3.6: unauthorised caller accepted: %',actor; end if;
 end loop;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform public.get_organiser_equipment_arrangements('42710000-0000-0000-0000-000000000001');
  raise exception 'AC-042.3.6: anonymous caller accepted';
 exception when insufficient_privilege then null;
 end;
 raise notice 'PASS: AC-042.3.6: unrelated organiser, staff, signed-out, anonymous and invalid event reads refused';
end $$;
reset role;
rollback;
