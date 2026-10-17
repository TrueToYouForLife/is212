-- US20 Slice 1. Real RPC, permissions and atomic audit/arrangement integration.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into auth.users(id,email,raw_user_meta_data) values
 ('20010000-0000-0000-0000-000000000001','us20-owner@example.test','{"full_name":"Owner"}'),
 ('20010000-0000-0000-0000-000000000002','us20-coordinator@example.test','{"full_name":"Planning Coordinator"}'),
 ('20010000-0000-0000-0000-000000000003','us20-other@example.test','{}');
update public.profiles set role=case when id='20010000-0000-0000-0000-000000000001' then 'organiser' else 'coordinator' end
 where id::text like '20010000-%';
insert into public.events(id,organiser_id,coordinator_id,name,purpose,proposed_start,proposed_end,expected_attendance,layout_preference,status)
select ('20020000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '20010000-0000-0000-0000-000000000001',case when s='draft' then null else '20010000-0000-0000-0000-000000000002'::uuid end,
 'Planning event','Workshop','2038-01-10 09:00+08','2038-01-10 11:00+08',50,'theatre',s
 from (values(1,'approved'),(2,'planning'),(3,'confirmed'),(4,'completed'),(5,'cancelled'),(6,'draft'),(7,'submitted'),(8,'under_review'),(9,'rejected')) v(n,s);
create function pg_temp.us20_edit(n integer,patch jsonb,version text default null) returns uuid language sql as $$
 select public.update_event_planning(('20020000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 coalesce(version,public.get_event_planning(('20020000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid)->>'version'),patch);
$$;
create function pg_temp.us20_refused(n integer,patch jsonb,code text,version text default null) returns boolean language plpgsql as $$
begin
 perform pg_temp.us20_edit(n,patch,version);
 return false;
exception when others then return sqlstate=code;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000002',false);
select pg_temp.us20_edit(1,'{"name":" Updated name ","programme":"Welcome","description":"New description"}');
select pg_temp.us20_edit(2,'{"purpose":"Planning workshop","expectedAttendance":1}');
select pg_temp.assert_true((select name='Updated name' and status='approved' and not registration_required from public.events where id='20020000-0000-0000-0000-000000000001')
 and (select purpose='Planning workshop' and expected_attendance=1 from public.events where id='20020000-0000-0000-0000-000000000002'),
 'AC-020.1.1: assigned coordinator edits approved/planning events and minimum attendance without changing lifecycle');
select pg_temp.assert_true((select bool_and(pg_temp.us20_refused(n,'{"name":"Forbidden"}',case when n=6 then '42501' else '22000' end)) from generate_series(3,9) n),
 'AC-020.1.2: every other event state refuses planning edits');
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"status":"confirmed"}','22023')
 and pg_temp.us20_refused(1,'{"registrationRequired":true}','22023')
 and pg_temp.us20_refused(1,'{"coordinator_id":"20010000-0000-0000-0000-000000000003"}','22023'),
 'AC-020.1.3: protected fields cannot be smuggled into an edit');
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"name":"Stale overwrite"}','40001','old-version'),
 'AC-020.1.4: stale versions cannot overwrite newer data');
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"purpose":" "}','22023')
 and pg_temp.us20_refused(1,'{"expectedAttendance":0}','22023')
 and pg_temp.us20_refused(1,'{"expectedAttendance":1.5}','22023')
 and pg_temp.us20_refused(1,'{"proposedEnd":"2038-01-10T01:00:00Z"}','22023')
 and pg_temp.us20_refused(1,'{"proposedStart":"2000-01-01T00:00:00Z"}','22023'),
 'AC-020.1.5: empty purpose, invalid attendance and non-future or empty intervals are refused');
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"facilityRequirements":"wifi"}','22023')
 and pg_temp.us20_refused(1,'{"accessibilityRequirements":[true]}','22023'),
 'AC-020.1.6: structured requirements cannot be replaced with free text or non-string codes');
do $$ begin
 begin perform pg_temp.us20_edit(1,'{"name":"Must roll back","layoutPreference":"not_a_layout"}');
  raise exception 'Unknown catalogue code accepted';
 exception when check_violation or invalid_parameter_value or foreign_key_violation then null; end;
