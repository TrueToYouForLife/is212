-- Migration: 0081_us7_change_request_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US7's change-request notices follow the Coordinator's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0081_us7_change_request_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- In-app is on in production (earlier test files may have left it otherwise); 0081 turned email on.
update public.change_request_notification_settings set in_app_enabled = true;

insert into auth.users (id, email) values
  ('a0810000-0000-0000-0000-000000000001', 'organiser-0081@example.test'), ('a0810000-0000-0000-0000-000000000002', 'coordinator-0081@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0810000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0810000-0000-0000-0000-000000000002';
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0813000-0000-0000-0000-000000000001', 'a0810000-0000-0000-0000-000000000001', 'a0810000-0000-0000-0000-000000000002', '0081 Event', 'Fixture', '2040-02-01 09:00+08', '2040-02-01 11:00+08', 20, 'approved', 'EVT-0081');

create function pg_temp.us33_cr(n integer) returns void language sql as $$
  insert into public.event_change_requests (id, event_id, organiser_id, proposed_changes, reason)
  values (('a0815000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'a0813000-0000-0000-0000-000000000001', 'a0810000-0000-0000-0000-000000000001', '{"name":"New name"}', 'Fixture ' || n);
$$;
create function pg_temp.us33_cr_notice(k integer) returns table (in_app boolean, emailed boolean) language sql as $$
  select cn.in_app_enabled, o.notification_type = 'change_request'
  from public.change_request_notifications cn
  left join public.notification_outbox o on o.id = cn.email_outbox_id
  where cn.change_request_id = ('a0815000-0000-0000-0000-' || lpad(k::text, 12, '0'))::uuid;
$$;

select pg_temp.us33_cr(1);
select pg_temp.assert_true(
  (select in_app and coalesce(emailed, false) from pg_temp.us33_cr_notice(1))
  and (select email_enabled from public.change_request_notification_settings where notification_type = 'change_request_submitted'),
  'AC-033.4.14: a change request reaches its Coordinator in the app and, now by default, by email; the email is linked to the in-app notice');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0810000-0000-0000-0000-000000000002', 'change_request', false, true);
select pg_temp.us33_cr(2);
update public.notification_preferences set in_app = false, email = false where user_id = 'a0810000-0000-0000-0000-000000000002' and type_code = 'change_request';
select pg_temp.us33_cr(3);
select pg_temp.assert_true(
  (select not in_app and coalesce(emailed, false) from pg_temp.us33_cr_notice(2))
  and not exists (select 1 from pg_temp.us33_cr_notice(3)),
  'AC-033.4.15: with in-app off the notice is hidden but still emailed; with both off nothing is recorded or sent');

rollback;
