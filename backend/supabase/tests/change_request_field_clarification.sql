-- Runs after change_request_review.sql in the same disposable database/session.
-- Four proposed fields reproduce: two approved, one rejected, one clarification.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.event_change_requests (id,event_id,organiser_id,proposed_changes,reason)
select ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 '{"name":"Provisional name","description":"Provisional description","expectedAttendance":"80","equipmentRequirements":"3 projectors"}'::jsonb,
 'Field clarification fixture'
from generate_series(101,104) n;
create temp table event_before_clarification as
 select to_jsonb(e) as value from public.events e where id='10000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.expect_error($q$select pg_temp.review(101,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"description","decision":"approved"},
 {"field":"expectedAttendance","decision":"rejected","note":"Capacity"},
 {"field":"equipmentRequirements","decision":"clarification_requested","note":"Why three?"}]}')$q$,'42501',
 'AC-007.2.22: another coordinator cannot save provisional field decisions');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error($q$update public.event_change_requests set field_decisions='[]'
 where id='20000000-0000-0000-0000-000000000101'$q$,'42501',
 'AC-007.2.23: organiser cannot overwrite coordinator field decisions');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);

select pg_temp.assert_true(pg_temp.review(101,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"description","decision":"approved"},
 {"field":"expectedAttendance","decision":"rejected","note":"  Capacity limit  "},
 {"field":"equipmentRequirements","decision":"clarification_requested","note":"  Why three projectors?  "}]}')='clarification_requested',
 'AC-007.7.20: mixed decisions with an unanswered question are not a final partial approval');
select pg_temp.assert_true((select field_decisions='[
 {"field":"name","decision":"approved","note":""},
 {"field":"description","decision":"approved","note":""},
 {"field":"expectedAttendance","decision":"rejected","note":"Capacity limit"},
 {"field":"equipmentRequirements","decision":"clarification_requested","note":"Why three projectors?"}]'::jsonb
 from public.event_change_requests where id='20000000-0000-0000-0000-000000000101'),
 'AC-007.7.21: provisional decisions and trimmed questions are retained by field');

select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"description","decision":"approved"},
 {"field":"expectedAttendance","decision":"rejected","note":"Capacity"},
 {"field":"equipmentRequirements","decision":"clarification_requested","note":" "}]}')$q$,'22000',
 'AC-007.7.22: database rejects a blank field question');
select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"description","decision":"approved"},
 {"field":"expectedAttendance","decision":"rejected","note":"Capacity"},
 {"field":"equipmentRequirements","decision":"clarification_requested"}]}')$q$,'22000',
 'AC-007.7.23: database rejects a missing field question');
select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"equipmentRequirements","decision":"clarification_requested","note":123}]}')$q$,'22000',
 'AC-007.7.24: field questions must be text');
select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"name","decision":"clarification_requested","note":"Which?"}]}')$q$,'22000',
 'AC-007.7.25: duplicate field decisions cannot be saved as clarification');
select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"purpose","decision":"clarification_requested","note":"Which?"}]}')$q$,'22000',
 'AC-007.7.26: clarification cannot introduce a field outside the proposal');
select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"name","decision":"clarification_requested","note":"Which?"}]}')$q$,'22000',
 'AC-007.7.27: clarification still requires a decision for every proposed field');
select pg_temp.expect_error($q$select pg_temp.review(102,'{"action":"decide","decisions":[
 {"field":"name","decision":"pending","note":"Which?"}]}')$q$,'22000',
 'AC-007.7.28: unknown field decisions are rejected');
do $$ declare outcome text; begin
 outcome := pg_temp.review(104,'{"action":"decide","decisions":[
 {"field":"name","decision":"clarification_requested","note":"Which title?"},
 {"field":"description","decision":"clarification_requested","note":"Which programme?"},
 {"field":"expectedAttendance","decision":"clarification_requested","note":"Includes staff?"},
 {"field":"equipmentRequirements","decision":"clarification_requested","note":"Why three?"}]}');
 perform pg_temp.assert_true(outcome='clarification_requested'
 and (select count(distinct d->>'note')=4
 from public.event_change_requests r, jsonb_array_elements(r.field_decisions) d
 where r.id='20000000-0000-0000-0000-000000000104'),
 'AC-007.7.29: multiple fields can each retain a different clarification question');
end $$;
select pg_temp.expect_error($q$select pg_temp.review(101,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"description","decision":"approved"},
 {"field":"expectedAttendance","decision":"rejected","note":"Capacity"},
 {"field":"equipmentRequirements","decision":"approved"}]}')$q$,'22000',
 'AC-007.7.30: awaiting clarification cannot be finalised through a repeated review call');

-- Inspect every column as the fixture owner; browser roles intentionally have only
-- column-level SELECT grants. The actual review calls above ran as authenticated.
reset role;
select pg_temp.assert_true((select to_jsonb(e)=s.value from public.events e
 cross join event_before_clarification s where e.id='10000000-0000-0000-0000-000000000001'),
 'AC-007.8.1: unresolved reviews leave the entire event including timestamp unchanged');
set role authenticated;
select pg_temp.assert_true((select status='submitted' and field_decisions is null
 and reviewed_at is null from public.event_change_requests
 where id='20000000-0000-0000-0000-000000000102'),
 'AC-007.8.2: invalid field reviews leave the request untouched');

-- Finalising a fully resolved request still applies only accepted values atomically.
do $$ declare outcome text; begin
 outcome := pg_temp.review(103,'{"action":"decide","decisions":[
 {"field":"name","decision":"approved"},
 {"field":"description","decision":"approved"},
 {"field":"expectedAttendance","decision":"rejected","note":"Capacity"},
 {"field":"equipmentRequirements","decision":"approved"}]}');
 perform pg_temp.assert_true(outcome='partially_approved'
 and (select name='Provisional name' and description='Provisional description'
 and equipment_requirements='3 projectors' and expected_attendance=10
 from public.events where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.9.15: fully resolved partial approval applies accepted fields and preserves rejected values');
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true((select status='clarification_requested'
 and reviewed_by='00000000-0000-0000-0000-000000000003' and reviewed_at is not null
 and field_decisions->3->>'note'='Why three projectors?'
 from public.event_change_requests where id='20000000-0000-0000-0000-000000000101'),
 'AC-007.13.4: organiser can read the saved question and attributed review action');
reset role;
select set_config('request.jwt.claim.sub','',false);
create temp table field_reviews_before_repeat as select * from public.event_change_requests;
