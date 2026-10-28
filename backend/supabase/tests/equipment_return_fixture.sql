-- US24 fixtures for disposable databases only; races use these committed rows.
reset role;
select set_config('request.jwt.claim.sub','',false);
create or replace function pg_temp.us24_id(k integer,n integer) returns uuid language sql immutable as $$
 select ('a1120000-0000-0000-'||lpad(k::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid;
$$;
insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.us24_id(1,n),'us24-'||n||'@example.test',jsonb_build_object('full_name','US24 Staff '||n)
from generate_series(1,9)n;
update public.profiles set role=case
 when id in(pg_temp.us24_id(1,1),pg_temp.us24_id(1,2)) then 'tech_support'
 when id=pg_temp.us24_id(1,3) then 'organiser'
 when id=pg_temp.us24_id(1,4) then 'coordinator'
 when id=pg_temp.us24_id(1,5) then 'venue_staff'
 when id=pg_temp.us24_id(1,6) then 'coordinator_lead'
 when id=pg_temp.us24_id(1,7) then 'operations_manager'
 when id=pg_temp.us24_id(1,8) then 'safety_officer' else 'attendee' end,
 client_org_id=case when id=pg_temp.us24_id(1,3) then '0c0a0000-0000-4000-8000-000000000001'::uuid end
where id in(select pg_temp.us24_id(1,n) from generate_series(1,9)n);
insert into public.venues(id,name,location,capacity,layout)
values(pg_temp.us24_id(2,1),'US24 Store','Test',50,'theatre');
insert into public.equipment_types(id,name,category)
select pg_temp.us24_id(3,n),'US24 Type '||n,'Test' from generate_series(1,13)n;
insert into public.equipment_items(id,type_id,asset_tag,home_venue_id,current_venue_id,operational_status)
select pg_temp.us24_id(4,n),pg_temp.us24_id(3,n),'US24-'||n,pg_temp.us24_id(2,1),pg_temp.us24_id(2,1),
 case n when 7 then 'needs_repair' when 8 then 'retired' else 'operational' end from generate_series(1,13)n;
create temp table us24_dates as
select n,(statement_timestamp() at time zone 'Asia/Singapore')::date+
 case n when 3 then 0 when 4 then 4 when 9 then -10 when 12 then 10 else -3 end as first_day,
 (statement_timestamp() at time zone 'Asia/Singapore')::date+
 case n when 3 then 0 when 4 then 5 when 9 then -8 when 12 then 12 else -1 end as return_day
from generate_series(1,13)n;
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,expected_attendance)
select pg_temp.us24_id(5,n),pg_temp.us24_id(1,3),pg_temp.us24_id(1,4),'US24 Event '||n,'Return fixture',
 case when n in(4,12) then 'planning' else 'completed' end,
 (first_day+time '10:00') at time zone 'Asia/Singapore',
 (return_day+time '12:00') at time zone 'Asia/Singapore',10 from us24_dates;
insert into public.equipment_bookings(id,event_id,requested_by,use_from,use_to,status)
select pg_temp.us24_id(6,n),pg_temp.us24_id(5,n),pg_temp.us24_id(1,4),first_day,return_day,'confirmed' from us24_dates;
insert into public.equipment_booking_lines(id,booking_id,type_id,quantity_requested)
select pg_temp.us24_id(7,n),pg_temp.us24_id(6,n),pg_temp.us24_id(3,case when n in(9,12) then 2 else n end),1 from us24_dates;
insert into public.equipment_allocations(id,line_id,item_id,type_id,blocked_from,blocked_to,status,reserved_by)
select pg_temp.us24_id(8,n),pg_temp.us24_id(7,n),pg_temp.us24_id(4,case when n in(9,12) then 2 else n end),
 pg_temp.us24_id(3,case when n in(9,12) then 2 else n end),first_day,return_day,
 case n when 5 then 'cancelled' when 7 then 'returned' when 6 then 'checked_out' else 'reserved' end,pg_temp.us24_id(1,1)
from us24_dates;
-- A future request for type 2 can test actual reservation rejection after damage.
insert into public.event_equipment_requirements(id,event_id,type_id,quantity,created_by)
values(pg_temp.us24_id(9,1),pg_temp.us24_id(5,4),pg_temp.us24_id(3,2),1,pg_temp.us24_id(1,4)),
 (pg_temp.us24_id(9,2),pg_temp.us24_id(5,4),pg_temp.us24_id(3,13),1,pg_temp.us24_id(1,4));

-- Retained pre-US24 report and an independent review must survive inspection.
insert into public.equipment_defect_reports(id,item_id,allocation_id,reported_by,kind,description,resulting_status)
values(pg_temp.us24_id(10,1),pg_temp.us24_id(4,7),pg_temp.us24_id(8,7),pg_temp.us24_id(1,1),'defect','Historical defect','needs_repair');
insert into public.event_planning_updates(id,event_id,changed_by,changed_by_name,changes)
values(pg_temp.us24_id(11,1),pg_temp.us24_id(5,12),pg_temp.us24_id(1,4),'US24 Coordinator',
 '{"equipmentRequirements":{"from":[],"to":["projector"]}}');
insert into public.arrangement_review_flags(id,planning_update_id,event_id,equipment_booking_id,reason_code,detail)
values(pg_temp.us24_id(12,1),pg_temp.us24_id(11,1),pg_temp.us24_id(5,12),pg_temp.us24_id(6,12),
 'equipment_requirements_review','Independent requirement review');
-- The rollback injection must unwind newly created reviews/notices as well as status.
insert into public.equipment_booking_lines(id,booking_id,type_id,quantity_requested)
values(pg_temp.us24_id(7,15),pg_temp.us24_id(6,12),pg_temp.us24_id(3,11),1);
insert into public.equipment_allocations(id,line_id,item_id,type_id,blocked_from,blocked_to,status,reserved_by)
select pg_temp.us24_id(8,15),pg_temp.us24_id(7,15),pg_temp.us24_id(4,11),pg_temp.us24_id(3,11),
 first_day,return_day,'reserved',pg_temp.us24_id(1,1) from us24_dates where n=12;
