-- US27 PR1: real PostgreSQL permissions and read projection; simulated Auth claims.
begin;
reset role;
select set_config('request.jwt.claim.sub','',true);
create or replace function pg_temp.us27_assert(ok boolean,label text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;

insert into auth.users(id,email) values
 ('a1040000-0000-0000-0000-000000000001','us27-tech@example.test'),
 ('a1040000-0000-0000-0000-000000000002','us27-coordinator@example.test'),
 ('a1040000-0000-0000-0000-000000000003','us27-organiser@example.test'),
 ('a1040000-0000-0000-0000-000000000004','us27-attendee@example.test'),
 ('a1040000-0000-0000-0000-000000000005','us27-venue@example.test'),
 ('a1040000-0000-0000-0000-000000000006','us27-lead@example.test'),
 ('a1040000-0000-0000-0000-000000000007','us27-manager@example.test');
update public.profiles set role=case right(id::text,1)
 when '1' then 'tech_support' when '2' then 'coordinator' when '3' then 'organiser'
 when '4' then 'attendee' when '5' then 'venue_staff' when '6' then 'coordinator_lead'
 else 'operations_manager' end,
 client_org_id=case when right(id::text,1)='3' then '0c0a0000-0000-4000-8000-000000000001'::uuid else null end
where id::text like 'a1040000-%';
insert into public.venues(id,name,location,capacity,layout) values
 ('a1041000-0000-0000-0000-000000000001','US27 Store','Level 1',20,'theatre'),
 ('a1041000-0000-0000-0000-000000000002','US27 Hall','Level 2',50,'theatre');
insert into public.equipment_types(id,name,category,notes) values
 ('a1042000-0000-0000-0000-000000000001','US27 Projector','Video','HDMI projector'),
 ('a1042000-0000-0000-0000-000000000002','US27 Speaker','Audio',null);
insert into public.equipment_items(id,type_id,asset_tag,home_venue_id,current_venue_id,operational_status)
select ('a1043000-0000-0000-0000-00000000000'||n)::uuid,
 'a1042000-0000-0000-0000-000000000001','US27-P-'||n,'a1041000-0000-0000-0000-000000000001',
 case when n=1 then 'a1041000-0000-0000-0000-000000000002'::uuid else 'a1041000-0000-0000-0000-000000000001'::uuid end,s
from unnest(array['operational','needs_repair','under_repair','retired','missing']) with ordinality t(s,n);

-- Operational stock remains usable even when already reserved for a particular window.
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,expected_attendance)
values('a1044000-0000-0000-0000-000000000001','a1040000-0000-0000-0000-000000000003',
 'a1040000-0000-0000-0000-000000000002','US27 Event','Fixture','planning','2050-01-02 09:00+08','2050-01-02 10:00+08',10);
insert into public.equipment_bookings(id,event_id,requested_by,use_from,use_to)
values('a1045000-0000-0000-0000-000000000001','a1044000-0000-0000-0000-000000000001',
 'a1040000-0000-0000-0000-000000000002','2050-01-02','2050-01-02');
insert into public.equipment_booking_lines(id,booking_id,type_id,quantity_requested)
values('a1046000-0000-0000-0000-000000000001','a1045000-0000-0000-0000-000000000001','a1042000-0000-0000-0000-000000000001',1);
insert into public.equipment_allocations(line_id,item_id,type_id,blocked_from,blocked_to,reserved_by)
values('a1046000-0000-0000-0000-000000000001','a1043000-0000-0000-0000-000000000001',
 'a1042000-0000-0000-0000-000000000001','2050-01-01','2050-01-02','a1040000-0000-0000-0000-000000000001');
create temp table us27_before as select
 (select jsonb_agg(to_jsonb(i) order by id) from public.equipment_items i) as items,
 (select jsonb_agg(to_jsonb(b) order by id) from public.equipment_bookings b) as bookings,
 (select jsonb_agg(to_jsonb(a) order by id) from public.equipment_allocations a) as allocations;

