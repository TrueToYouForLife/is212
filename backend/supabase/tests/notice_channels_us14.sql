-- Migration: 0083_us14_equipment_outcome_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US14's equipment results follow the Coordinator's channel choices. Disposable PostgreSQL only; run through the database
-- runner, which applies 0083_us14_equipment_outcome_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Production's system-wide switch is on (earlier test files may have left it otherwise).
update public.equipment_notification_settings set in_app_enabled = true, email_enabled = true;

insert into auth.users (id, email) values
  ('a0830000-0000-0000-0000-000000000001', 'organiser-0083@example.test'), ('a0830000-0000-0000-0000-000000000002', 'coordinator-0083@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0830000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0830000-0000-0000-0000-000000000002';
insert into public.equipment_types (id, name, category) values ('a0832000-0000-0000-0000-000000000001', '0083 Projector', 'Visual');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0833000-0000-0000-0000-000000000001', 'a0830000-0000-0000-0000-000000000001', 'a0830000-0000-0000-0000-000000000002', '0083 Event', 'Fixture', '2040-04-01 09:00+08', '2040-04-01 11:00+08', 20, 'planning', 'EVT-0083');
insert into public.event_equipment_requirements (id, event_id, type_id, quantity, essential, created_by)
values ('a0834000-0000-0000-0000-000000000001', 'a0833000-0000-0000-0000-000000000001', 'a0832000-0000-0000-0000-000000000001', 2, true, 'a0830000-0000-0000-0000-000000000002');

create function pg_temp.us33_outcome(action text) returns table (in_app boolean, emailed boolean) language plpgsql as $$
begin
  perform public.queue_equipment_outcome_notice(r, e, action, 2, null, null)
  from public.event_equipment_requirements r, public.events e where r.id = 'a0834000-0000-0000-0000-000000000001' and e.id = 'a0833000-0000-0000-0000-000000000001';
  return query select n.in_app_enabled, o.notification_type = 'equipment_reservation_outcome'
  from public.equipment_requirement_notifications n
  left join public.notification_outbox o on o.id = n.email_outbox_id
  where n.requirement_id = 'a0834000-0000-0000-0000-000000000001' and n.recipient_id = 'a0830000-0000-0000-0000-000000000002'
    and n.action = us33_outcome.action;
end $$;

select pg_temp.assert_true(
  (select in_app and coalesce(emailed, false) from pg_temp.us33_outcome('reserved')),
  'AC-033.4.18: an equipment result reaches the Coordinator in the app and by email, as before');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0830000-0000-0000-0000-000000000002', 'equipment_reservation_outcome', false, true);
select (not in_app and coalesce(emailed, false)) as us33_in_app_off from pg_temp.us33_outcome('partially_reserved') \gset
update public.notification_preferences set in_app = true, email = false where user_id = 'a0830000-0000-0000-0000-000000000002' and type_code = 'equipment_reservation_outcome';
select (in_app and emailed is null) as us33_email_off from pg_temp.us33_outcome('unavailable') \gset
select pg_temp.assert_true(:'us33_in_app_off' and :'us33_email_off',
  'AC-033.4.19: with in-app off the result is hidden but emailed; with email off it is only in the app');

rollback;
