-- US41 integration scenarios. Disposable database only; real approval RPC and RLS.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into auth.users(id,email) values
 ('41000000-0000-0000-0000-000000000001','us41-owner@example.test'),
 ('41000000-0000-0000-0000-000000000002','us41-coordinator@example.test'),
 ('41000000-0000-0000-0000-000000000003','us41-other@example.test');
update public.profiles set role=case when id='41000000-0000-0000-0000-000000000001' then 'organiser' else 'coordinator' end,
       client_org_id=case when id='41000000-0000-0000-0000-000000000001' then '0c0a0000-0000-4000-8000-000000000001'::uuid else null end
 where id::text like '41000000-%';
insert into public.events(id,organiser_id,coordinator_id,name,purpose,proposed_start,proposed_end,expected_attendance,layout_preference,status)
select ('41100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002',
 'US41 event','Review arrangements','2038-01-10 09:00+08','2038-01-10 11:00+08',50,'Theatre','approved'
 from generate_series(1,2) n;
insert into public.venues(id,name,location,capacity,layout,status) values
 ('41200000-0000-0000-0000-000000000001','US41 small hall','Test',100,'Theatre','active'),
 ('41200000-0000-0000-0000-000000000002','US41 large hall','Test',200,'Theatre','active');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status) values
 ('41300000-0000-0000-0000-000000000001','41100000-0000-0000-0000-000000000001','41200000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','confirmed'),
 ('41300000-0000-0000-0000-000000000002','41100000-0000-0000-0000-000000000001','41200000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002','confirmed'),
 ('41300000-0000-0000-0000-000000000003','41100000-0000-0000-0000-000000000002','41200000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','confirmed');
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_bookings b
 cross join lateral public.venue_review_cells(
 case when b.id='41300000-0000-0000-0000-000000000003' then '2038-01-20 09:00+08'::timestamptz else '2038-01-10 09:00+08'::timestamptz end,
 case when b.id='41300000-0000-0000-0000-000000000003' then '2038-01-20 11:00+08'::timestamptz else '2038-01-10 11:00+08'::timestamptz end) c
 where b.id::text like '41300000-%';
insert into public.equipment_types(id,name,category) values ('41400000-0000-0000-0000-000000000001','US41 microphone','Audio');
insert into public.equipment_items(id,type_id,asset_tag,home_venue_id,current_venue_id) values
 ('41500000-0000-0000-0000-000000000001','41400000-0000-0000-0000-000000000001','US41-MIC','41200000-0000-0000-0000-000000000001','41200000-0000-0000-0000-000000000001');
