-- US33 Choose notification channels by type (SCRUM-230), slice 1 (0077). Disposable
-- PostgreSQL only; run through the database runner. Fixtures run inside a transaction that is
-- rolled back. Auth is simulated; RLS is real.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('33000000-0000-0000-0000-000000000001', 'organiser-us33@example.test'),
  ('33000000-0000-0000-0000-000000000002', 'coordinator-us33@example.test'),
  ('33000000-0000-0000-0000-000000000003', 'venue-staff-us33@example.test'),
  ('33000000-0000-0000-0000-000000000004', 'tech-us33@example.test'),
  ('33000000-0000-0000-0000-000000000005', 'attendee-us33@example.test'),
  ('33000000-0000-0000-0000-000000000006', 'lead-us33@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '33000000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '33000000-0000-0000-0000-000000000002';
update public.profiles set role = 'venue_staff' where id = '33000000-0000-0000-0000-000000000003';
update public.profiles set role = 'tech_support' where id = '33000000-0000-0000-0000-000000000004';
update public.profiles set role = 'attendee' where id = '33000000-0000-0000-0000-000000000005';
update public.profiles set role = 'coordinator_lead' where id = '33000000-0000-0000-0000-000000000006';

-- A user's settings as one JSON array, or the SQLSTATE of a refusal.
create function pg_temp.us33_settings(actor uuid) returns jsonb
language plpgsql as $$
declare answer jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into answer from public.get_my_notification_preferences() s;
  return answer;
exception when others then
  return to_jsonb(sqlstate);
end $$;

-- Runs one statement as a user: 'ok', 'rows:N' for a query, or the SQLSTATE of a refusal.
create function pg_temp.us33_as(actor uuid, statement text) returns text
language plpgsql as $$
declare answer text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  execute statement into answer;
  return coalesce(nullif(answer, ''), 'ok');
exception when others then
  return sqlstate;
end $$;

create function pg_temp.us33_type(settings jsonb, wanted text) returns jsonb
language sql as $$ select x from jsonb_array_elements(settings) x where x ->> 'type_code' = wanted $$;

create function pg_temp.us33_codes(settings jsonb) returns text[]
language sql as $$ select coalesce(array_agg(t.x ->> 'type_code' order by t.n), '{}') from jsonb_array_elements(settings) with ordinality as t(x, n) $$;

set local role authenticated;
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000002') as us33_coordinator \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000001') as us33_organiser \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000003') as us33_venue_staff \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000004') as us33_tech \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000005') as us33_attendee \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000006') as us33_lead \gset
select pg_temp.us33_settings(null) as us33_signed_out \gset
reset role;

-- ---------------------------------------------------------------------------
-- AC-033.1: a user sees the notification types that apply to their role
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  -- US44 (0111) adds safety review decisions for Coordinators.
  pg_temp.us33_codes(:'us33_coordinator') = array['coordinator_assignment', 'change_request', 'arrangement_review',
    'venue_booking_decision', 'venue_block_alert', 'equipment_reservation_outcome', 'safety_review_decision']
  and pg_temp.us33_codes(:'us33_organiser') = array['event_request_decision', 'coordinator_assignment']
  and pg_temp.us33_codes(:'us33_venue_staff') = array['venue_booking_request']
  and pg_temp.us33_codes(:'us33_tech') = array['equipment_requirement_change']
  and pg_temp.us33_codes(:'us33_attendee') = array['registration_update', 'waitlist_update'],
  'AC-033.1.1: each role sees exactly the notification types it receives, in a fixed order');

select pg_temp.assert_true(
  pg_temp.us33_type(:'us33_coordinator', 'change_request')
    @> '{"label": "Change requests to review", "description": "When an Organiser asks to change one of your events."}'
  and :'us33_lead' = '[]' and :'us33_signed_out' = '"42501"',
  'AC-033.1.2: each type has a name and says when it is sent; a role that receives none sees none; signed out is refused');

-- ---------------------------------------------------------------------------
-- AC-033.3: anything not yet chosen is on for both channels
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select bool_and((x ->> 'in_app')::boolean and (x ->> 'email')::boolean and not (x ->> 'customised')::boolean)
   from jsonb_array_elements(:'us33_coordinator'::jsonb || :'us33_attendee'::jsonb) x),
  'AC-033.3.1: a new user receives every type both in-app and by email until they change it');

