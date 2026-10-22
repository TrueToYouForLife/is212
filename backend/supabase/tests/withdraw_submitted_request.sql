-- US22: a Coordinator withdraws a request that is under review (0066).
--
-- The frontend cases in withdrawRequest.test.ts cover which buttons appear and which
-- call the service. These are the enforcement: the status exists, only the two
-- under-review states reach it, it is terminal, and only the assigned coordinator can
-- get there. Hiding a button is a courtesy; these are the control.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('b2200000-0000-0000-0000-000000000001', 'w22-organiser@example.test', '{}'),
 ('b2200000-0000-0000-0000-000000000002', 'w22-coord-assigned@example.test', '{}'),
 ('b2200000-0000-0000-0000-000000000003', 'w22-coord-other@example.test', '{}');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'b2200000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in
 ('b2200000-0000-0000-0000-000000000002', 'b2200000-0000-0000-0000-000000000003');
update public.profiles set full_name = 'Wanda Withdrawer'
 where id = 'b2200000-0000-0000-0000-000000000002';

-- 101 submitted, 102 under_review, 103 approved (the state that must refuse),
-- 104 submitted but assigned to the other coordinator.
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b2200000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b2200000-0000-0000-0000-000000000001',
       case when n = 104 then 'b2200000-0000-0000-0000-000000000003'::uuid
            else 'b2200000-0000-0000-0000-000000000002'::uuid end,
       'Withdrawal fixture', 'Withdraw event ' || n, 'EVT-W22-' || n,
       '2046-04-01T13:00:00+08'::timestamptz + (n - 101) * interval '2 days',
       '2046-04-01T16:00:00+08'::timestamptz + (n - 101) * interval '2 days',
       40,
       case n when 101 then 'submitted' when 102 then 'under_review'
              when 103 then 'approved'  else 'submitted' end
from generate_series(101, 104) n;

-- ===== AC-022.2 the status exists and is reachable only from review =====

select pg_temp.assert_true(
 (select count(*) = 1 from pg_constraint
  where conname = 'events_status_valid'
    and pg_get_constraintdef(oid) like '%''withdrawn''%'),
 'AC-022.2.8: ''withdrawn'' is an accepted event status');

select pg_temp.assert_true(
 public.is_valid_status_transition('submitted', 'withdrawn')
 and public.is_valid_status_transition('under_review', 'withdrawn'),
 'AC-022.1.11: a request awaiting a decision can be withdrawn from either review state');

select pg_temp.assert_true(
 not public.is_valid_status_transition('draft', 'withdrawn')
 and not public.is_valid_status_transition('approved', 'withdrawn')
 and not public.is_valid_status_transition('confirmed', 'withdrawn')
 and not public.is_valid_status_transition('rejected', 'withdrawn'),
 'AC-022.2.9: a request already decided or not yet submitted cannot be withdrawn');

select pg_temp.assert_true(
 not public.is_valid_status_transition('withdrawn', 'submitted')
 and not public.is_valid_status_transition('withdrawn', 'approved')
 and not public.is_valid_status_transition('withdrawn', 'cancelled'),
 'AC-022.2.10: withdrawn is terminal — reviving a request means filing a new one');

-- ===== AC-022.1 who may withdraw =====
set role authenticated;

select pg_temp.as_user('b2200000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$update public.events set status = 'withdrawn', review_note = 'I changed my mind'
    where id = 'b2200000-0000-0000-0000-000000000101'$q$,
 '42501',
 'AC-022.1.12: the organiser cannot withdraw their own request — their close is cancel');

select pg_temp.as_user('b2200000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
 $q$update public.events set status = 'withdrawn', review_note = 'Not mine'
    where id = 'b2200000-0000-0000-0000-000000000101'$q$,
 '42501',
 'AC-022.1.13: a coordinator who is not the assignee cannot withdraw the request');

select pg_temp.as_user('b2200000-0000-0000-0000-000000000002');
select pg_temp.expect_error(
 $q$update public.events set status = 'withdrawn', review_note = 'Too late'
    where id = 'b2200000-0000-0000-0000-000000000103'$q$,
 '22000',
 'AC-022.1.14: an approved event is refused by the transition rule, not the permission one');

