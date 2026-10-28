-- Migration: 0084_us13_equipment_change_notice_channels.sql
-- US33 slice 2b (SCRUM-230): US13's equipment-request notices follow each Technical Support member's in-app choice. Disposable PostgreSQL only; run through the database
-- runner, which applies 0084_us13_equipment_change_notice_channels.sql just before this file (the runner replays older versions of
-- the function earlier on). Fixtures run inside a transaction that is rolled back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('a0840000-0000-0000-0000-000000000001', 'organiser-0084@example.test'), ('a0840000-0000-0000-0000-000000000002', 'coordinator-0084@example.test'),
  ('a0840000-0000-0000-0000-000000000003', 'tech-one-0084@example.test'), ('a0840000-0000-0000-0000-000000000004', 'tech-two-0084@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = 'a0840000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = 'a0840000-0000-0000-0000-000000000002';
update public.profiles set role = 'tech_support' where id in ('a0840000-0000-0000-0000-000000000003', 'a0840000-0000-0000-0000-000000000004');
insert into public.equipment_types (id, name, category) values ('a0842000-0000-0000-0000-000000000001', '0084 Microphone', 'Audio');
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end, expected_attendance, status, reference) values
  ('a0843000-0000-0000-0000-000000000001', 'a0840000-0000-0000-0000-000000000001', 'a0840000-0000-0000-0000-000000000002', '0084 Event', 'Fixture', '2040-05-01 09:00+08', '2040-05-01 11:00+08', 20, 'planning', 'EVT-0084');
insert into public.notification_preferences (user_id, type_code, in_app, email) values ('a0840000-0000-0000-0000-000000000004', 'equipment_requirement_change', false, true);

insert into public.event_equipment_requirements (event_id, type_id, quantity, essential, created_by)
values ('a0843000-0000-0000-0000-000000000001', 'a0842000-0000-0000-0000-000000000001', 1, true, 'a0840000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
  (select count(*) = 1 from public.equipment_requirement_notifications where event_id = 'a0843000-0000-0000-0000-000000000001' and recipient_id = 'a0840000-0000-0000-0000-000000000003' and action = 'added')
  and not exists (select 1 from public.equipment_requirement_notifications where event_id = 'a0843000-0000-0000-0000-000000000001' and recipient_id = 'a0840000-0000-0000-0000-000000000004'),
  'AC-033.4.20: a new equipment request reaches each Technical Support member who has it on in-app, and not one who turned it off');

rollback;
