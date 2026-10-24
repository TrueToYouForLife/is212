-- US43 Operational safety review (SCRUM-239), slice 1 (0108). Disposable PostgreSQL only; run
-- through the database runner, which applies 0108 just before this file. Fixtures run inside a
-- transaction that is rolled back. Auth is simulated; RLS is real where a test reads as a user.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('43b00000-0000-0000-0000-000000000001', 'organiser-43b@example.test'), ('43b00000-0000-0000-0000-000000000002', 'coordinator-43b@example.test'),
  ('43b00000-0000-0000-0000-000000000003', 'other-coordinator-43b@example.test'), ('43b00000-0000-0000-0000-000000000004', 'venue-43b@example.test'),
  ('43b00000-0000-0000-0000-000000000005', 'tech-43b@example.test'), ('43b00000-0000-0000-0000-000000000006', 'safety-one-43b@example.test'),
  ('43b00000-0000-0000-0000-000000000007', 'safety-two-43b@example.test'), ('43b00000-0000-0000-0000-000000000008', 'lead-43b@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '43b00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('43b00000-0000-0000-0000-000000000002', '43b00000-0000-0000-0000-000000000003');
update public.profiles set role = 'venue_staff' where id = '43b00000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '43b00000-0000-0000-0000-000000000005';
update public.profiles set role = 'safety_officer' where id in ('43b00000-0000-0000-0000-000000000006', '43b00000-0000-0000-0000-000000000007');
update public.profiles set role = 'coordinator_lead' where id = '43b00000-0000-0000-0000-000000000008';

insert into public.venues (id, name, location, capacity, layout, status) values ('43b10000-0000-0000-0000-000000000001', 'US43 Hall', 'Level 1', 200, 'theatre', 'active');
insert into public.equipment_types (id, name, category) values ('43b20000-0000-0000-0000-000000000001', 'US43 Projector', 'Visual');

-- E1 ready. E2 venue awaiting Venue Staff. E3 essential item unavailable. E4 no programme.
-- E5 an equipment request Technical Support has not reviewed. E6 ready, taking registrations.
-- E7 ready but only Approved. E8 its venue still awaiting Venue Staff (approved later).
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme, registration_required) values
  ('43b30000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 1', 'Fixture', '2041-01-11 09:00+08', '2041-01-11 11:00+08', 40, 'planning', 'EVT-43B-1', 'Talks', false),
  ('43b30000-0000-0000-0000-000000000002', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 2', 'Fixture', '2041-02-12 09:00+08', '2041-02-12 11:00+08', 40, 'planning', 'EVT-43B-2', 'Talks', false),
  ('43b30000-0000-0000-0000-000000000003', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 3', 'Fixture', '2041-03-13 09:00+08', '2041-03-13 11:00+08', 40, 'planning', 'EVT-43B-3', 'Talks', false),
  ('43b30000-0000-0000-0000-000000000004', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 4', 'Fixture', '2041-04-14 09:00+08', '2041-04-14 11:00+08', 40, 'planning', 'EVT-43B-4', null, false),
  ('43b30000-0000-0000-0000-000000000005', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 5', 'Fixture', '2041-05-15 09:00+08', '2041-05-15 11:00+08', 40, 'planning', 'EVT-43B-5', 'Talks', false),
  ('43b30000-0000-0000-0000-000000000006', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 6', 'Fixture', '2041-06-16 09:00+08', '2041-06-16 11:00+08', 40, 'planning', 'EVT-43B-6', 'Talks', true),
  ('43b30000-0000-0000-0000-000000000007', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 7', 'Fixture', '2041-07-17 09:00+08', '2041-07-17 11:00+08', 40, 'approved', 'EVT-43B-7', 'Talks', false),
  ('43b30000-0000-0000-0000-000000000008', '43b00000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'US43 Event 8', 'Fixture', '2041-08-18 09:00+08', '2041-08-18 11:00+08', 40, 'planning', 'EVT-43B-8', 'Talks', false);

insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at) values
  ('43b50000-0000-0000-0000-000000000001', '43b30000-0000-0000-0000-000000000001', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('43b50000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000002', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days'),
  ('43b50000-0000-0000-0000-000000000003', '43b30000-0000-0000-0000-000000000003', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('43b50000-0000-0000-0000-000000000004', '43b30000-0000-0000-0000-000000000004', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('43b50000-0000-0000-0000-000000000005', '43b30000-0000-0000-0000-000000000005', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('43b50000-0000-0000-0000-000000000006', '43b30000-0000-0000-0000-000000000006', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('43b50000-0000-0000-0000-000000000007', '43b30000-0000-0000-0000-000000000007', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'confirmed', null),
  ('43b50000-0000-0000-0000-000000000008', '43b30000-0000-0000-0000-000000000008', '43b10000-0000-0000-0000-000000000001', '43b00000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '3 days');

insert into public.event_equipment_requirements (id, event_id, type_id, quantity, essential, created_by) values
  ('43b40000-0000-0000-0000-000000000001', '43b30000-0000-0000-0000-000000000001', '43b20000-0000-0000-0000-000000000001', 1, true, '43b00000-0000-0000-0000-000000000002'),
  ('43b40000-0000-0000-0000-000000000003', '43b30000-0000-0000-0000-000000000003', '43b20000-0000-0000-0000-000000000001', 1, true, '43b00000-0000-0000-0000-000000000002'),
  ('43b40000-0000-0000-0000-000000000005', '43b30000-0000-0000-0000-000000000005', '43b20000-0000-0000-0000-000000000001', 1, false, '43b00000-0000-0000-0000-000000000002');
update public.event_equipment_requirements set status = 'reserved' where id = '43b40000-0000-0000-0000-000000000001';
update public.event_equipment_requirements set status = 'unavailable' where id = '43b40000-0000-0000-0000-000000000003';

create function pg_temp.us43_status(event uuid) returns text language sql as $$ select status from public.events where id = event $$;

-- Calls send_for_safety_review as a signed-in user: 'ok' or the SQLSTATE of the refusal.
create function pg_temp.us43_send(actor uuid, event uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.send_for_safety_review(event);
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

-- Makes one change as a given person: the status rules see them, RLS does not.
create function pg_temp.us43_by(actor uuid, statement text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  execute statement;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

create function pg_temp.us43_set(event uuid, status text) returns text language sql as $$
  select format('update public.events set status = %L where id = %L', status, event) $$;

-- ---------------------------------------------------------------------------
-- AC-043.1: the Coordinator sends an event for review once every arrangement is complete
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000002') = '55000' and pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000003') = '55000'
  and pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000004') = '55000' and pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000005') = '55000'
  and pg_temp.us43_status('43b30000-0000-0000-0000-000000000002') = 'planning' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000003') = 'planning'
  and pg_temp.us43_status('43b30000-0000-0000-0000-000000000004') = 'planning' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000005') = 'planning',
  'AC-043.1.1: an event is not sent while a venue awaits Venue Staff, an essential item is unavailable, the programme is missing or Technical Support has not reviewed a request');

select pg_temp.assert_true(
  pg_temp.us43_send('43b00000-0000-0000-0000-000000000003', '43b30000-0000-0000-0000-000000000001') = '42501' and pg_temp.us43_send('43b00000-0000-0000-0000-000000000001', '43b30000-0000-0000-0000-000000000001') = '42501'
  and pg_temp.us43_send('43b00000-0000-0000-0000-000000000006', '43b30000-0000-0000-0000-000000000001') = '42501' and pg_temp.us43_send('43b00000-0000-0000-0000-000000000008', '43b30000-0000-0000-0000-000000000001') = '42501'
  and pg_temp.us43_status('43b30000-0000-0000-0000-000000000001') = 'planning',
  'AC-043.1.2: only the event''s assigned Coordinator can send it: another Coordinator, the Organiser, a Safety Officer or a Lead is refused');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('43b00000-0000-0000-0000-000000000007', 'safety_review_request', true, false);
select pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000001') as us43_sent \gset
select pg_temp.assert_true(
  :'us43_sent' = 'ok' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000001') = 'awaiting_safety_review'
  and (select safety_review_requested_by = '43b00000-0000-0000-0000-000000000002' and safety_review_requested_at is not null from public.events where id = '43b30000-0000-0000-0000-000000000001'),
  'AC-043.1.3: once every arrangement is complete, the Coordinator sends it, and who sent it and when is recorded');

select pg_temp.assert_true(
  pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000006') = 'ok' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000006') = 'awaiting_safety_review',
  'AC-043.1.4: registration setup does not hold the review back, since registration only opens on confirmation');

select pg_temp.assert_true(
  pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000007') = '22000' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000007') = 'approved'
  and pg_temp.us43_send('43b00000-0000-0000-0000-000000000002', '43b30000-0000-0000-0000-000000000001') = '22000',
  'AC-043.1.5: only an event in Planning can be sent; one still Approved, or already sent, is refused');

update public.venue_bookings set status = 'confirmed', reviewed_by = '43b00000-0000-0000-0000-000000000004', reviewed_at = now() where id = '43b50000-0000-0000-0000-000000000008';
select pg_temp.assert_true(
  pg_temp.us43_status('43b30000-0000-0000-0000-000000000008') = 'planning' and public.event_ready_for_safety_review('43b30000-0000-0000-0000-000000000008'),
  'AC-043.1.6: an event never leaves Planning by itself, even once every arrangement is complete');

select pg_temp.assert_true(
  pg_temp.us43_by('43b00000-0000-0000-0000-000000000002', pg_temp.us43_set('43b30000-0000-0000-0000-000000000002', 'awaiting_safety_review')) = '55000'
  and pg_temp.us43_by('43b00000-0000-0000-0000-000000000001', pg_temp.us43_set('43b30000-0000-0000-0000-000000000008', 'awaiting_safety_review')) = '42501'
  and pg_temp.us43_status('43b30000-0000-0000-0000-000000000002') = 'planning' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000008') = 'planning',
  'AC-043.1.7: a direct status change cannot skip the check: an unready event or a non-Coordinator is refused');

-- ---------------------------------------------------------------------------
-- AC-043.2: the event shows as Awaiting Safety Review and the Safety Officers are notified
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox where event_id = '43b30000-0000-0000-0000-000000000001' and recipient_id = '43b00000-0000-0000-0000-000000000006'
     and notification_type = 'safety_review_request' and subject = 'Safety review needed: EVT-43B-1' and body like '%Expected attendance: 40%')
  and (select count(*) = 1 from public.user_notifications where event_id = '43b30000-0000-0000-0000-000000000001' and recipient_id = '43b00000-0000-0000-0000-000000000006')
  and not exists (select 1 from public.notification_outbox where event_id = '43b30000-0000-0000-0000-000000000001' and recipient_id = '43b00000-0000-0000-0000-000000000007')
  and (select count(*) = 1 from public.user_notifications where event_id = '43b30000-0000-0000-0000-000000000001' and recipient_id = '43b00000-0000-0000-0000-000000000007'),
  'AC-043.2.1: each Safety Officer is told once, naming the event and its attendance, through the channels they chose');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43b00000-0000-0000-0000-000000000006', true);
select count(*) as us43_officer_feed from public.get_my_notifications(100) f where f.event_id = '43b30000-0000-0000-0000-000000000001' \gset
select set_config('request.jwt.claim.sub', '43b00000-0000-0000-0000-000000000002', true);
select count(*) as us43_coordinator_feed from public.get_my_notifications(100) f
  where f.event_id = '43b30000-0000-0000-0000-000000000001' and f.title like 'Safety review needed%' \gset
select set_config('request.jwt.claim.sub', '43b00000-0000-0000-0000-000000000006', true);
select count(*) = 1 as us43_officer_type from public.get_my_notification_preferences() where type_code = 'safety_review_request' \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us43_officer_feed' = 1 and :'us43_coordinator_feed' = 0 and :'us43_officer_type',
  'AC-043.2.2: the notice appears once in each Safety Officer''s notifications, nobody else''s, and Safety Officers can choose its channels');

select pg_temp.assert_true(
  pg_temp.us43_by(null, $sql$update public.profiles set role = 'safety' where id = '43b00000-0000-0000-0000-000000000006'$sql$) = '23514'
  and (select role = 'safety_officer' from public.profiles where id = '43b00000-0000-0000-0000-000000000006'),
  'AC-043.2.3: Safety Officer is a role an account can hold; an unknown role is still refused');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43b00000-0000-0000-0000-000000000002', true);
select detail as us43_line_sent from public.get_event_readiness('43b30000-0000-0000-0000-000000000001') where arrangement = 'safety_review' \gset
select detail as us43_line_planning from public.get_event_readiness('43b30000-0000-0000-0000-000000000002') where arrangement = 'safety_review' \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us43_line_sent' = 'With the Safety Officer for review.'
  and :'us43_line_planning' = 'Send it to the Safety Officer once everything above is complete.',
  'AC-043.2.4: the event''s readiness shows its safety review: waiting to be sent, then with the Safety Officer');

-- ---------------------------------------------------------------------------
-- AC-043.3: while awaiting review the event cannot move to In Preparation or Confirmed
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us43_by('43b00000-0000-0000-0000-000000000002', pg_temp.us43_set('43b30000-0000-0000-0000-000000000001', 'in_preparation')) = '42501'
  and pg_temp.us43_by('43b00000-0000-0000-0000-000000000002', pg_temp.us43_set('43b30000-0000-0000-0000-000000000001', 'confirmed')) = '22000'
  and pg_temp.us43_status('43b30000-0000-0000-0000-000000000001') = 'awaiting_safety_review',
  'AC-043.3.1: a Coordinator cannot move an event awaiting review to In Preparation or Confirmed');

select pg_temp.assert_true(
  pg_temp.us43_by('43b00000-0000-0000-0000-000000000002', pg_temp.us43_set('43b30000-0000-0000-0000-000000000008', 'confirmed')) = '22000' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000008') = 'planning',
  'AC-043.3.2: an event in Planning can no longer be confirmed without its safety review');

select pg_temp.assert_true(
  pg_temp.us43_by('43b00000-0000-0000-0000-000000000006', pg_temp.us43_set('43b30000-0000-0000-0000-000000000001', 'in_preparation')) = 'ok'
  and pg_temp.us43_by('43b00000-0000-0000-0000-000000000002', pg_temp.us43_set('43b30000-0000-0000-0000-000000000006', 'cancelled')) = 'ok'
  and pg_temp.us43_status('43b30000-0000-0000-0000-000000000001') = 'in_preparation' and pg_temp.us43_status('43b30000-0000-0000-0000-000000000006') = 'cancelled',
  'AC-043.3.3: only a Safety Officer''s decision moves the event on; its Coordinator can still cancel it');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43b00000-0000-0000-0000-000000000008', true);
select active_event_count as us43_active from public.list_assignment_coordinators() where coordinator_id = '43b00000-0000-0000-0000-000000000002' \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(:'us43_active' = 7,
  'AC-043.3.4: events in the safety stages still count as the Coordinator''s active events for the Lead');

select pg_temp.assert_true(
  public.is_valid_status_transition('submitted', 'withdrawn') and public.is_valid_status_transition('under_review', 'withdrawn')
  and not public.is_valid_status_transition('awaiting_safety_review', 'withdrawn'),
  'AC-043.3.5: a submitted or under-review request can still be withdrawn (US22), alongside the safety stages');

rollback;
