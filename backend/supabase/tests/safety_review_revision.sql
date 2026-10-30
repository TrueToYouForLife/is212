-- US45 Revise arrangements after a safety review (SCRUM-240), 0118. Disposable PostgreSQL only;
-- run through the database runner after 0118 is applied. Fixtures run inside a transaction that is
-- rolled back. The safety review is switched on here.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('45a00000-0000-0000-0000-000000000001', 'organiser-45a@example.test'), ('45a00000-0000-0000-0000-000000000002', 'coordinator-45a@example.test'),
  ('45a00000-0000-0000-0000-000000000003', 'safety-45a@example.test'), ('45a00000-0000-0000-0000-000000000004', 'venue-45a@example.test'), ('45a00000-0000-0000-0000-000000000005', 'tech-45a@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '45a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id = '45a00000-0000-0000-0000-000000000002';
update public.profiles set role = 'safety_officer', full_name = 'Sam Safety' where id = '45a00000-0000-0000-0000-000000000003';
update public.profiles set role = 'venue_staff' where id = '45a00000-0000-0000-0000-000000000004';
update public.profiles set role = 'tech_support' where id = '45a00000-0000-0000-0000-000000000005';

insert into public.venues (id, name, location, capacity, layout, status) values ('45a10000-0000-0000-0000-000000000001', 'US45 Hall', 'Level 1', 200, 'theatre', 'active');

-- E1 is reviewed, sent back, revised and approved. E2 has changes requested. E5 and E6 await
-- review and are in preparation, for the send-back rule.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme) values
  ('45a30000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'US45 Event 1', 'Fixture', '2045-01-10 09:00+08', '2045-01-10 11:00+08', 40, 'awaiting_safety_review', 'EVT-45A-1', 'Talks'),
  ('45a30000-0000-0000-0000-000000000002', '45a00000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'US45 Event 2', 'Fixture', '2045-02-10 09:00+08', '2045-02-10 11:00+08', 40, 'safety_changes_requested', 'EVT-45A-2', 'Talks'),
  ('45a30000-0000-0000-0000-000000000005', '45a00000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'US45 Event 5', 'Fixture', '2045-05-10 09:00+08', '2045-05-10 11:00+08', 40, 'awaiting_safety_review', 'EVT-45A-5', 'Talks'),
  ('45a30000-0000-0000-0000-000000000006', '45a00000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'US45 Event 6', 'Fixture', '2045-06-10 09:00+08', '2045-06-10 11:00+08', 40, 'in_preparation', 'EVT-45A-6', 'Talks');
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status) values
  ('45a50000-0000-0000-0000-000000000001', '45a30000-0000-0000-0000-000000000001', '45a10000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'confirmed'),
  ('45a50000-0000-0000-0000-000000000005', '45a30000-0000-0000-0000-000000000005', '45a10000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'confirmed'),
  ('45a50000-0000-0000-0000-000000000006', '45a30000-0000-0000-0000-000000000006', '45a10000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'confirmed');
insert into public.equipment_bookings (id, event_id, requested_by, deliver_to_venue_id, use_from, use_to, status)
  values ('45a60000-0000-0000-0000-000000000001', '45a30000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', '45a10000-0000-0000-0000-000000000001', '2045-01-10', '2045-01-10', 'confirmed');
update public.safety_review_settings set enabled = true;

create function pg_temp.us45_status(event uuid) returns text language sql as $$ select status from public.events where id = event $$;

-- Runs one statement as a signed-in user: 'ok', or the SQLSTATE of the refusal.
create function pg_temp.us45_as(actor uuid, statement text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute statement;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

create function pg_temp.us45_set(event uuid, status text) returns text language sql as $$
  select format('update public.events set status = %L where id = %L', status, event) $$;

create function pg_temp.us45_decide(event uuid, decision text, note text, revisit text) returns text language sql as $$
  select format('select public.record_safety_review_decision(%L, %L, %L, %L::text[], (select jsonb_agg(jsonb_build_object(''factor'', f, ''concern'', false)) from unnest(public.safety_review_factors()) f))',
                event, decision, note, revisit) $$;

-- The Safety Officer asks for changes to E1's venue and equipment.
select pg_temp.us45_as('45a00000-0000-0000-0000-000000000003', pg_temp.us45_decide('45a30000-0000-0000-0000-000000000001', 'request_changes', 'Move the stage away from the fire exit', '{venue,equipment}')) as us45_first \gset

-- ---------------------------------------------------------------------------
-- AC-045.1: the Coordinator sees the decision, comments and what to revisit
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '45a00000-0000-0000-0000-000000000002', true);
select json_agg(q)::text as us45_seen from public.get_safety_review_decisions('45a30000-0000-0000-0000-000000000001') q \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us45_first' = 'ok' and pg_temp.us45_status('45a30000-0000-0000-0000-000000000001') = 'safety_changes_requested'
  and (:'us45_seen'::jsonb -> 0 ->> 'decision') = 'request_changes'
  and (:'us45_seen'::jsonb -> 0 ->> 'comment') = 'Move the stage away from the fire exit'
  and (:'us45_seen'::jsonb -> 0 -> 'revisit') = '["equipment", "venue"]'::jsonb,
  'AC-045.1.1: the Coordinator sees the Safety Officer''s decision, comment and the arrangements named for revision');

-- ---------------------------------------------------------------------------
-- AC-045.2: revising returns the event to Planning with the named arrangements flagged
-- ---------------------------------------------------------------------------
select pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', pg_temp.us45_set('45a30000-0000-0000-0000-000000000001', 'planning')) as us45_revise \gset
select pg_temp.assert_true(
  :'us45_revise' = 'ok' and pg_temp.us45_status('45a30000-0000-0000-0000-000000000001') = 'planning'
  and (select count(*) = 1 from public.arrangement_review_flags where event_id = '45a30000-0000-0000-0000-000000000001' and venue_booking_id = '45a50000-0000-0000-0000-000000000001'
       and reason_code = 'safety_review' and status = 'open' and safety_review_decision_id is not null
       and detail like '%venue arrangement to be revisited. Comment: Move the stage away from the fire exit')
  and (select count(*) = 1 from public.arrangement_review_flags where event_id = '45a30000-0000-0000-0000-000000000001' and equipment_booking_id = '45a60000-0000-0000-0000-000000000001'
       and reason_code = 'safety_review' and status = 'open'),
  'AC-045.2.1: "Revise arrangements" returns the event to Planning and flags each named venue and equipment arrangement "Needs review", with the comment');

select pg_temp.us45_as('45a00000-0000-0000-0000-000000000001', pg_temp.us45_set('45a30000-0000-0000-0000-000000000002', 'planning')) as us45_organiser,
       pg_temp.us45_as('45a00000-0000-0000-0000-000000000003', pg_temp.us45_set('45a30000-0000-0000-0000-000000000002', 'planning')) as us45_officer,
       pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', pg_temp.us45_set('45a30000-0000-0000-0000-000000000002', 'awaiting_safety_review')) as us45_shortcut,
       pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', pg_temp.us45_set('45a30000-0000-0000-0000-000000000005', 'planning')) as us45_by_hand \gset
select pg_temp.assert_true(
  :'us45_organiser' = '42501' and :'us45_officer' = '42501' and :'us45_shortcut' = '22000' and :'us45_by_hand' = '42501'
  and pg_temp.us45_status('45a30000-0000-0000-0000-000000000002') = 'safety_changes_requested' and pg_temp.us45_status('45a30000-0000-0000-0000-000000000005') = 'awaiting_safety_review',
  'AC-045.2.2: only the Coordinator revises; a sent-back event cannot skip revising, and nobody moves an event out of review by hand');

-- ---------------------------------------------------------------------------
-- AC-045.3 / AC-045.4: changes go through the normal flows; resubmitting waits for every review
-- ---------------------------------------------------------------------------
-- The Coordinator replaces the stage area with a second room, which Venue Staff must approve again.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
  values ('45a50000-0000-0000-0000-000000000002', '45a30000-0000-0000-0000-000000000001', '45a10000-0000-0000-0000-000000000001', '45a00000-0000-0000-0000-000000000002', 'pending_approval', now() + interval '2 days');
set local role authenticated;
select set_config('request.jwt.claim.sub', '45a00000-0000-0000-0000-000000000002', true);
select (select detail from public.get_event_readiness('45a30000-0000-0000-0000-000000000001') where arrangement = 'arrangement_reviews') as us45_reviews_line,
       (select complete from public.get_event_readiness('45a30000-0000-0000-0000-000000000001') where arrangement = 'venue_booking') as us45_venue_line \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', $sql$select public.send_for_safety_review('45a30000-0000-0000-0000-000000000001')$sql$) as us45_send_early \gset
select pg_temp.assert_true(
  :'us45_reviews_line' = '2 arrangements still need review.' and not :'us45_venue_line'
  and :'us45_send_early' = '55000' and pg_temp.us45_status('45a30000-0000-0000-0000-000000000001') = 'planning',
  'AC-045.3.1: in Planning the changed arrangements wait for review and approval again; the event cannot be sent meanwhile');

select pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', format('select public.resolve_arrangement_review(%L, %L, %L)', id, 'corrected', 'Stage moved; second room booked'))
  from public.arrangement_review_flags where event_id = '45a30000-0000-0000-0000-000000000001' and status = 'open';
update public.venue_bookings set status = 'confirmed', hold_expires_at = null, reviewed_by = '45a00000-0000-0000-0000-000000000004', reviewed_at = now() where id = '45a50000-0000-0000-0000-000000000002';
select pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', $sql$select public.send_for_safety_review('45a30000-0000-0000-0000-000000000001')$sql$) as us45_resend \gset
select pg_temp.assert_true(
  :'us45_resend' = 'ok' and pg_temp.us45_status('45a30000-0000-0000-0000-000000000001') = 'awaiting_safety_review'
  and not exists (select 1 from public.arrangement_review_flags where event_id = '45a30000-0000-0000-0000-000000000001' and status = 'open')
  and (select count(*) = 1 from public.user_notifications where event_id = '45a30000-0000-0000-0000-000000000001' and recipient_id = '45a00000-0000-0000-0000-000000000003'),
  'AC-045.4.1: once every flagged arrangement is resolved and approved, the Coordinator resubmits and the Safety Officers are told again');

-- ---------------------------------------------------------------------------
-- AC-045.5: earlier reviews stay viewable
-- ---------------------------------------------------------------------------
select pg_temp.us45_as('45a00000-0000-0000-0000-000000000003', pg_temp.us45_decide('45a30000-0000-0000-0000-000000000001', 'approve', null, '{}')) as us45_second \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', '45a00000-0000-0000-0000-000000000002', true);
select json_agg(q.decision order by q.decided_at desc)::text as us45_history_c from public.get_safety_review_decisions('45a30000-0000-0000-0000-000000000001') q \gset
select set_config('request.jwt.claim.sub', '45a00000-0000-0000-0000-000000000003', true);
select count(*) as us45_history_s from public.get_safety_review_decisions('45a30000-0000-0000-0000-000000000001') \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
select pg_temp.assert_true(
  :'us45_second' = 'ok' and pg_temp.us45_status('45a30000-0000-0000-0000-000000000001') = 'in_preparation'
  and :'us45_history_c'::jsonb = '["approve", "request_changes"]'::jsonb and :'us45_history_s' = 2,
  'AC-045.5.1: after a second review both decisions remain, newest first, for the Coordinator and the Safety Officer');

-- ---------------------------------------------------------------------------
-- AC-045.6: a change during or after the safety review needs a new review
-- ---------------------------------------------------------------------------
-- A venue block flags E1's booking after its approval (as US12's blocks do).
insert into public.venue_booking_flags (booking_id, event_id, venue_id, cause, detail, recipient_id, created_by)
  values ('45a50000-0000-0000-0000-000000000001', '45a30000-0000-0000-0000-000000000001', '45a10000-0000-0000-0000-000000000001', 'venue_blocked', 'US45 Hall is blocked for repairs.', '45a00000-0000-0000-0000-000000000002', '45a00000-0000-0000-0000-000000000004');
select pg_temp.us45_as('45a00000-0000-0000-0000-000000000002', pg_temp.us45_set('45a30000-0000-0000-0000-000000000001', 'confirmed')) as us45_confirm_after_change \gset
select pg_temp.assert_true(
  pg_temp.us45_status('45a30000-0000-0000-0000-000000000001') = 'planning' and :'us45_confirm_after_change' = '22000'
  and (select count(*) = 1 from public.notification_outbox where event_id = '45a30000-0000-0000-0000-000000000001' and recipient_id = '45a00000-0000-0000-0000-000000000002'
       and subject = 'New safety review needed: EVT-45A-1' and body like '%US45 Hall is blocked for repairs.%'),
  'AC-045.6.1: a venue change after safety approval sends the event back to Planning, so it needs a new review before it can be confirmed, and its Coordinator is told');

-- Any new review flag on an event still awaiting review does the same, and it leaves the queue.
insert into public.safety_review_decisions (id, event_id, decided_by, decision, comment, revisit)
  values ('45a70000-0000-0000-0000-000000000005', '45a30000-0000-0000-0000-000000000005', '45a00000-0000-0000-0000-000000000003', 'request_changes', 'Fixture source', '{venue}');
insert into public.arrangement_review_flags (event_id, venue_booking_id, reason_code, detail, safety_review_decision_id)
  values ('45a30000-0000-0000-0000-000000000005', '45a50000-0000-0000-0000-000000000005', 'venue_capacity', 'Attendance now exceeds the room''s capacity.', '45a70000-0000-0000-0000-000000000005');
select pg_temp.assert_true(
  pg_temp.us45_status('45a30000-0000-0000-0000-000000000005') = 'planning'
  and (select count(*) = 1 from public.notification_outbox where event_id = '45a30000-0000-0000-0000-000000000005'
       and subject = 'New safety review needed: EVT-45A-5' and body like '%exceeds the room''s capacity%'),
  'AC-045.6.2: a change while an event awaits review sends it back to Planning too (so off the Safety Officer''s queue), and its Coordinator is told');

update public.safety_review_settings set enabled = false;
insert into public.venue_booking_flags (booking_id, event_id, venue_id, cause, detail, recipient_id, created_by)
  values ('45a50000-0000-0000-0000-000000000006', '45a30000-0000-0000-0000-000000000006', '45a10000-0000-0000-0000-000000000001', 'venue_blocked', 'Switched-off check.', '45a00000-0000-0000-0000-000000000002', '45a00000-0000-0000-0000-000000000004');
select pg_temp.assert_true(pg_temp.us45_status('45a30000-0000-0000-0000-000000000006') = 'in_preparation',
  'AC-045.6.3: while the safety review is switched off, a change moves nothing');

rollback;
