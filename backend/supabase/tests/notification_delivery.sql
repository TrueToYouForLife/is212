-- US33 Choose notification channels by type (SCRUM-230), slice 2a: the sending helper (0079).
-- Disposable PostgreSQL only; run through the database runner. Fixtures run inside a
-- transaction that is rolled back. Auth is simulated; RLS is real where a test reads as a user.
-- The helpers are called as the database itself, the way features' triggers call them.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('79000000-0000-0000-0000-000000000001', 'organiser-us33d@example.test'),
  ('79000000-0000-0000-0000-000000000002', 'coordinator-us33d@example.test'),
  ('79000000-0000-0000-0000-000000000003', 'attendee-us33d@example.test'),
  ('79000000-0000-0000-0000-000000000004', 'other-attendee-us33d@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001'
  where id = '79000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '79000000-0000-0000-0000-000000000002';
update public.profiles set role = 'attendee'
  where id in ('79000000-0000-0000-0000-000000000003', '79000000-0000-0000-0000-000000000004');

insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference)
values ('79300000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000002',
  'US33 Gala', 'Fixture', '2039-11-01 09:00+08', '2039-11-01 11:00+08', 50, 'confirmed', 'EVT-US33-1');

-- The attendee's choices: email off for registrations, in-app off for the waiting list.
insert into public.notification_preferences (user_id, type_code, in_app, email) values
  ('79000000-0000-0000-0000-000000000003', 'registration_update', true, false),
  ('79000000-0000-0000-0000-000000000003', 'waitlist_update', false, true);

create function pg_temp.us33d_try(statement text) returns text
language plpgsql as $$
begin
  execute statement;
  return 'ok';
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us33d_emails(recipient uuid, kind text) returns integer
language sql as $$ select count(*)::integer from public.notification_outbox where recipient_id = recipient and notification_type = kind $$;

create function pg_temp.us33d_in_app(recipient uuid, kind text) returns integer
language sql as $$ select count(*)::integer from public.user_notifications where recipient_id = recipient and type_code = kind $$;

-- A user's feed as one JSON array, read as that user.
create function pg_temp.us33d_feed(actor uuid) returns jsonb
language plpgsql as $$
declare answer jsonb;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) into answer from public.get_my_notifications(100) f;
  perform set_config('request.jwt.claim.sub', '', true);
  return answer;
end $$;

-- ---------------------------------------------------------------------------
-- AC-033.4: delivered only through the channels enabled for the type
-- ---------------------------------------------------------------------------
select public.send_notification('79000000-0000-0000-0000-000000000004', 'registration_update',
  '79300000-0000-0000-0000-000000000001', 'You are registered for US33 Gala', 'See you there.');
set local role authenticated;
select pg_temp.us33d_feed('79000000-0000-0000-0000-000000000004') as us33d_default_feed \gset
reset role;
select pg_temp.assert_true(
  pg_temp.us33d_emails('79000000-0000-0000-0000-000000000004', 'registration_update') = 1
  and pg_temp.us33d_in_app('79000000-0000-0000-0000-000000000004', 'registration_update') = 1
  and jsonb_array_length(:'us33d_default_feed'::jsonb) = 1
  and (:'us33d_default_feed'::jsonb -> 0) @> '{"source": "notice", "title": "You are registered for US33 Gala", "event_reference": "EVT-US33-1"}',
  'AC-033.4.1: with no choices made, a notice is emailed and shown in the app once, not twice');

select public.send_notification('79000000-0000-0000-0000-000000000003', 'registration_update',
  '79300000-0000-0000-0000-000000000001', 'You are registered for US33 Gala', 'See you there.');
select public.send_notification('79000000-0000-0000-0000-000000000003', 'waitlist_update',
  '79300000-0000-0000-0000-000000000001', 'A place is available', 'Accept within 3 days.');
set local role authenticated;
select pg_temp.us33d_feed('79000000-0000-0000-0000-000000000003') as us33d_choice_feed \gset
reset role;
select pg_temp.assert_true(
  pg_temp.us33d_emails('79000000-0000-0000-0000-000000000003', 'registration_update') = 0
  and pg_temp.us33d_in_app('79000000-0000-0000-0000-000000000003', 'registration_update') = 1
  and pg_temp.us33d_emails('79000000-0000-0000-0000-000000000003', 'waitlist_update') = 1
  and pg_temp.us33d_in_app('79000000-0000-0000-0000-000000000003', 'waitlist_update') = 0
  and jsonb_array_length(:'us33d_choice_feed'::jsonb) = 1
  and (:'us33d_choice_feed'::jsonb -> 0) @> '{"source": "notice", "title": "You are registered for US33 Gala"}',
  'AC-033.4.2: with email off a notice is only in the app; with in-app off it is only emailed, and the feed does not show that email');

insert into public.notification_preferences (user_id, type_code, in_app, email)
values ('79000000-0000-0000-0000-000000000004', 'waitlist_update', false, false);
select public.send_notification('79000000-0000-0000-0000-000000000004', 'waitlist_update',
  '79300000-0000-0000-0000-000000000001', 'A place is available', 'Accept within 3 days.');
select pg_temp.assert_true(
  pg_temp.us33d_emails('79000000-0000-0000-0000-000000000004', 'waitlist_update') = 0
  and pg_temp.us33d_in_app('79000000-0000-0000-0000-000000000004', 'waitlist_update') = 0,
  'AC-033.4.3: with both off, nothing is sent');

-- Change requests: US7's system-wide email switch is off; in-app is on.
select (c.in_app and not c.email) as us33d_system_email_off
  from public.notification_channels('79000000-0000-0000-0000-000000000002', 'change_request') c \gset
