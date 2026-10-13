-- US41 regression: run after arrangement_revalidation.sql and historical replay.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.layout_types(code,label) values ('classroom','Classroom') on conflict do nothing;
insert into public.venue_layouts(venue_id,layout,capacity) values ('41200000-0000-0000-0000-000000000001','classroom',150) on conflict(venue_id,layout) do update set capacity=150;
update public.venue_layouts set capacity=200 where venue_id='41200000-0000-0000-0000-000000000001' and layout='theatre';
insert into public.event_venue_requirements(event_id,layout,updated_by) values ('41100000-0000-0000-0000-000000000001','theatre','41000000-0000-0000-0000-000000000002');
insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason) values
 ('41800000-0000-0000-0000-000000000008','41100000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','{"layoutPreference":"Classroom"}','Audit layout change'),
 ('41800000-0000-0000-0000-000000000009','41100000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','{"expectedAttendance":"160"}','Audit later attendance');
set role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',false);
select pg_temp.us41_review(8,'[{"field":"layoutPreference","decision":"approved"}]');
select pg_temp.us41_review(9,'[{"field":"expectedAttendance","decision":"approved"}]');
select layout_preference,expected_attendance from public.events where id='41100000-0000-0000-0000-000000000001';
select detail from public.arrangement_review_flags where change_request_id='41800000-0000-0000-0000-000000000009';
select pg_temp.assert_true(exists(select 1 from public.arrangement_review_flags where change_request_id='41800000-0000-0000-0000-000000000009' and venue_booking_id='41300000-0000-0000-0000-000000000001' and detail like '%classroom%' and detail like '%150%'),'AC-041.3.3: successive approvals use the current layout, with later coordinator saves respected');

-- A later save of structured requirements is an explicit coordinator confirmation.
update public.event_venue_requirements set layout='theatre'
 where event_id='41100000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason) values
 ('41800000-0000-0000-0000-000000000010','41100000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','{"expectedAttendance":"170"}','Coordinator confirmed Theatre');
set role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',false);
select pg_temp.us41_review(10,'[{"field":"expectedAttendance","decision":"approved"}]');
do $$ begin
 if exists(select 1 from public.arrangement_review_flags where change_request_id='41800000-0000-0000-0000-000000000010') then
  raise exception 'Later coordinator-confirmed layout was ignored';
 end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
