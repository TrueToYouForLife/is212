-- Disposable database only. Existing suites exercise real review/reply RPCs.
reset role;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.assert_true((select count(distinct outcome)=4 from public.event_change_review_history),
 'AC-007.13.12: approval rejection partial approval and clarification are retained');
select pg_temp.assert_true((select count(*)>=2 from public.event_change_review_history where change_request_id='50000000-0000-0000-0000-000000000001'),
 'AC-007.13.13: clarification and later review survive organiser replies');
select pg_temp.assert_true(not exists(select 1 from public.event_change_review_history where reviewed_by is null or reviewer_name='' or reviewed_at is null),
 'AC-007.13.14: retained actions contain actor name identity and timestamp');
select pg_temp.assert_true((select proposed_changes->>'equipmentRequirements'='Projector' and field_decisions->0->>'note'='Keep existing'
 from public.event_change_review_history where change_request_id='70000000-0000-0000-0000-000000000002'),
 'AC-007.13.15: rejected proposal and explanation are preserved');
create temp table history_snapshot as select * from public.event_change_review_history;
update public.profiles set full_name='Renamed coordinator' where id='00000000-0000-0000-0000-000000000003';
select pg_temp.assert_true(not exists(select * from public.event_change_review_history except select * from history_snapshot),
 'AC-007.13.16: changing a profile does not rewrite historical reviewer names');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true(not exists(select 1 from public.event_change_review_history where event_id='60000000-0000-0000-0000-000000000001'),
 'AC-007.13.17: another coordinator cannot read review history');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(not exists(select 1 from public.event_change_review_history),
 'AC-007.13.18: organiser cannot read staff review identity history');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select pg_temp.assert_true(exists(select 1 from public.event_change_review_history),
 'AC-007.13.19: operations manager can read history');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(exists(select 1 from public.event_change_review_history where event_id='60000000-0000-0000-0000-000000000001'),
 'AC-007.13.20: assigned coordinator can read history');
select pg_temp.expect_error('delete from public.event_change_review_history','42501',
 'AC-007.13.21: browser cannot delete history');
select pg_temp.expect_error('update public.event_change_review_history set reviewer_name=''Spoofed''','42501',
 'AC-007.13.22: browser cannot rewrite history');
select pg_temp.expect_error('insert into public.event_change_review_history default values','42501',
 'AC-007.13.23: browser cannot insert fabricated history');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Fail only this isolated fixture's history write; the review must roll back too.
create function pg_temp.fail_review_history() returns trigger language plpgsql as $$
begin raise exception 'History unavailable' using errcode='23514'; end $$;
create trigger test_history_failure before insert on public.event_change_review_history
 for each row execute function pg_temp.fail_review_history();
create temp table event_before_history_failure as select * from public.events;
create temp table request_before_history_failure as select * from public.event_change_requests;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.expect_error($q$select pg_temp.revalidation_review(9,'[{"field":"equipmentRequirements","decision":"approved"}]')$q$,'23514',
 'AC-007.13.24: history write failure prevents successful review');
reset role;
select set_config('request.jwt.claim.sub','',false);
drop trigger test_history_failure on public.event_change_review_history;
select pg_temp.assert_true(not exists(select * from public.events except select * from event_before_history_failure)
 and not exists(select * from public.event_change_requests except select * from request_before_history_failure),
 'AC-007.13.25: failed history write rolls back both event and request');
