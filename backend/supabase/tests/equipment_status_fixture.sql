-- Disposable database only. Persisted here so separate race sessions use the same rows.
reset role;
select set_config('request.jwt.claim.sub','',false);
create or replace function pg_temp.us27_id(kind integer,n integer) returns uuid language sql immutable as $$
 select ('a1050000-0000-0000-'||lpad(kind::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid;
$$;
insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.us27_id(1,n),'us27-status-'||n||'@example.test',jsonb_build_object('full_name','US27 Staff '||n)
from generate_series(1,9) n;
update public.profiles set role=case
 when id in (pg_temp.us27_id(1,1),pg_temp.us27_id(1,2)) then 'tech_support'
 when id=pg_temp.us27_id(1,3) then 'organiser'
 when id in (pg_temp.us27_id(1,4),pg_temp.us27_id(1,5)) then 'coordinator'
 when id=pg_temp.us27_id(1,6) then 'venue_staff'
 when id=pg_temp.us27_id(1,7) then 'coordinator_lead'
 when id=pg_temp.us27_id(1,9) then 'operations_manager' else 'attendee' end,
 client_org_id=case when id=pg_temp.us27_id(1,3) then '0c0a0000-0000-4000-8000-000000000001'::uuid end
where id in(select pg_temp.us27_id(1,n) from generate_series(1,9) n);
insert into public.venues(id,name,location,capacity,layout)
values(pg_temp.us27_id(2,1),'US27 Status Store','Test',50,'theatre');
insert into public.equipment_types(id,name,category)
select pg_temp.us27_id(3,n),'US27 Status Type '||n,'Test' from generate_series(1,4) n;
insert into public.equipment_items(id,type_id,asset_tag,home_venue_id,current_venue_id,operational_status)
select pg_temp.us27_id(4,n),pg_temp.us27_id(3,case when n>4 then 2 else n end),'US27-STATUS-'||n,
 pg_temp.us27_id(2,1),pg_temp.us27_id(2,1),case n when 5 then 'missing' when 6 then 'retired' else 'operational' end
from generate_series(1,6) n;
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,expected_attendance)
select pg_temp.us27_id(5,n),pg_temp.us27_id(1,3),case when n<>2 then pg_temp.us27_id(1,4) end,
 'US27 Status Event '||n,'Fixture',case n when 4 then 'cancelled' when 6 then 'completed' when 1 then 'confirmed' else 'planning' end,
 case n when 3 then '2020-01-01 10:00+08'::timestamptz else '2050-01-01 10:00+08'::timestamptz+n*interval '10 days' end,
 case n when 3 then '2020-01-01 11:00+08'::timestamptz else '2050-01-01 11:00+08'::timestamptz+n*interval '10 days' end,10
from generate_series(1,13) n;
insert into public.equipment_bookings(id,event_id,requested_by,use_from,use_to,status)
select pg_temp.us27_id(6,n),e.id,pg_temp.us27_id(1,4),(e.proposed_start at time zone 'Asia/Singapore')::date,
 (e.proposed_end at time zone 'Asia/Singapore')::date,case n when 7 then 'cancelled' else 'confirmed' end
from generate_series(1,10) n join public.events e on e.id=pg_temp.us27_id(5,n);
insert into public.equipment_booking_lines(id,booking_id,type_id,quantity_requested)
select pg_temp.us27_id(7,n),pg_temp.us27_id(6,n),pg_temp.us27_id(3,1),1 from generate_series(1,10) n;
insert into public.equipment_allocations(id,line_id,item_id,type_id,blocked_from,blocked_to,status,reserved_by)
select pg_temp.us27_id(8,n),pg_temp.us27_id(7,n),pg_temp.us27_id(4,1),pg_temp.us27_id(3,1),
 b.use_from-2,b.use_to,case n when 8 then 'returned' when 9 then 'cancelled' when 10 then 'checked_out' else 'reserved' end,
 pg_temp.us27_id(1,1) from generate_series(1,10) n join public.equipment_bookings b on b.id=pg_temp.us27_id(6,n);
-- Pending requirements for reservation failures and two lock-order races.
insert into public.event_equipment_requirements(id,event_id,type_id,quantity,created_by)
select pg_temp.us27_id(9,n),pg_temp.us27_id(5,n),pg_temp.us27_id(3,case n when 11 then 1 when 12 then 3 else 4 end),1,pg_temp.us27_id(1,4)
from generate_series(11,13) n;
select set_config('request.jwt.claim.sub','',false);