end $$;
select pg_temp.assert_true((select name='Updated name' from public.events where id='20020000-0000-0000-0000-000000000001')
 and (select count(*)=2 from public.event_planning_updates),
 'AC-020.1.7: catalogue validation rolls back the whole edit and leaves no audit record');
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"name":"Other coordinator"}','42501')
 and not exists(select 1 from public.event_planning_updates),
 'AC-020.1.8: unassigned coordinator cannot edit or read planning history');
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"name":"Owner edit"}','42501'),
 'AC-020.1.9: owning organiser cannot use the coordinator edit route');
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000002',false);
do $$ begin
 begin update public.events set name='Direct bypass' where id='20020000-0000-0000-0000-000000000001';
  raise exception 'Direct write allowed';
 exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert_true((select name='Updated name' from public.events where id='20020000-0000-0000-0000-000000000001'),
 'AC-020.1.10: direct browser writes remain blocked');

reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.venues(id,name,location,capacity,layout,status) values
 ('20030000-0000-0000-0000-000000000001','US20 hall','Test',100,'Theatre','active');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status) values
 ('20040000-0000-0000-0000-000000000001','20020000-0000-0000-0000-000000000001','20030000-0000-0000-0000-000000000001','20010000-0000-0000-0000-000000000002','confirmed');
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select '20030000-0000-0000-0000-000000000001',c.slot_date,c.slot,c.kind,'20040000-0000-0000-0000-000000000001'
 from public.venue_review_cells('2038-01-10 09:00+08','2038-01-10 11:00+08') c;
create temp table us20_claims_before as select * from public.venue_slot_claims;
create temp table us20_bookings_before as select * from public.venue_bookings;
set role authenticated;
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000002',false);
select pg_temp.us20_edit(1,'{"expectedAttendance":120,"facilityRequirements":["wifi"],"accessibilityRequirements":["wheelchair_access"]}');
select pg_temp.us20_edit(1,'{"proposedStart":"2038-01-11T01:00:00Z","proposedEnd":"2038-01-11T03:00:00Z"}');
select pg_temp.assert_true((select count(*)=4 and bool_and(change_request_id is null and planning_update_id is not null)
 from public.arrangement_review_flags where event_id='20020000-0000-0000-0000-000000000001')
 and not exists(select 1 from public.event_change_requests where event_id='20020000-0000-0000-0000-000000000001'),
 'AC-020.1.11: capacity, facilities, accessibility and timing edits create source-linked arrangement reviews without fake organiser requests');
reset role;
select pg_temp.assert_true(not exists((select * from public.venue_slot_claims except select * from us20_claims_before)
 union all(select * from us20_claims_before except select * from public.venue_slot_claims))
 and not exists((select * from public.venue_bookings except select * from us20_bookings_before)
 union all(select * from us20_bookings_before except select * from public.venue_bookings)),
 'AC-020.1.12: significant edits preserve bookings and their reserved slots');

select set_config('request.jwt.claim.sub','',false);
insert into public.equipment_types(id,name,category,code) values
 ('20050000-0000-0000-0000-000000000001','US20 microphone','Audio','us20_microphone');
insert into public.equipment_items(id,type_id,asset_tag,home_venue_id,current_venue_id) values
 ('20060000-0000-0000-0000-000000000001','20050000-0000-0000-0000-000000000001','US20-MIC','20030000-0000-0000-0000-000000000001','20030000-0000-0000-0000-000000000001');
insert into public.equipment_bookings(id,event_id,requested_by,use_from,use_to,status) values
 ('20070000-0000-0000-0000-000000000001','20020000-0000-0000-0000-000000000001','20010000-0000-0000-0000-000000000002','2038-01-11','2038-01-11','confirmed');
insert into public.equipment_booking_lines(id,booking_id,type_id,quantity_requested) values
 ('20080000-0000-0000-0000-000000000001','20070000-0000-0000-0000-000000000001','20050000-0000-0000-0000-000000000001',1);
insert into public.equipment_allocations(line_id,item_id,type_id,blocked_from,blocked_to,status,reserved_by) values
 ('20080000-0000-0000-0000-000000000001','20060000-0000-0000-0000-000000000001','20050000-0000-0000-0000-000000000001','2038-01-10','2038-01-11','reserved','20010000-0000-0000-0000-000000000002');
