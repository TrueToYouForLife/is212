-- Migration: 0082_us17_assignment_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US17's assignment notices follow each recipient's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0082_us17_assignment_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Production's system-wide switch is on (earlier test files may have left it otherwise).
update public.coordinator_assignment_notification_settings set in_app_enabled = true, email_enabled = true;

insert into auth.users (id, email) values
  ('a0820000-0000-0000-0000-000000000001', 'organiser-0082@example.test'), ('a0820000-0000-0000-0000-000000000002', 'coordinator-one-0082@example.test'),
  ('a0820000-0000-0000-0000-000000000003', 'coordinator-two-0082@example.test'), ('a0820000-0000-0000-0000-000000000004', 'lead-0082@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0820000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('a0820000-0000-0000-0000-000000000002', 'a0820000-0000-0000-0000-000000000003');
update public.profiles set role = 'coordinator_lead' where id = 'a0820000-0000-0000-0000-000000000004';
insert into public.events (id, organiser_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0823000-0000-0000-0000-000000000001', 'a0820000-0000-0000-0000-000000000001', '0082 Event', 'Fixture', '2040-03-01 09:00+08', '2040-03-01 11:00+08', 20, 'submitted', 'EVT-0082');

create function pg_temp.us33_assignment(recipient uuid, nth integer) returns table (in_app boolean, emailed boolean) language sql as $$
  select n.in_app_enabled, o.notification_type = 'coordinator_assignment'
  from public.coordinator_assignment_notifications n
  join public.event_coordinator_assignment_history h on h.id = n.assignment_history_id
  left join public.notification_outbox o on o.id = n.email_outbox_id
  where n.recipient_id = recipient
  order by h.assigned_at offset nth - 1 limit 1;
$$;

select set_config('request.jwt.claim.sub', 'a0820000-0000-0000-0000-000000000004', true);
insert into public.event_coordinator_assignment_history (event_id, previous_coordinator_id, new_coordinator_id, assigned_by)
values ('a0823000-0000-0000-0000-000000000001', null, 'a0820000-0000-0000-0000-000000000002', 'a0820000-0000-0000-0000-000000000004');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select in_app and coalesce(emailed, false) from pg_temp.us33_assignment('a0820000-0000-0000-0000-000000000002', 1))
  and (select in_app and coalesce(emailed, false) from pg_temp.us33_assignment('a0820000-0000-0000-0000-000000000001', 1)),
  'AC-033.4.16: an assignment reaches the Coordinator and the Organiser in the app and by email, as before');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0820000-0000-0000-0000-000000000001', 'coordinator_assignment', false, true);
select set_config('request.jwt.claim.sub', 'a0820000-0000-0000-0000-000000000004', true);
insert into public.event_coordinator_assignment_history (event_id, previous_coordinator_id, new_coordinator_id, assigned_by)
values ('a0823000-0000-0000-0000-000000000001', 'a0820000-0000-0000-0000-000000000002', 'a0820000-0000-0000-0000-000000000003', 'a0820000-0000-0000-0000-000000000004');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select not in_app and coalesce(emailed, false) from pg_temp.us33_assignment('a0820000-0000-0000-0000-000000000001', 2))
  and (select in_app and coalesce(emailed, false) from pg_temp.us33_assignment('a0820000-0000-0000-0000-000000000003', 1)),
  'AC-033.4.17: each recipient''s choice is their own: the Organiser with in-app off gets the reassignment by email only, the new Coordinator both');

rollback;
