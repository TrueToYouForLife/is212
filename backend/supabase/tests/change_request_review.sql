-- Run only through run_change_request_review.sh: synthetic users/data, real RLS.
create function pg_temp.assert_true(value boolean, label text) returns void
language plpgsql as $$ begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_error(statement text, expected_code text, label text) returns void
language plpgsql as $$ begin
  begin execute statement;
  exception when others then
    if sqlstate <> expected_code then raise; end if;
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: expected error for %', label;
end $$;
create function pg_temp.review(request_number integer, review jsonb) returns text
language sql as $$
  select public.review_event_change_request(
    ('20000000-0000-0000-0000-' || lpad(request_number::text,12,'0'))::uuid,
    (select updated_at from public.events where id='10000000-0000-0000-0000-000000000001'),
    review);
$$;

insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-000000000001','owner@example.test'),
 ('00000000-0000-0000-0000-000000000002','other@example.test'),
 ('00000000-0000-0000-0000-000000000003','coordinator@example.test'),
 ('00000000-0000-0000-0000-000000000004','other-coordinator@example.test'),
 ('00000000-0000-0000-0000-000000000005','manager@example.test'),
 ('00000000-0000-0000-0000-000000000006','lead@example.test');
-- Self sign-up creates Attendees since US29 (0042), so organisers are assigned like other roles.
update public.profiles set role='organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id in
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
update public.profiles set role='coordinator' where id in
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004');
update public.profiles set role='operations_manager' where id='00000000-0000-0000-0000-000000000005';
update public.profiles set role='coordinator_lead' where id='00000000-0000-0000-0000-000000000006';
insert into public.events (id,organiser_id,purpose,name,proposed_start,proposed_end,expected_attendance,status) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Original purpose','Original name','2030-01-01 01:00+00','2030-01-01 02:00+00',10,'submitted'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Other event','Other name','2030-01-01 01:00+00','2030-01-01 02:00+00',10,'submitted');

insert into public.event_change_requests (id,event_id,organiser_id,proposed_changes,reason)
select ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 '{"name":"New name","expectedAttendance":"120"}'::jsonb,'Synthetic test request'
from generate_series(1,12) n;
update public.event_change_requests set proposed_changes='{"proposedStart":"2030-01-01T11:00:00+08:00"}'
 where id='20000000-0000-0000-0000-000000000004';
update public.event_change_requests set proposed_changes='{"expectedAttendance":"2147483648"}'
 where id='20000000-0000-0000-0000-000000000005';
update public.event_change_requests set proposed_changes='{"registrationRequired":false,"description":""}'
 where id='20000000-0000-0000-0000-000000000006';
update public.event_change_requests set proposed_changes='{"status":"confirmed"}'
 where id='20000000-0000-0000-0000-000000000007';
update public.event_change_requests set proposed_changes='{"expectedAttendance":"12.5"}'
 where id='20000000-0000-0000-0000-000000000008';
update public.event_change_requests set proposed_changes='{"proposedStart":"2030-01-01T09:30:00"}'
 where id='20000000-0000-0000-0000-000000000009';
update public.event_change_requests set status='withdrawn'
 where id='20000000-0000-0000-0000-000000000010';
update public.event_change_requests set proposed_changes='{"name":"Must roll back"}'
 where id='20000000-0000-0000-0000-000000000011';
-- Fail the last write after the function has updated events: both must roll back.
create function pg_temp.fail_review_save() returns trigger language plpgsql as $$ begin
  if new.id='20000000-0000-0000-0000-000000000011' and new.reviewed_at is not null then
    raise exception 'Injected final-save failure' using errcode='23514';
  end if;
  return new;
end $$;
create trigger test_fail_review_save before update on public.event_change_requests
  for each row execute function pg_temp.fail_review_save();

-- AC2: assignment and permission boundaries, including direct API bypass attempts.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true((select count(*)=0 from public.event_change_requests),
 'AC-007.2.1: unassigned coordinator cannot read proposals');
