-- Disposable local database only; email assertions inspect rows, never send mail.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.events(id,organiser_id,coordinator_id,purpose,proposed_start,proposed_end,expected_attendance,status)
values ('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000003','Notification fixture','2035-01-01 01:00+00','2035-01-01 02:00+00',20,'submitted'),
 ('80000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
 null,'Unassigned fixture','2035-01-01 01:00+00','2035-01-01 02:00+00',20,'submitted');
-- Fixture helper uses the database owner only to choose deterministic IDs. Browser
-- column grants intentionally forbid supplying id; production uses its UUID default.
create function pg_temp.submit_notification_request(n integer, event_number integer default 1) returns void language sql security definer set search_path='' as $$
 insert into public.event_change_requests(id,event_id,organiser_id,proposed_changes,reason)
 values (('90000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('80000000-0000-0000-0000-'||lpad(event_number::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000001','{"name":"Proposed title"}','Test request');
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.submit_notification_request(1);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true((select count(*)=1 from public.change_request_notifications
 where change_request_id='90000000-0000-0000-0000-000000000001' and recipient_id=auth.uid() and request_version=0),
 'AC-007.1.1: new submission creates an in-app delivery record for the assigned coordinator');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true(not exists(select 1 from public.change_request_notifications where event_id='80000000-0000-0000-0000-000000000001'),
 'AC-007.1.2: another coordinator cannot read these notifications');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(not exists(select 1 from public.change_request_notifications where event_id='80000000-0000-0000-0000-000000000001'),
 'AC-007.1.3: organiser cannot read the coordinator notification records');
select pg_temp.expect_error($q$update public.change_request_notifications set recipient_id=auth.uid()$q$,'42501',
 'AC-007.1.4: browser cannot forge or redirect notification records');
select pg_temp.expect_error($q$update public.change_request_notification_settings set email_enabled=true$q$,'42501',
 'AC-007.1.5: browser cannot change delivery configuration');
reset role;
-- US33 (0081): people choose their own channels and US7's system-wide email switch is now on,
-- so a Coordinator who has not turned this email off receives it.
select pg_temp.assert_true((select count(*)=1 from public.change_request_notifications n
 join public.notification_outbox o on o.id=n.email_outbox_id
 where n.change_request_id='90000000-0000-0000-0000-000000000001' and o.notification_type='change_request'),
 'AC-007.1.6: email is sent by default alongside in-app delivery, unless the Coordinator turns it off (US33)');
update public.change_request_notification_settings set email_enabled=true;
set role authenticated;
select pg_temp.submit_notification_request(2);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.change_request_notifications n
 join public.notification_outbox o on o.id=n.email_outbox_id
 where n.change_request_id='90000000-0000-0000-0000-000000000002'
 and o.recipient_email='coordinator@example.test' and o.status='pending' and o.decision_id is null),
 'AC-007.1.7: enabled email uses the existing outbox for the assigned coordinator');
update public.change_request_notification_settings set email_enabled=false,in_app_enabled=false;
select pg_temp.submit_notification_request(3);
select pg_temp.assert_true(not exists(select 1 from public.change_request_notifications where change_request_id='90000000-0000-0000-0000-000000000003'),
 'AC-007.1.8: disabling both channels creates no notification');
update public.change_request_notification_settings set email_enabled=true,in_app_enabled=false;
select pg_temp.submit_notification_request(4);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(not exists(select 1 from public.change_request_notifications where change_request_id='90000000-0000-0000-0000-000000000004'),
 'AC-007.1.9: email-only records do not appear in the in-app read');
reset role;
select pg_temp.submit_notification_request(5,2);
select pg_temp.assert_true(not exists(select 1 from public.change_request_notifications where event_id='80000000-0000-0000-0000-000000000002')
 and not exists(select 1 from public.notification_outbox where event_id='80000000-0000-0000-0000-000000000002'),
 'AC-007.1.10: unassigned requests are not broadcast to unrelated coordinators');
-- Other submitted fixtures would block the existing reply RPC; withdraw them first.
update public.event_change_requests set status='withdrawn' where id in
 ('90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000004');
update public.change_request_notification_settings set email_enabled=false,in_app_enabled=true;
set role authenticated;
select public.review_event_change_request('90000000-0000-0000-0000-000000000001',
 (select updated_at from public.events where id='80000000-0000-0000-0000-000000000001'),'{"action":"clarify","note":"Why the title?"}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.reply_to_change_request('90000000-0000-0000-0000-000000000001',1,'{"note":"Updated public title"}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true((select count(*)=2 and max(request_version)=2 from public.change_request_notifications
 where change_request_id='90000000-0000-0000-0000-000000000001'),
 'AC-007.1.11: clarification reply returning for review creates a new versioned notification');
reset role;
update public.event_change_requests set reason=reason where id='90000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*)=2 from public.change_request_notifications where change_request_id='90000000-0000-0000-0000-000000000001'),
 'AC-007.1.12: an unrelated update does not duplicate submission notifications');
update public.event_change_requests set status='withdrawn' where id='90000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*)=2 from public.change_request_notifications where change_request_id='90000000-0000-0000-0000-000000000001'),
 'AC-007.1.13: withdrawal does not create another submission notification');
create function pg_temp.fail_notification() returns trigger language plpgsql as $$ begin
 if new.change_request_id='90000000-0000-0000-0000-000000000006' then raise exception 'Notification failure'; end if;
 return new;
end $$;
create trigger test_notification_failure before insert on public.change_request_notifications for each row execute function pg_temp.fail_notification();
select pg_temp.expect_error($q$select pg_temp.submit_notification_request(6)$q$,'P0001',
 'AC-007.1.14: notification persistence failure fails the submission transaction');
select pg_temp.assert_true(not exists(select 1 from public.event_change_requests where id='90000000-0000-0000-0000-000000000006'),
 'AC-007.1.15: a failed notification rolls back the new request');
drop trigger test_notification_failure on public.change_request_notifications;
select set_config('request.jwt.claim.sub','',false);
update public.events set coordinator_id='00000000-0000-0000-0000-000000000004' where id='80000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(not exists(select 1 from public.change_request_notifications where event_id='80000000-0000-0000-0000-000000000001'),
 'AC-007.1.16: former coordinator loses access to notifications after reassignment');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Exercise the actual browser insert shape too: id is generated by the database.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.event_change_requests(event_id,organiser_id,proposed_changes,reason,status)
 values('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 '{"description":"New description"}','Browser insert fixture','submitted');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true((select count(*)=1 from public.change_request_notifications n
 join public.event_change_requests r on r.id=n.change_request_id where r.reason='Browser insert fixture' and n.recipient_id=auth.uid()),
 'AC-007.1.17: real browser-shaped organiser insert notifies the current assigned coordinator');
reset role;
select set_config('request.jwt.claim.sub','',false);
