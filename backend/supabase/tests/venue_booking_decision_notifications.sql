-- US10 AC14: isolated decision delivery and real recipient RLS.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into auth.users(id,email,raw_user_meta_data) values
 ('b10d0000-0000-0000-0000-000000000001','decision-c1@example.test','{}'),
 ('b10d0000-0000-0000-0000-000000000002','decision-c2@example.test','{}');
update public.profiles set role='coordinator' where id in
 ('b10d0000-0000-0000-0000-000000000001','b10d0000-0000-0000-0000-000000000002');
insert into public.venues(id,name,location,capacity,layout,status)
values('b10d0000-0000-0000-0000-000000000003','Decision Hall','Test',200,'Theatre','active');
insert into public.events(id,organiser_id,coordinator_id,purpose,name,reference,proposed_start,proposed_end,expected_attendance,status)
select ('b10d0000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'b10a0000-0000-0000-0000-000000000002',
 case when n=104 then null when n=102 then 'b10d0000-0000-0000-0000-000000000002'::uuid else 'b10d0000-0000-0000-0000-000000000001'::uuid end,
 'Decision fixture','Decision event '||n,'EVT-DEC-'||n,
 '2044-10-12T13:00:00+08'::timestamptz+(n-101)*interval '2 days',
 '2044-10-12T16:00:00+08'::timestamptz+(n-101)*interval '2 days',50,'approved'
from generate_series(101,105) n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
select ('b10d0000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('b10d0000-0000-0000-0000-'||lpad((n-100)::text,12,'0'))::uuid,
 'b10d0000-0000-0000-0000-000000000003','b10d0000-0000-0000-0000-000000000001','pending_approval'
from generate_series(201,205) n;
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select public.approve_venue_booking('b10d0000-0000-0000-0000-000000000201',
 public.get_venue_booking_review('b10d0000-0000-0000-0000-000000000201')->>'reviewVersion');
update public.venue_bookings set status='rejected',review_note='Unavailable',review_alternative='Try Friday'
 where id='b10d0000-0000-0000-0000-000000000202';
-- Repeated final updates affect no row and must not duplicate notices.
update public.venue_bookings set status='rejected',review_note='Retry'
 where id='b10d0000-0000-0000-0000-000000000202';
select pg_temp.expect_error($q$update public.venue_bookings set status='rejected',review_note='  '
 where id='b10d0000-0000-0000-0000-000000000203'$q$,'23514','Invalid rejection fixture is refused');
update public.venue_bookings set status='rejected',review_note='Legacy request'
 where id='b10d0000-0000-0000-0000-000000000204';
reset role;
select pg_temp.assert_true(exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000201' and decision='confirmed'
 and recipient_id='b10d0000-0000-0000-0000-000000000001' and venue_name='Decision Hall'
 and reviewed_by='b10a0000-0000-0000-0000-000000000001' and reviewed_at is not null),
 'AC-010.14.1: approval records the decision for the assigned coordinator');
select pg_temp.assert_true(exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000202' and decision='rejected'
 and reason='Unavailable' and alternative='Try Friday' and recipient_id='b10d0000-0000-0000-0000-000000000002'),
 'AC-010.14.2: rejection includes reason and alternative for the current assignee');
select pg_temp.assert_true((select count(*)=1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000202'),'AC-010.14.3: a repeated decision produces no duplicate');
select pg_temp.assert_true((select status='pending_approval' from public.venue_bookings where id='b10d0000-0000-0000-0000-000000000203'),'AC-010.14.4: invalid rejection preserves pending status');
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000203'),'AC-010.14.5: a refused decision produces no notification');
set role authenticated;
select pg_temp.as_user('b10d0000-0000-0000-0000-000000000002');
select pg_temp.assert_true((select count(*)=1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000202'),'AC-010.14.6: recipient can read the delivered rejection');
select pg_temp.as_user('b10d0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000202'),'AC-010.14.7: the original requester cannot read a reassigned decision');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications
 where booking_id::text like 'b10d%'),'AC-010.14.8: unrelated coordinator sees no decision notifications');
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications),
 'AC-010.14.9: Venue Staff cannot read coordinator notifications');
reset role;
set role anon;
select pg_temp.expect_error($q$select * from public.venue_booking_decision_notifications$q$,'42501',
 'AC-010.14.10: anonymous users cannot read notifications');