select pg_temp.expect_error($q$select pg_temp.review(1,'{"action":"clarify","note":"Explain"}')$q$,'42501',
 'AC-007.2.2: unassigned coordinator cannot review via function');
select pg_temp.expect_error($q$select public.assign_event_coordinator('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003')$q$,'42501',
 'AC-007.2.3: coordinator cannot self-assign through function');
select pg_temp.expect_error($q$update public.events set coordinator_id='00000000-0000-0000-0000-000000000003' where id='10000000-0000-0000-0000-000000000001'$q$,'42501',
 'AC-007.2.4: coordinator cannot self-assign through direct update');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select public.assign_event_coordinator('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
-- Verify the saved assignment independently of Lead queue read permissions.
reset role;
select pg_temp.assert_true((select coordinator_id='00000000-0000-0000-0000-000000000003'
 from public.events where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.2.5: Coordinator Lead assigns a coordinator');
set role authenticated;
select pg_temp.expect_error($q$select public.assign_event_coordinator('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')$q$,'22000',
 'AC-007.2.6: assignment refuses an organiser as coordinator');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true((select count(*)=0 from public.event_change_requests),
 'AC-007.2.7: different coordinator cannot read assigned proposals');
select pg_temp.expect_error($q$select pg_temp.review(1,'{"action":"clarify","note":"Explain"}')$q$,'42501',
 'AC-007.2.8: different coordinator cannot review assigned proposals');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error($q$select pg_temp.review(1,'{"action":"clarify","note":"Explain"}')$q$,'42501',
 'AC-007.2.9: organiser cannot review own proposal');
select pg_temp.expect_error($q$update public.events set name='Bypass' where id='10000000-0000-0000-0000-000000000001'$q$,'42501',
 'AC-007.2.10: organiser cannot directly edit submitted event details');
select pg_temp.expect_error($q$update public.event_change_requests set reviewed_by='00000000-0000-0000-0000-000000000003' where id='20000000-0000-0000-0000-000000000001'$q$,'42501',
 'AC-007.2.11: organiser cannot write reviewer metadata');
select pg_temp.expect_error($q$insert into public.event_change_requests(event_id,organiser_id,proposed_changes,reason,status) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','{"name":"X"}','Test','approved')$q$,'42501',
 'AC-007.2.12: organiser cannot create an already-approved proposal');
set role anon;
select pg_temp.expect_error($q$select pg_temp.review(1,'{"action":"clarify","note":"Explain"}')$q$,'42501',
 'AC-007.2.13: anonymous caller cannot invoke review');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true((select count(*)=12 from public.event_change_requests),
 'AC-007.2.14: assigned coordinator can read proposals');
select pg_temp.expect_error($q$update public.events set name='Bypass' where id='10000000-0000-0000-0000-000000000001'$q$,'42501',
 'AC-007.2.15: coordinator cannot bypass proposal review with a direct detail update');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error($q$insert into public.event_change_requests(event_id,organiser_id,proposed_changes,reason,reviewed_at) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','{"name":"X"}','Test',now())$q$,'42501',
 'AC-007.2.16: organiser cannot spoof review metadata on insert');
select pg_temp.expect_error($q$update public.event_change_requests set status='withdrawn',proposed_changes='{"name":"Forged"}' where id='20000000-0000-0000-0000-000000000012'$q$,'42501',
 'AC-007.2.17: withdrawal cannot rewrite the stored proposal');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select public.assign_event_coordinator('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.expect_error($q$select pg_temp.review(1,'{"action":"clarify","note":"Explain"}')$q$,'42501',
 'AC-007.2.18: reassignment immediately removes previous reviewer access');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select public.assign_event_coordinator('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
-- The original-request review fixture also needs an assigned reviewer under US17.
select public.assign_event_coordinator('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);

-- Shared event-table regression: US4's original event review is a different workflow.
update public.events set status='under_review' where id='10000000-0000-0000-0000-000000000002';
update public.events set status='approved' where id='10000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select status='approved' from public.events
 where id='10000000-0000-0000-0000-000000000002'),
 'REGRESSION-US4: original event approval still works');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.events (id,organiser_id) values
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001');
update public.events set name='Draft edited' where id='10000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select name='Draft edited' and status='draft' from public.events
 where id='10000000-0000-0000-0000-000000000003'),
 'REGRESSION-US1: incomplete draft can still be created and edited');
update public.events set status='submitted',purpose='Draft submitted',expected_attendance=10,
 proposed_start='2030-02-01 01:00+00',proposed_end='2030-02-01 02:00+00'
 where id='10000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select status='submitted' and reference is not null from public.events
 where id='10000000-0000-0000-0000-000000000003'),
 'REGRESSION-US1: explicit draft submission still works');