select public.queue_notification_email('79000000-0000-0000-0000-000000000002', 'change_request',
  '79300000-0000-0000-0000-000000000001', 'Ready for review', 'Change request.') is null as us33d_held_back \gset
update public.change_request_notification_settings set email_enabled = true where notification_type = 'change_request_submitted';
insert into public.notification_preferences (user_id, type_code, in_app, email)
values ('79000000-0000-0000-0000-000000000002', 'coordinator_assignment', true, false);
update public.coordinator_assignment_notification_settings set in_app_enabled = false where notification_type = 'coordinator_assignment';
select c.email as us33d_system_email_on
  from public.notification_channels('79000000-0000-0000-0000-000000000002', 'change_request') c \gset
select (not c.in_app and not c.email) as us33d_both_closed
  from public.notification_channels('79000000-0000-0000-0000-000000000002', 'coordinator_assignment') c \gset
select pg_temp.assert_true(
  :'us33d_system_email_off' and :'us33d_held_back' and :'us33d_system_email_on' and :'us33d_both_closed',
  'AC-033.4.4: a channel is used only when both the person''s choice and the system-wide switch allow it');

select pg_temp.assert_true(
  (select bool_and(c.in_app and c.email) from public.notification_channels('79000000-0000-0000-0000-000000000001', 'event_request_decision') c)
  and (select c.email from public.notification_channels('79000000-0000-0000-0000-000000000004', 'registration_update') c),
  'AC-033.4.5: each person''s choices are their own: one attendee turning email off leaves another''s on');

select pg_temp.assert_true(
  (select notification_type = 'registration_update' and recipient_id = '79000000-0000-0000-0000-000000000004'
          and recipient_email = 'other-attendee-us33d@example.test'
   from public.notification_outbox where recipient_id = '79000000-0000-0000-0000-000000000004' and notification_type = 'registration_update')
  and pg_temp.us33d_try($sql$select public.notification_channels('79000000-0000-0000-0000-000000000004', 'no_such_type')$sql$) = '22023'
  and public.queue_notification_email(null, 'registration_update', '79300000-0000-0000-0000-000000000001', 's', 'b') is null,
  'AC-033.4.6: each email records its type and recipient; an unknown type is refused; no recipient means nothing is queued');

set local role authenticated;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-000000000003', true);
select pg_temp.us33d_try($sql$select public.send_notification('79000000-0000-0000-0000-000000000004', 'registration_update', '79300000-0000-0000-0000-000000000001', 'Fake', 'Fake')$sql$) as us33d_fake_send \gset
select pg_temp.us33d_try($sql$select public.notification_channels('79000000-0000-0000-0000-000000000004', 'registration_update')$sql$) as us33d_peek \gset
select pg_temp.us33d_try($sql$insert into public.user_notifications (recipient_id, type_code, subject, body) values ('79000000-0000-0000-0000-000000000004', 'registration_update', 'Fake', 'Fake')$sql$) as us33d_fake_insert \gset
select count(*) as us33d_others_visible from public.user_notifications where recipient_id <> '79000000-0000-0000-0000-000000000003' \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us33d_fake_send' = '42501' and :'us33d_peek' = '42501' and :'us33d_fake_insert' = '42501' and :'us33d_others_visible' = 0,
  'AC-033.4.7: nobody can send, inspect or plant a notice from the app, or read anyone else''s');

-- Emails from features not yet moved onto the helper still appear in the feed as before.
insert into public.notification_outbox (event_id, recipient_email, subject, body)
values ('79300000-0000-0000-0000-000000000001', 'other-attendee-us33d@example.test', 'Legacy notice', 'From an unconverted feature.');
set local role authenticated;
select pg_temp.us33d_feed('79000000-0000-0000-0000-000000000004') as us33d_legacy_feed \gset
reset role;
select pg_temp.assert_true(
  exists (select 1 from jsonb_array_elements(:'us33d_legacy_feed'::jsonb) x where x @> '{"source": "email", "title": "Legacy notice"}'),
  'AC-033.4.8: an email from a feature not yet using the helper still shows in the feed, so nothing changes until each feature moves');

set local role authenticated;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-000000000004', true);
select f.id as us33d_notice_id from public.get_my_notifications(100) f where f.source = 'notice' \gset
select public.count_my_unread_notifications() as us33d_unread_before \gset
select public.mark_notification_read('notice', :'us33d_notice_id');
select public.count_my_unread_notifications() as us33d_unread_after \gset
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-000000000003', true);
select pg_temp.us33d_try(format($sql$select public.mark_notification_read('notice', %L)$sql$, :'us33d_notice_id')) as us33d_mark_others \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us33d_unread_before' = 2 and :'us33d_unread_after' = 1 and :'us33d_mark_others' = 'P0002',
  'AC-033.4.9: an in-app copy counts as unread and is marked read like any notice, only by its recipient');

-- ---------------------------------------------------------------------------
-- AC-033.5: a choice applies to notifications created after it
-- ---------------------------------------------------------------------------
insert into public.notification_preferences (user_id, type_code, in_app, email)
values ('79000000-0000-0000-0000-000000000004', 'registration_update', false, false);
select public.send_notification('79000000-0000-0000-0000-000000000004', 'registration_update',
  '79300000-0000-0000-0000-000000000001', 'You have withdrawn', 'Sorry to see you go.');
select pg_temp.assert_true(
  pg_temp.us33d_emails('79000000-0000-0000-0000-000000000004', 'registration_update') = 1
  and pg_temp.us33d_in_app('79000000-0000-0000-0000-000000000004', 'registration_update') = 1,
  'AC-033.5.1: turning a type off stops new notices but leaves ones already sent in place');

rollback;