reset role;
set role authenticated;
select pg_temp.as_user('b10d0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.venue_booking_decision_notifications default values$q$,'42501',
 'AC-010.14.11: recipients cannot fabricate notifications');
select pg_temp.expect_error($q$update public.venue_booking_decision_notifications set reason='Edited'$q$,'42501',
 'AC-010.14.12: recipients cannot rewrite notifications');
select pg_temp.expect_error($q$delete from public.venue_booking_decision_notifications$q$,'42501',
 'AC-010.14.13: recipients cannot delete the decision record');
select pg_temp.assert_true(exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000204' and alternative is null),
 'AC-010.14.14: legacy unassigned request notifies its coordinator requester without inventing an alternative');
reset role;
-- Inject a storage failure only in this disposable test; approval must roll back too.
create function pg_temp.refuse_decision_notice() returns trigger language plpgsql as $$ begin
 if new.booking_id='b10d0000-0000-0000-0000-000000000205' then raise exception 'Simulated notification failure'; end if;
 return new; end $$;
create trigger test_refuse_notice before insert on public.venue_booking_decision_notifications
 for each row execute function pg_temp.refuse_decision_notice();
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10d0000-0000-0000-0000-000000000205',
 public.get_venue_booking_review('b10d0000-0000-0000-0000-000000000205')->>'reviewVersion')$q$,'P0001',
 'AC-010.14.15: notification failure refuses the whole approval');
reset role;
drop trigger test_refuse_notice on public.venue_booking_decision_notifications;
select pg_temp.assert_true((select status='pending_approval' and reviewed_at is null from public.venue_bookings
 where id='b10d0000-0000-0000-0000-000000000205')
 and not exists(select 1 from public.venue_slot_claims where booking_id='b10d0000-0000-0000-0000-000000000205')
 and not exists(select 1 from public.venue_booking_decision_notifications where booking_id='b10d0000-0000-0000-0000-000000000205'),
 'AC-010.14.16: rollback preserves pending status and leaves no claims or notification');
select set_config('request.jwt.claim.sub','',false);
update public.events set coordinator_id='b10d0000-0000-0000-0000-000000000002' where id='b10d0000-0000-0000-0000-000000000101';
set role authenticated;
select pg_temp.as_user('b10d0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000201'),
 'AC-010.14.17: reassignment revokes access to the previous recipients historical notification');
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.profiles set role='attendee' where id='b10d0000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.as_user('b10d0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications),
 'AC-010.14.18: a recipient who is no longer a coordinator loses access');
reset role;
select set_config('request.jwt.claim.sub','',false);
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
update public.venue_bookings set status='rejected',review_note='No coordinator'
 where id='b10d0000-0000-0000-0000-000000000203';
reset role;
select pg_temp.assert_true(not exists(select 1 from public.venue_booking_decision_notifications
 where booking_id='b10d0000-0000-0000-0000-000000000203'),
 'AC-010.14.33: a non-coordinator recipient does not receive a decision');
select set_config('request.jwt.claim.sub','',false);
update public.profiles set role='coordinator' where id='b10d0000-0000-0000-0000-000000000001';
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select 'b10d0000-0000-0000-0000-000000000003',slot_date,slot,kind,'b10d0000-0000-0000-0000-000000000205'
from public.venue_review_cells('2044-10-20T13:00:00+08','2044-10-20T16:00:00+08');
create trigger test_refuse_notice before insert on public.venue_booking_decision_notifications
 for each row execute function pg_temp.refuse_decision_notice();
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.venue_bookings set status='rejected',review_note='Unavailable'
 where id='b10d0000-0000-0000-0000-000000000205'$q$,'P0001',
 'AC-010.14.35: notification failure refuses the whole rejection');
reset role;
drop trigger test_refuse_notice on public.venue_booking_decision_notifications;
select pg_temp.assert_true((select status='pending_approval' and reviewed_at is null from public.venue_bookings
 where id='b10d0000-0000-0000-0000-000000000205')
 and (select count(*)=3 from public.venue_slot_claims where booking_id='b10d0000-0000-0000-0000-000000000205')
 and not exists(select 1 from public.venue_booking_decision_notifications where booking_id='b10d0000-0000-0000-0000-000000000205'),
 'AC-010.14.36: rejected notification failure preserves all held slots and the pending request');
select set_config('request.jwt.claim.sub','',false);
create temp table decisions_before_replay as select * from public.venue_booking_decision_notifications;