-- The happy path, from each review state.
update public.events set status = 'withdrawn', review_note = 'The client cancelled the programme.'
 where id = 'b2200000-0000-0000-0000-000000000101';
update public.events set status = 'withdrawn', review_note = 'Duplicate of EVT-W22-101.'
 where id = 'b2200000-0000-0000-0000-000000000102';

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select count(*) = 2 from public.events
  where id in ('b2200000-0000-0000-0000-000000000101',
               'b2200000-0000-0000-0000-000000000102')
    and status = 'withdrawn'),
 'AC-022.1.15: the assigned coordinator withdraws from both submitted and under_review');

select pg_temp.assert_true(
 (select reviewed_by = 'b2200000-0000-0000-0000-000000000002' and reviewed_at is not null
  from public.events where id = 'b2200000-0000-0000-0000-000000000101'),
 'AC-022.1.16: the withdrawal is stamped with who closed the request and when');

-- ===== AC-022.2 distinguishable in the record, not only on the badge =====

select pg_temp.assert_true(
 (select count(*) = 1 from public.event_review_decisions
  where event_id = 'b2200000-0000-0000-0000-000000000101'
    and decision = 'withdrawn' and from_status = 'submitted'
    and reason = 'The client cancelled the programme.'
    and decided_by = 'b2200000-0000-0000-0000-000000000002'
    and decided_by_name = 'Wanda Withdrawer'),
 'AC-022.2.11: the decision log records a withdrawal as its own outcome, with its reason');

select pg_temp.assert_true(
 (select from_status = 'under_review' from public.event_review_decisions
  where event_id = 'b2200000-0000-0000-0000-000000000102' and decision = 'withdrawn'),
 'AC-022.2.12: the log keeps the state the request was withdrawn from');

select pg_temp.assert_true(
 not exists (select 1 from public.event_review_decisions
             where event_id = 'b2200000-0000-0000-0000-000000000101'
               and decision in ('approved', 'rejected', 'returned')),
 'AC-022.2.13: a withdrawal is not recorded as an approval, rejection or return');

-- 0009 emails approved and rejected only; a return is logged and not emailed. Withdrawal
-- follows the return, deliberately: AC-022 asks for no notification, and widening the
-- sender is a decision for the team rather than a side effect of this change.
select pg_temp.assert_true(
 not exists (select 1 from public.notification_outbox
             where event_id = 'b2200000-0000-0000-0000-000000000101'),
 'AC-022.2.14: no email is queued for a withdrawal, matching the existing return behaviour');

-- A second withdrawal is a no-op, not an error: enforce_event_status_transition returns
-- early when the status does not change, so it never reaches the transition rule. That is
-- deliberate and consistent across the workflow — re-saving a row must not fail — and it
-- is why the audit guarantee is "no second decision" rather than "the write is refused".
-- The event's own review_note is still writable; event_review_decisions is the record
-- that cannot be rewritten, which is where the original reason is kept.
set role authenticated;
select pg_temp.as_user('b2200000-0000-0000-0000-000000000002');
update public.events set status = 'withdrawn', review_note = 'Again'
 where id = 'b2200000-0000-0000-0000-000000000101';

select pg_temp.assert_true(
 (select status = 'withdrawn' from public.events
  where id = 'b2200000-0000-0000-0000-000000000101'),
 'AC-022.2.15: re-withdrawing an already withdrawn request changes nothing');

select pg_temp.expect_error(
 $q$update public.events set status = 'approved'
    where id = 'b2200000-0000-0000-0000-000000000101'$q$,
 '22000',
 'AC-022.2.16: a withdrawn request cannot be approved afterwards');

reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.assert_true(
 (select count(*) = 1 from public.event_review_decisions
  where event_id = 'b2200000-0000-0000-0000-000000000101'),
 'AC-022.2.17: the refused second attempt adds no second decision record');
