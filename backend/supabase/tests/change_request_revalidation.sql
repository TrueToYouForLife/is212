-- Disposable runner only. Tests the hook via the real review RPC and browser roles.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.events (id,organiser_id,coordinator_id,purpose,name,proposed_start,proposed_end,expected_attendance,status)
values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000003','Revalidation fixture','Original','2035-01-01 01:00+00','2035-01-01 03:00+00',10,'submitted');
insert into public.event_change_requests (id,event_id,organiser_id,proposed_changes,reason)
select ('70000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',proposal,'Revalidation test'
from (values
 (1,'{"name":"Edited name"}'::jsonb),
 (2,'{"equipmentRequirements":"Projector"}'::jsonb),
 (3,'{"name":"Another name","equipmentRequirements":"Projector"}'::jsonb),
 (4,'{"expectedAttendance":"80","name":"Provisional title"}'::jsonb),
 (5,'{"equipmentRequirements":""}'::jsonb),
 (6,'{"layoutPreference":"Theatre","accessibilityRequirements":"Ramp"}'::jsonb),
 (7,'{"expectedAttendance":"80"}'::jsonb),
 (8,'{"proposedStart":"2035-01-01T01:30:00Z","proposedEnd":"2035-01-01T02:30:00Z"}'::jsonb),
 (9,'{"equipmentRequirements":"Must roll back"}'::jsonb)
) as fixtures(n,proposal);
create function pg_temp.revalidation_review(n integer, decisions jsonb) returns text language sql as $$
 select public.review_event_change_request(
 ('70000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 (select updated_at from public.events where id='60000000-0000-0000-0000-000000000001'),
 jsonb_build_object('action','decide','decisions',decisions));
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where event_id='60000000-0000-0000-0000-000000000001'),
 'AC-007.12.1: submitting significant requests does not queue revalidation before approval');
select pg_temp.revalidation_review(1,'[{"field":"name","decision":"approved"}]');
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000001'),
 'AC-007.12.2: approving ordinary edits does not queue revalidation');
select pg_temp.revalidation_review(2,'[{"field":"equipmentRequirements","decision":"rejected","note":"Keep existing"}]');
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000002'),
 'AC-007.12.3: rejecting a significant request does not queue revalidation');
select pg_temp.revalidation_review(3,'[{"field":"name","decision":"approved"},{"field":"equipmentRequirements","decision":"rejected","note":"Keep existing"}]');
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000003'),
 'AC-007.12.4: partial approval of ordinary fields does not queue rejected significant fields');
select pg_temp.revalidation_review(4,'[{"field":"expectedAttendance","decision":"approved"},{"field":"name","decision":"clarification_requested","note":"Which title?"}]');
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000004'),
 'AC-007.12.5: provisional approval while clarification is outstanding does not queue work');
select pg_temp.revalidation_review(5,'[{"field":"equipmentRequirements","decision":"approved"}]');
select pg_temp.assert_true((select equipment_required and not venue_required and status='pending'
 and approved_fields=array['equipmentRequirements'] and created_by=auth.uid() and created_at is not null
 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000005'),
 'AC-007.12.6: removing an equipment requirement queues equipment-only work with actor and time');
select pg_temp.revalidation_review(6,'[{"field":"layoutPreference","decision":"approved"},{"field":"accessibilityRequirements","decision":"approved"}]');
select pg_temp.assert_true((select venue_required and not equipment_required
 and approved_fields=array['accessibilityRequirements','layoutPreference'] from public.event_change_revalidations
 where change_request_id='70000000-0000-0000-0000-000000000006'),
 'AC-007.12.7: approved layout and accessibility changes queue venue-only work');
select pg_temp.revalidation_review(7,'[{"field":"expectedAttendance","decision":"approved"}]');
select pg_temp.assert_true((select venue_required and equipment_required from public.event_change_revalidations
 where change_request_id='70000000-0000-0000-0000-000000000007'),
 'AC-007.12.8: approved attendance changes flag both arrangements for reconsideration');
select pg_temp.revalidation_review(8,'[{"field":"proposedStart","decision":"approved"},{"field":"proposedEnd","decision":"approved"}]');
select pg_temp.assert_true((select venue_required and equipment_required and approved_fields=array['proposedEnd','proposedStart']
 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000008'),
 'AC-007.12.9: approved date-time changes flag both arrangements');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where event_id='60000000-0000-0000-0000-000000000001'),
 'AC-007.12.10: another coordinator cannot read the assigned event revalidation queue');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(not exists(select 1 from public.event_change_revalidations where event_id='60000000-0000-0000-0000-000000000001'),
 'AC-007.12.11: organiser cannot read the internal arrangement queue');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select pg_temp.assert_true((select count(*)=4 from public.event_change_revalidations where event_id='60000000-0000-0000-0000-000000000001'),
 'AC-007.12.12: operations manager can read queued arrangement checks');
select pg_temp.expect_error($q$update public.event_change_revalidations set venue_required=false$q$,'42501',
 'AC-007.12.13: browser cannot change revalidation records directly');
reset role;
create function pg_temp.fail_revalidation_queue() returns trigger language plpgsql as $$ begin
 if new.change_request_id='70000000-0000-0000-0000-000000000009' then raise exception 'Simulated queue failure'; end if;
 return new;
end $$;
create trigger test_queue_failure before insert on public.event_change_revalidations for each row execute function pg_temp.fail_revalidation_queue();
create temp table before_queue_failure as select to_jsonb(e) value from public.events e where id='60000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.expect_error($q$select pg_temp.revalidation_review(9,'[{"field":"equipmentRequirements","decision":"approved"}]')$q$,'P0001',
 'AC-007.12.14: queue failure fails the review transaction');
reset role;
select pg_temp.assert_true((select to_jsonb(e)=b.value from public.events e cross join before_queue_failure b
 where e.id='60000000-0000-0000-0000-000000000001')
 and (select status='submitted' and reviewed_at is null from public.event_change_requests where id='70000000-0000-0000-0000-000000000009')
 and not exists(select 1 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000009'),
 'AC-007.12.15: failed hook leaves event request and queue unchanged');
drop trigger test_queue_failure on public.event_change_revalidations;
select pg_temp.assert_true((select status='submitted' from public.events where id='60000000-0000-0000-0000-000000000001'),
 'AC-007.12.16: revalidation hook does not change the event lifecycle status');
select set_config('request.jwt.claim.sub','',false);
insert into public.event_change_requests (id,event_id,organiser_id,proposed_changes,reason)
values ('70000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001','{"equipmentRequirements":"Two microphones","name":"Rejected name"}','Partial approval fixture');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.revalidation_review(10,'[{"field":"equipmentRequirements","decision":"approved"},{"field":"name","decision":"rejected","note":"Keep title"}]');
select pg_temp.assert_true((select approved_fields=array['equipmentRequirements'] and equipment_required and not venue_required
 from public.event_change_revalidations where change_request_id='70000000-0000-0000-0000-000000000010'),
 'AC-007.12.17: partial approval queues only the accepted significant fields');
select pg_temp.expect_error($q$select pg_temp.revalidation_review(10,'[{"field":"equipmentRequirements","decision":"approved"},{"field":"name","decision":"rejected","note":"Keep title"}]')$q$,'22000',
 'AC-007.12.18: retrying a final review cannot enqueue duplicate work');
reset role;
select set_config('request.jwt.claim.sub','',false);