create temp table us20_allocations_before as select * from public.equipment_allocations;
set role authenticated;
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000002',false);
select pg_temp.us20_edit(1,'{"proposedStart":"2038-01-12T01:00:00Z","proposedEnd":"2038-01-12T03:00:00Z","equipmentRequirements":["us20_microphone"]}');
select pg_temp.assert_true((select count(*)=2 and bool_and(reason_code in ('equipment_timing_changed','equipment_requirements_review'))
 from public.arrangement_review_flags where equipment_booking_id='20070000-0000-0000-0000-000000000001'),
 'AC-020.1.13: timing and structured equipment changes flag existing equipment reservations');
reset role;
select pg_temp.assert_true(not exists((select * from public.equipment_allocations except select * from us20_allocations_before)
 union all(select * from us20_allocations_before except select * from public.equipment_allocations)),
 'AC-020.1.14: equipment allocations are not moved or released by planning edits');
-- Force an audit-storage failure and prove that event data cannot commit alone.
create function pg_temp.us20_fail_audit() returns trigger language plpgsql as $$
begin raise exception 'Simulated audit storage failure'; end $$;
create trigger us20_fail_audit before insert on public.event_planning_updates
 for each row execute function pg_temp.us20_fail_audit();
set role authenticated;
select pg_temp.assert_true(pg_temp.us20_refused(1,'{"name":"Unrecorded edit"}','P0001')
 and (select name='Updated name' from public.events where id='20020000-0000-0000-0000-000000000001'),
 'AC-020.1.15: audit failure rolls back the event edit atomically');
reset role;
drop trigger us20_fail_audit on public.event_planning_updates;
select pg_temp.assert_true(not has_function_privilege('anon','public.update_event_planning(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.revalidate_event_arrangements(uuid,text[],boolean,boolean,uuid,uuid)','EXECUTE'),
 'AC-020.1.16: anonymous writes and direct calls to internal review helpers are forbidden');

insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason) values
 ('20090000-0000-0000-0000-000000000001','20020000-0000-0000-0000-000000000001',
 '20010000-0000-0000-0000-000000000001',
 '{"accessibilityRequirements":["hearing_loop"],"facilityRequirements":["stage"],"equipmentRequirements":[]}',
 'Organiser requests revised requirements');
set role authenticated;
select public.review_event_change_request('20090000-0000-0000-0000-000000000001',
 (select updated_at from public.events where id='20020000-0000-0000-0000-000000000001'),
 '{"action":"decide","decisions":[{"field":"accessibilityRequirements","decision":"approved"},{"field":"facilityRequirements","decision":"approved"},{"field":"equipmentRequirements","decision":"approved"}]}');
select pg_temp.assert_true((select count(*)=3 and bool_and(planning_update_id is null)
 from public.arrangement_review_flags where change_request_id='20090000-0000-0000-0000-000000000001'),
 'AC-020.1.18: existing organiser approval still records independent source-linked reviews with structured requirements');

set role authenticated;
select set_config('request.jwt.claim.sub','20010000-0000-0000-0000-000000000002',false);
select pg_temp.assert_true((public.get_event_planning('20020000-0000-0000-0000-000000000001')->'history'->0->'changes'->'name')
 ='{"before":"Planning event","after":"Updated name"}'::jsonb
 and (select bool_and(changed_by=auth.uid() and changed_by_name='Planning Coordinator') from public.event_planning_updates),
 'AC-020.2.1: audit stores original and new values with server-derived actor and chronological history');
select pg_temp.assert_true(pg_temp.us20_edit(1,'{"name":"Updated name"}') is null
 and (select count(*)=5 from public.event_planning_updates),
 'AC-020.2.2: an unchanged save creates no extra history');
do $$ begin
 begin delete from public.event_planning_updates;
  raise exception 'History deletion allowed';
 exception when insufficient_privilege then null; end;
 begin update public.event_planning_updates set changed_by_name='Forged';
  raise exception 'History mutation allowed';
 exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert_true((select count(*)=5 from public.event_planning_updates),
 'AC-020.2.3: authenticated users cannot rewrite or delete audit evidence');
reset role;
select set_config('request.jwt.claim.sub','',false);
create temp table us20_history_before_replay as select * from public.event_planning_updates;
