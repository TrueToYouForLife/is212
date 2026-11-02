-- US41 populated replay fixture; disposable database only, no live Auth session.
reset role;
select set_config('request.jwt.claim.sub','',false);
create function pg_temp.us41_replay_assert(ok boolean) returns void language plpgsql as $$
begin
 if ok is distinct from true then
  raise exception 'FAIL: AC-041.1.3: replay changed populated reviews or notifications';
 end if;
 raise notice 'PASS: AC-041.1.3: replay preserves open reasons, resolved history and exact notifications without duplicates';
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('41910000-0000-0000-0000-000000000001','us41-replay-owner@example.test','{"full_name":"US41 Replay Owner"}'),
 ('41910000-0000-0000-0000-000000000002','us41-replay-coordinator@example.test','{"full_name":"US41 Replay Coordinator"}');
update public.profiles set role='organiser',client_org_id='0c0a0000-0000-4000-8000-000000000001'
 where id='41910000-0000-0000-0000-000000000001';
update public.profiles set role='coordinator' where id='41910000-0000-0000-0000-000000000002';
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,
 proposed_start,proposed_end,expected_attendance)
values('41920000-0000-0000-0000-000000000001','41910000-0000-0000-0000-000000000001',
 '41910000-0000-0000-0000-000000000002','US41 replay fixture','Preserve reviews','approved',
 '2045-01-10 09:00+08','2045-01-10 11:00+08',50);
insert into public.venues(id,name,location,capacity,layout)
values('41930000-0000-0000-0000-000000000001','US41 Replay Hall','Test',100,'theatre');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
values('41940000-0000-0000-0000-000000000001','41920000-0000-0000-0000-000000000001',
 '41930000-0000-0000-0000-000000000001','41910000-0000-0000-0000-000000000002','confirmed');
insert into public.equipment_bookings(id,event_id,requested_by,use_from,use_to,status)
values('41950000-0000-0000-0000-000000000001','41920000-0000-0000-0000-000000000001',
 '41910000-0000-0000-0000-000000000002','2045-01-10','2045-01-10','confirmed');
insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason)
values('41960000-0000-0000-0000-000000000001','41920000-0000-0000-0000-000000000001',
 '41910000-0000-0000-0000-000000000001','{"name":"Replay fixture change"}','Replay preservation fixture');

-- Seed valid independent reasons through the protected producer as administrator.
-- This case tests migration preservation, not change-approval/revalidation behaviour.
select public.record_arrangement_review('41960000-0000-0000-0000-000000000001',
 '41920000-0000-0000-0000-000000000001','41940000-0000-0000-0000-000000000001',null,
 'venue_capacity','Replay capacity reason');
select public.record_arrangement_review('41960000-0000-0000-0000-000000000001',
 '41920000-0000-0000-0000-000000000001','41940000-0000-0000-0000-000000000001',null,
 'venue_timing_changed','Replay independent timing reason');
select public.record_arrangement_review('41960000-0000-0000-0000-000000000001',
 '41920000-0000-0000-0000-000000000001',null,'41950000-0000-0000-0000-000000000001',
 'equipment_requirements_review','Replay equipment reason');
set role authenticated;
select set_config('request.jwt.claim.sub','41910000-0000-0000-0000-000000000002',false);
select public.resolve_arrangement_review(id,'confirmed_valid','Capacity checked with the organiser')
 from public.arrangement_review_flags where change_request_id='41960000-0000-0000-0000-000000000001'
 and reason_code='venue_capacity';
select public.resolve_arrangement_review(id,'corrected','Equipment arrangement corrected')
 from public.arrangement_review_flags where change_request_id='41960000-0000-0000-0000-000000000001'
 and reason_code='equipment_requirements_review';
reset role;
select set_config('request.jwt.claim.sub','',false);

-- A vacuous empty snapshot or RLS-filtered comparison must never pass.
do $$ begin
 if (select count(*) from public.arrangement_review_flags
     where change_request_id='41960000-0000-0000-0000-000000000001')<>3
 or (select count(*) from public.arrangement_review_flags
     where change_request_id='41960000-0000-0000-0000-000000000001' and status='open')<>1
 or (select count(*) from public.arrangement_review_flags
     where change_request_id='41960000-0000-0000-0000-000000000001' and status='resolved'
     and resolved_by='41910000-0000-0000-0000-000000000002'
     and resolved_at is not null and resolution is not null)<>2
 or (select count(*) from public.arrangement_review_notifications
     where event_id='41920000-0000-0000-0000-000000000001'
     and recipient_id='41910000-0000-0000-0000-000000000002')<>3 then
  raise exception 'US41 replay fixture must contain three notified reasons, one open and two resolved';
 end if;
end $$;
create temp table us41_replay_flags_before as select * from public.arrangement_review_flags;
create temp table us41_replay_notices_before as select * from public.arrangement_review_notifications;