-- ---------------------------------------------------------------------------
-- AC-033.2: each channel turns on or off independently, per type
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select public.set_my_notification_preference('change_request', true, false)::text$sql$) as us33_email_off \gset
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select public.set_my_notification_preference('arrangement_review', false, true)::text$sql$) as us33_in_app_off \gset
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select public.set_my_notification_preference('venue_block_alert', false, false)::text$sql$) as us33_both_off \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000002') as us33_coordinator_after \gset
reset role;
select pg_temp.assert_true(
  :'us33_email_off' = 'ok' and :'us33_in_app_off' = 'ok' and :'us33_both_off' = 'ok'
  and pg_temp.us33_type(:'us33_coordinator_after', 'change_request') @> '{"in_app": true, "email": false, "customised": true}'
  and pg_temp.us33_type(:'us33_coordinator_after', 'arrangement_review') @> '{"in_app": false, "email": true, "customised": true}'
  and pg_temp.us33_type(:'us33_coordinator_after', 'venue_block_alert') @> '{"in_app": false, "email": false, "customised": true}'
  and pg_temp.us33_type(:'us33_coordinator_after', 'venue_booking_decision') @> '{"in_app": true, "email": true, "customised": false}',
  'AC-033.2.1: in-app and email are switched independently for each type, and other types keep their settings');

set local role authenticated;
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select public.set_my_notification_preference('change_request', true, true)::text$sql$) as us33_back_on \gset
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select count(*)::text from public.notification_preferences where type_code = 'change_request'$sql$) as us33_rows \gset
reset role;
select pg_temp.assert_true(
  :'us33_back_on' = 'ok' and :'us33_rows' = '1'
  and (select in_app and email from public.notification_preferences
       where user_id = '33000000-0000-0000-0000-000000000002' and type_code = 'change_request'),
  'AC-033.2.2: changing a type again updates the one choice rather than adding another');

set local role authenticated;
select pg_temp.us33_as('33000000-0000-0000-0000-000000000005',
  $sql$select public.set_my_notification_preference('change_request', true, false)::text$sql$) as us33_not_my_type \gset
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select public.set_my_notification_preference('no_such_type', true, false)::text$sql$) as us33_unknown_type \gset
select pg_temp.us33_as('33000000-0000-0000-0000-000000000002',
  $sql$select public.set_my_notification_preference('change_request', null, false)::text$sql$) as us33_missing_choice \gset
select pg_temp.us33_as(null,
  $sql$select public.set_my_notification_preference('change_request', true, false)::text$sql$) as us33_signed_out_save \gset
reset role;
select pg_temp.assert_true(
  :'us33_not_my_type' = '22023' and :'us33_unknown_type' = '22023' and :'us33_missing_choice' = '22023'
  and :'us33_signed_out_save' = '42501'
  and not exists (select 1 from public.notification_preferences where user_id = '33000000-0000-0000-0000-000000000005'),
  'AC-033.2.3: a type that does not apply to you, an unknown type or a missing choice is refused, and nothing is saved');

set local role authenticated;
select pg_temp.us33_as('33000000-0000-0000-0000-000000000001',
  $sql$select count(*)::text from public.notification_preferences$sql$) as us33_organiser_reads \gset
select pg_temp.us33_as('33000000-0000-0000-0000-000000000001',
  $sql$insert into public.notification_preferences (user_id, type_code, in_app, email)
       values ('33000000-0000-0000-0000-000000000002', 'coordinator_assignment', false, false) returning 'x'$sql$) as us33_forge \gset
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000001') as us33_organiser_after \gset
reset role;
select pg_temp.assert_true(
  :'us33_organiser_reads' = '0' and :'us33_forge' = '42501'
  and pg_temp.us33_type(:'us33_organiser_after', 'coordinator_assignment') @> '{"in_app": true, "email": true, "customised": false}',
  'AC-033.2.4: each person''s choices are their own: nobody can read or change another''s, and one person''s choice leaves others on the default');

-- ---------------------------------------------------------------------------
-- AC-033.2: a type switched off for everyone says so (0106)
-- ---------------------------------------------------------------------------
update public.change_request_notification_settings set email_enabled = false where notification_type = 'change_request_submitted';
set local role authenticated;
select pg_temp.us33_settings('33000000-0000-0000-0000-000000000002') as us33_switched_off \gset
reset role;
select pg_temp.assert_true(
  pg_temp.us33_type(:'us33_switched_off', 'change_request')
    @> '{"email": true, "email_off_for_everyone": true, "in_app_off_for_everyone": false}'
  and pg_temp.us33_type(:'us33_switched_off', 'arrangement_review')
    @> '{"email_off_for_everyone": false, "in_app_off_for_everyone": false}'
  and (select bool_and(not (x ->> 'in_app_off_for_everyone')::boolean)
       from jsonb_array_elements(:'us33_switched_off'::jsonb) x),
  'AC-033.2.9: when an administrator switches a channel off for everyone, the settings say so for that type only, and the person''s own choice is kept');

rollback;