update public.event_change_requests set status='withdrawn'
 where id='20000000-0000-0000-0000-000000000012';
select pg_temp.assert_true((select status='withdrawn' and proposed_changes->>'name'='New name'
 from public.event_change_requests where id='20000000-0000-0000-0000-000000000012'),
 'REGRESSION-US6: organiser can still withdraw without changing proposal');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);

-- Existing unit tests use AC5.1-12; database case numbers continue that allocation.
select pg_temp.assert_true(pg_temp.review(1,'{"action":"decide","decisions":[{"field":"name","decision":"approved"},{"field":"expectedAttendance","decision":"rejected","note":"Capacity is 10"}]}')='partially_approved',
 'AC-007.5.13: database saves a partial approval');
select pg_temp.expect_error($q$select pg_temp.review(1,'{"action":"clarify","note":"Again"}')$q$,'22000',
 'AC-007.5.14: reviewed request cannot be reviewed again');
select pg_temp.expect_error($q$select pg_temp.review(2,'{"action":"decide","decisions":[]}')$q$,'22000',
 'AC-007.5.15: database rejects missing decisions');
select pg_temp.expect_error($q$select pg_temp.review(2,'{"action":"decide","decisions":[{"field":"name","decision":"approved"},{"field":"name","decision":"approved"}]}')$q$,'22000',
 'AC-007.5.16: database rejects duplicate decisions');
select pg_temp.expect_error($q$select pg_temp.review(7,'{"action":"decide","decisions":[{"field":"status","decision":"approved"}]}')$q$,'22000',
 'AC-007.5.17: database rejects proposed workflow fields');
select pg_temp.expect_error($q$select pg_temp.review(10,'{"action":"clarify","note":"Explain"}')$q$,'22000',
 'AC-007.5.18: withdrawn request cannot be reviewed');
select pg_temp.expect_error($q$select public.review_event_change_request('20000000-0000-0000-0000-000000000002','2000-01-01','{"action":"clarify","note":"Explain"}')$q$,'22000',
 'AC-007.5.19: stale event version cannot be reviewed');

select pg_temp.expect_error($q$select pg_temp.review(2,'{"action":"decide","decisions":[{"field":"name","decision":"rejected","note":" "},{"field":"expectedAttendance","decision":"approved"}]}')$q$,'22000',
 'AC-007.6.3: database requires a rejection explanation');
select pg_temp.assert_true((select field_decisions->1->>'note'='Capacity is 10'
 from public.event_change_requests where id='20000000-0000-0000-0000-000000000001'),
 'AC-007.6.4: rejection explanation stays with its field');
select pg_temp.assert_true(pg_temp.review(2,'{"action":"clarify","note":"  Explain attendance  "}')='clarification_requested',
 'AC-007.7.4: coordinator records clarification');
select pg_temp.expect_error($q$select pg_temp.review(3,'{"action":"clarify","note":" "}')$q$,'22000',
 'AC-007.7.5: blank clarification is rejected');