insert into public.equipment_bookings(id,event_id,requested_by,use_from,use_to,status)
select ('41600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('41100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'41000000-0000-0000-0000-000000000002',
 case n when 1 then date '2038-01-10' else date '2038-01-20' end,
 case n when 1 then date '2038-01-10' else date '2038-01-20' end,'confirmed' from generate_series(1,2) n;
insert into public.equipment_booking_lines(id,booking_id,type_id,quantity_requested)
select ('41700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('41600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'41400000-0000-0000-0000-000000000001',1 from generate_series(1,2) n;
insert into public.equipment_allocations(line_id,item_id,type_id,blocked_from,blocked_to,status,reserved_by) values
 ('41700000-0000-0000-0000-000000000001','41500000-0000-0000-0000-000000000001','41400000-0000-0000-0000-000000000001','2038-01-09','2038-01-10','reserved','41000000-0000-0000-0000-000000000002'),
 ('41700000-0000-0000-0000-000000000002','41500000-0000-0000-0000-000000000001','41400000-0000-0000-0000-000000000001','2038-01-19','2038-01-20','reserved','41000000-0000-0000-0000-000000000002');
create temp table us41_bookings as select * from public.venue_bookings;
create temp table us41_claims as select * from public.venue_slot_claims;
create temp table us41_equipment as select * from public.equipment_bookings;
create temp table us41_allocations as select * from public.equipment_allocations;
insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason)
select ('41800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '41100000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001',proposal,'US41 fixture'
from (values
 (1,'{"name":"Ordinary edit"}'::jsonb),
 (2,'{"expectedAttendance":"100"}'::jsonb),
 (3,'{"expectedAttendance":"120"}'::jsonb),
 (4,'{"proposedStart":"2038-01-20T01:00:00Z","proposedEnd":"2038-01-20T03:00:00Z"}'::jsonb),
 (5,'{"equipmentRequirements":"Two microphones","accessibilityRequirements":"Ramp"}'::jsonb),
 (6,'{"equipmentRequirements":"Rejected equipment"}'::jsonb)) f(n,proposal);
create function pg_temp.us41_review(n integer, decisions jsonb) returns text language sql as $$
 select public.review_event_change_request(('41800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 (select updated_at from public.events where id='41100000-0000-0000-0000-000000000001'),
 jsonb_build_object('action','decide','decisions',decisions));
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',false);
select pg_temp.us41_review(1,'[{"field":"name","decision":"approved"}]');
select pg_temp.us41_review(6,'[{"field":"equipmentRequirements","decision":"rejected","note":"Not needed"}]');
select pg_temp.assert_true(not exists(select 1 from public.arrangement_review_flags),
 'AC-041.5.1: ordinary approval, rejected significant changes and unapproved proposals produce no flags');
select pg_temp.us41_review(2,'[{"field":"expectedAttendance","decision":"approved"}]');
select pg_temp.assert_true(not exists(select 1 from public.arrangement_review_flags),
 'AC-041.3.1: attendance exactly at layout capacity remains suitable');
select pg_temp.us41_review(3,'[{"field":"expectedAttendance","decision":"approved"}]');
select pg_temp.assert_true((select count(*)=1 and bool_and(reason_code='venue_capacity'
 and venue_booking_id='41300000-0000-0000-0000-000000000001' and detail like '%120%' and detail like '%100%')
 from public.arrangement_review_flags),
 'AC-041.3.2: increased attendance flags only the undersized venue with its layout capacity');
select pg_temp.us41_review(4,'[{"field":"proposedStart","decision":"approved"},{"field":"proposedEnd","decision":"approved"}]');
select pg_temp.assert_true((select count(*)=5
 and count(*) filter(where reason_code='venue_time_conflict' and venue_booking_id='41300000-0000-0000-0000-000000000001')=1
 and count(*) filter(where reason_code='venue_timing_changed')=2
 and count(*) filter(where reason_code='equipment_time_conflict')=1
 and count(*) filter(where reason_code='equipment_timing_changed')=1
 from public.arrangement_review_flags where change_request_id='41800000-0000-0000-0000-000000000004'),
 'AC-041.2.1: date changes check each venue and reserved unit; free new slots require review without a false conflict');
select pg_temp.us41_review(5,'[{"field":"equipmentRequirements","decision":"approved"},{"field":"accessibilityRequirements","decision":"approved"}]');
select pg_temp.assert_true((select count(*)=3
 and count(*) filter(where reason_code='venue_accessibility_review')=2
 and count(*) filter(where reason_code='equipment_requirements_review')=1
 from public.arrangement_review_flags where change_request_id='41800000-0000-0000-0000-000000000005')
 and (select count(*)=9 from public.arrangement_review_flags),
 'AC-041.1.1: requirement changes create independent review reasons and preserve earlier reasons');
select pg_temp.assert_true((select count(*)=9 from public.arrangement_review_notifications)
 and not exists(select 1 from public.arrangement_review_flags f left join public.arrangement_review_notifications n on n.flag_id=f.id
 where n.id is null or n.recipient_id<>auth.uid() or n.detail<>f.detail),
 'AC-041.4.1: each reason has one notice addressed to the assigned coordinator with arrangement reference');
-- One resolution scenario covers authorisation, validation, both methods and duplicate prevention.
do $$
declare flag uuid;
begin
 select id into flag from public.arrangement_review_flags where reason_code='venue_capacity';
 perform set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',false);
 if exists(select 1 from public.arrangement_review_flags) or exists(select 1 from public.arrangement_review_notifications) then
  raise exception 'Unassigned coordinator can read reviews'; end if;
 begin
  perform public.resolve_arrangement_review(flag,'confirmed_valid','Reviewed');
  raise exception 'Unassigned coordinator resolved review';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',false);
 begin
  perform public.resolve_arrangement_review(flag,'confirmed_valid',' ');
  raise exception 'Blank resolution accepted';
 exception when invalid_parameter_value then null; end;
 perform public.resolve_arrangement_review(flag,'confirmed_valid','Attendance split between the two rooms; confirmed with organiser.');
 begin
  perform public.resolve_arrangement_review(flag,'corrected','Overwrite');
  raise exception 'Duplicate resolution accepted';
 exception when serialization_failure then null; end;
 select id into flag from public.arrangement_review_flags where reason_code='equipment_requirements_review';
 perform public.resolve_arrangement_review(flag,'corrected','Equipment arrangement corrected and checked.');
 if (select count(*) from public.arrangement_review_flags where status='resolved' and resolved_by=auth.uid()
 and resolved_at is not null and resolution is not null)<>2 then raise exception 'Resolution history missing'; end if;
 raise notice 'PASS: AC-041.6.1: only assigned coordinator resolves with a recorded explanation; history cannot be overwritten';
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.assert_true(
 not exists((select * from public.venue_bookings except select * from us41_bookings) union all (select * from us41_bookings except select * from public.venue_bookings))
 and not exists((select * from public.venue_slot_claims except select * from us41_claims) union all (select * from us41_claims except select * from public.venue_slot_claims))
 and not exists((select * from public.equipment_bookings except select * from us41_equipment) union all (select * from us41_equipment except select * from public.equipment_bookings))
 and not exists((select * from public.equipment_allocations except select * from us41_allocations) union all (select * from us41_allocations except select * from public.equipment_allocations)),
 'AC-041.1.2: approval and flag resolution never mutate bookings, reserved slots or equipment allocations');
-- Force a notice-write failure to verify atomic approval, not a silent partial success.
insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason) values
 ('41800000-0000-0000-0000-000000000007','41100000-0000-0000-0000-000000000001',
 '41000000-0000-0000-0000-000000000001','{"equipmentRequirements":"Atomic rollback fixture"}','Rollback fixture');
create function pg_temp.us41_notice_failure() returns trigger language plpgsql as $$
begin raise exception 'Simulated notification write failure'; end $$;
create trigger us41_notice_failure before insert on public.arrangement_review_notifications
 for each row execute function pg_temp.us41_notice_failure();
set role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',false);
do $$
begin
 begin
  perform pg_temp.us41_review(7,'[{"field":"equipmentRequirements","decision":"approved"}]');
  raise exception 'Expected notice write to fail' using errcode='P4101';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'Simulated notification write failure' then raise; end if;
 end;
 if exists(select 1 from public.arrangement_review_flags where change_request_id='41800000-0000-0000-0000-000000000007')
 or exists(select 1 from public.event_change_revalidations where change_request_id='41800000-0000-0000-0000-000000000007')
 or not exists(select 1 from public.events where id='41100000-0000-0000-0000-000000000001' and equipment_requirements='Two microphones')
 or not exists(select 1 from public.event_change_requests where id='41800000-0000-0000-0000-000000000007' and status='submitted') then
  raise exception 'Approval was only partially rolled back';
 end if;
 raise notice 'PASS: AC-041.1.4: failed notification rolls back approved values, request decision, flags and queue';
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
drop trigger us41_notice_failure on public.arrangement_review_notifications;
create temp table us41_flags_replay as select * from public.arrangement_review_flags;
create temp table us41_notices_replay as select * from public.arrangement_review_notifications;