-- Expected values come from the requirement/fixture, independently of the RPC query.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1040000-0000-0000-0000-000000000001',true);
select pg_temp.us27_assert(
 (select count(*)=5 from jsonb_array_elements(public.get_equipment_catalogue()->'units') u where u->>'typeId'='a1042000-0000-0000-0000-000000000001')
 and (select u=jsonb_build_object('id','a1043000-0000-0000-0000-000000000001','typeId','a1042000-0000-0000-0000-000000000001',
 'assetTag','US27-P-1','locationId','a1041000-0000-0000-0000-000000000002','locationName','US27 Hall','locationDescription','Level 2','status','operational')
 from jsonb_array_elements(public.get_equipment_catalogue()->'units') u where u->>'assetTag'='US27-P-1')
 and (select t->>'description'='HDMI projector' from jsonb_array_elements(public.get_equipment_catalogue()->'types') t where t->>'name'='US27 Projector'),
 'AC-027.1.1: Technical Support sees every unit, type description, current rather than home location and bounded fields');
select pg_temp.us27_assert(
 (select (t->>'totalUnits')::int=5 and (t->>'usableUnits')::int=1 from jsonb_array_elements(public.get_equipment_catalogue()->'types') t where t->>'name'='US27 Projector')
 and (select (t->>'totalUnits')::int=0 and (t->>'usableUnits')::int=0 and t->'description'='null'::jsonb from jsonb_array_elements(public.get_equipment_catalogue()->'types') t where t->>'name'='US27 Speaker'),
 'AC-027.2.1: only Operational is usable; damaged, maintenance, retired and missing units remain in totals; zero stock stays visible');

select set_config('request.jwt.claim.sub','a1040000-0000-0000-0000-000000000002',true);
select pg_temp.us27_assert(
 (select count(*)=5 from jsonb_array_elements(public.get_equipment_catalogue()->'units') u where u->>'typeId'='a1042000-0000-0000-0000-000000000001')
 and not has_function_privilege('anon','public.get_equipment_catalogue()','execute'),
 'AC-027.4.1: Coordinator sees the catalogue, anonymous access and all other roles are refused without widening unit writes');
do $$ declare person uuid; begin
 -- The catalogue grants no Coordinator table writes or direct unit reads.
 if exists(select 1 from public.equipment_items where asset_tag like 'US27-P-%') then raise exception 'Coordinator received direct unit access'; end if;
 begin
  insert into public.equipment_items(type_id,asset_tag,home_venue_id,current_venue_id)
  values('a1042000-0000-0000-0000-000000000001','US27-FORBIDDEN','a1041000-0000-0000-0000-000000000001','a1041000-0000-0000-0000-000000000001');
  raise exception 'Coordinator inserted a unit';
 exception when insufficient_privilege then null; end;
 foreach person in array array[
  'a1040000-0000-0000-0000-000000000003'::uuid,'a1040000-0000-0000-0000-000000000004'::uuid,
  'a1040000-0000-0000-0000-000000000005'::uuid,'a1040000-0000-0000-0000-000000000006'::uuid,
  'a1040000-0000-0000-0000-000000000007'::uuid,null::uuid] loop
  perform set_config('request.jwt.claim.sub',coalesce(person::text,''),true);
  begin perform public.get_equipment_catalogue(); raise exception 'Forbidden role read catalogue';
  exception when insufficient_privilege then null; end;
 end loop;
end $$;
reset role;
select pg_temp.us27_assert((select
 items is not distinct from (select jsonb_agg(to_jsonb(i) order by id) from public.equipment_items i)
 and bookings is not distinct from (select jsonb_agg(to_jsonb(b) order by id) from public.equipment_bookings b)
 and allocations is not distinct from (select jsonb_agg(to_jsonb(a) order by id) from public.equipment_allocations a)
 from us27_before),
 'AC-027.4.1: denied reads and writes leave the original units intact');
rollback;