select pg_temp.assert_true((select review_note='Explain attendance' from public.event_change_requests
 where id='20000000-0000-0000-0000-000000000002'),
 'AC-007.7.6: clarification follow-up is stored');

select pg_temp.assert_true((select name='New name' and expected_attendance=10 from public.events
 where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.9.3: only accepted field changes event; clarification leaves it unchanged');
select pg_temp.expect_error($q$select pg_temp.review(4,'{"action":"decide","decisions":[{"field":"proposedStart","decision":"approved"}]}')$q$,'22000',
 'AC-007.9.4: accepted date cannot invalidate existing end date');
select pg_temp.expect_error($q$select pg_temp.review(5,'{"action":"decide","decisions":[{"field":"expectedAttendance","decision":"approved"}]}')$q$,'22003',
 'AC-007.9.5: attendance outside integer range is rejected');
select pg_temp.assert_true((select status='submitted' and reviewed_at is null from public.event_change_requests
 where id='20000000-0000-0000-0000-000000000004') and
 (select proposed_start='2030-01-01 01:00+00' from public.events where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.9.6: failed approval leaves both event and request unchanged');
do $$ declare outcome text; begin
  outcome := pg_temp.review(6,'{"action":"decide","decisions":[{"field":"registrationRequired","decision":"approved"},{"field":"description","decision":"approved"}]}');
  perform pg_temp.assert_true(outcome='approved'
 and (select not registration_required and description is null from public.events where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.9.7: approved false and blank optional text are applied');
end $$;
select pg_temp.expect_error($q$select pg_temp.review(8,'{"action":"decide","decisions":[{"field":"expectedAttendance","decision":"approved"}]}')$q$,'22P02',
 'AC-007.9.8: fractional attendance is rejected');
do $$ declare outcome text; begin
  outcome := pg_temp.review(9,'{"action":"decide","decisions":[{"field":"proposedStart","decision":"approved"}]}');
  perform pg_temp.assert_true(outcome='approved'
 and (select proposed_start='2030-01-01 01:30+00' from public.events where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.9.9: timezone-less proposal is interpreted as Singapore time');
end $$;
select pg_temp.expect_error($q$select pg_temp.review(11,'{"action":"decide","decisions":[{"field":"name","decision":"approved"}]}')$q$,'23514',
 'AC-007.9.10: failure while saving decision aborts approval');
select pg_temp.assert_true((select name='New name' from public.events where id='10000000-0000-0000-0000-000000000001')
 and (select status='submitted' and reviewed_at is null from public.event_change_requests
 where id='20000000-0000-0000-0000-000000000011'),
 'AC-007.9.11: final-save failure rolls back the event update and decision together');
do $$ declare outcome text; begin
  outcome := pg_temp.review(3,'{"action":"decide","decisions":[{"field":"name","decision":"rejected","note":"Keep current"},{"field":"expectedAttendance","decision":"rejected","note":"Capacity"}]}');
  perform pg_temp.assert_true(outcome='rejected'
 and (select name='New name' and expected_attendance=10 from public.events where id='10000000-0000-0000-0000-000000000001'),
 'AC-007.10.1: rejection leaves event details unchanged');
end $$;

select pg_temp.assert_true((select reviewed_by='00000000-0000-0000-0000-000000000003'
 and reviewed_at is not null and jsonb_array_length(field_decisions)=2
 from public.event_change_requests where id='20000000-0000-0000-0000-000000000001'),
 'AC-007.13.1: database stamps actor, time and individual decisions');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true((select status='partially_approved' and field_decisions->1->>'note'='Capacity is 10'
 from public.event_change_requests where id='20000000-0000-0000-0000-000000000001'),
 'AC-007.13.2: organiser can read saved outcome and explanation');
reset role;
select set_config('request.jwt.claim.sub','',false);
create temp table requests_before_repeat as select * from public.event_change_requests;
