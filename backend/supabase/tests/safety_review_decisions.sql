-- US44 Approve / reject / request changes for safety review (SCRUM-249), 0111. Disposable
-- PostgreSQL only; run through the database runner, which applies 0111 just before this file.
-- Fixtures run inside a transaction that is rolled back. The safety review is switched on here.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('44a00000-0000-0000-0000-000000000001', 'organiser-44a@example.test'), ('44a00000-0000-0000-0000-000000000002', 'coordinator-44a@example.test'),
  ('44a00000-0000-0000-0000-000000000003', 'other-coordinator-44a@example.test'), ('44a00000-0000-0000-0000-000000000004', 'safety-one-44a@example.test'),
  ('44a00000-0000-0000-0000-000000000005', 'safety-two-44a@example.test'), ('44a00000-0000-0000-0000-000000000006', 'lead-44a@example.test');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '44a00000-0000-0000-0000-000000000001';
update public.profiles set role = 'coordinator' where id in ('44a00000-0000-0000-0000-000000000002', '44a00000-0000-0000-0000-000000000003');
update public.profiles set role = 'safety_officer', full_name = 'Sam Safety' where id = '44a00000-0000-0000-0000-000000000004';
update public.profiles set role = 'safety_officer' where id = '44a00000-0000-0000-0000-000000000005';
update public.profiles set role = 'coordinator_lead' where id = '44a00000-0000-0000-0000-000000000006';

-- A1 to A5 await their safety review.
insert into public.events (id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status, reference, programme) values
  ('44a30000-0000-0000-0000-000000000001', '44a00000-0000-0000-0000-000000000001', '44a00000-0000-0000-0000-000000000002', 'US44 One', 'Fixture', '2043-01-11 09:00+08', '2043-01-11 11:00+08', 50, 'awaiting_safety_review', 'EVT-44A-1', 'Talks'),
  ('44a30000-0000-0000-0000-000000000002', '44a00000-0000-0000-0000-000000000001', '44a00000-0000-0000-0000-000000000002', 'US44 Two', 'Fixture', '2043-01-12 09:00+08', '2043-01-12 11:00+08', 50, 'awaiting_safety_review', 'EVT-44A-2', 'Talks'),
  ('44a30000-0000-0000-0000-000000000003', '44a00000-0000-0000-0000-000000000001', '44a00000-0000-0000-0000-000000000002', 'US44 Three', 'Fixture', '2043-01-13 09:00+08', '2043-01-13 11:00+08', 50, 'awaiting_safety_review', 'EVT-44A-3', 'Talks'),
  ('44a30000-0000-0000-0000-000000000004', '44a00000-0000-0000-0000-000000000001', '44a00000-0000-0000-0000-000000000002', 'US44 Four', 'Fixture', '2043-01-14 09:00+08', '2043-01-14 11:00+08', 50, 'awaiting_safety_review', 'EVT-44A-4', 'Talks'),
  ('44a30000-0000-0000-0000-000000000005', '44a00000-0000-0000-0000-000000000001', '44a00000-0000-0000-0000-000000000002', 'US44 Five', 'Fixture', '2043-01-15 09:00+08', '2043-01-15 11:00+08', 50, 'awaiting_safety_review', 'EVT-44A-5', 'Talks');
update public.safety_review_settings set enabled = true;

create function pg_temp.us44_status(event uuid) returns text language sql as $$ select status from public.events where id = event $$;

-- Every factor assessed; concerns (factor => note) mark some of them.
create function pg_temp.us44_assess(concerns jsonb default '{}') returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('factor', f, 'concern', concerns ? f, 'note', concerns ->> f))
  from unnest(public.safety_review_factors()) f $$;

-- Records a decision as a signed-in user: the new status, or the SQLSTATE of the refusal.
create function pg_temp.us44_decide(actor uuid, event uuid, decision text, note text, revisit text[], assessments jsonb)
returns text language plpgsql as $$
declare
  result text;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  result := public.record_safety_review_decision(event, decision, note, revisit, assessments);
  perform set_config('request.jwt.claim.sub', '', true);
  return result;
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;

create function pg_temp.us44_decisions(event uuid) returns integer language sql as $$
  select count(*)::integer from public.safety_review_decisions where event_id = event $$;

-- ---------------------------------------------------------------------------
-- AC-044.1: every factor is assessed, and every concern says what it is
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000001', 'approve', null, '{}',
    (select jsonb_agg(x) from jsonb_array_elements(pg_temp.us44_assess()) x where x ->> 'factor' <> 'crowd_movement')) = '22023'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000001', 'approve', null, '{}',
    pg_temp.us44_assess() || '[{"factor": "attendance", "concern": false}]'::jsonb) = '22023'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000001', 'approve', null, '{}',
    (select jsonb_agg(case when x ->> 'factor' = 'emergency_access' then x || '{"concern": true, "note": " "}' else x end)
     from jsonb_array_elements(pg_temp.us44_assess()) x)) = '22023'
  and pg_temp.us44_decisions('44a30000-0000-0000-0000-000000000001') = 0 and pg_temp.us44_status('44a30000-0000-0000-0000-000000000001') = 'awaiting_safety_review',
  'AC-044.1.1: a decision is refused if a factor is missing or repeated, or a concern has no note; nothing is recorded');

-- Each decision is made first and its result kept, then checked: an AND has no fixed order.
select pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000001', 'approve', '  ', '{}', pg_temp.us44_assess()) as us44_a1 \gset
select pg_temp.assert_true(
  :'us44_a1' = 'in_preparation'
  and (select count(*) = 7 and bool_and(not concern) and bool_and(note is null)
       from public.safety_review_assessments a join public.safety_review_decisions d on d.id = a.decision_id
       where d.event_id = '44a30000-0000-0000-0000-000000000001'),
  'AC-044.1.2: every factor''s assessment is recorded with the decision; "no concern" needs no note');

-- ---------------------------------------------------------------------------
-- AC-044.2: one decision, with a comment for Request Changes and Reject
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'request_changes', null, '{venue}', pg_temp.us44_assess()) = '22023'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'reject', '   ', '{venue}', pg_temp.us44_assess()) = '22023'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'maybe', 'x', '{venue}', pg_temp.us44_assess()) = '22023'
  and pg_temp.us44_decisions('44a30000-0000-0000-0000-000000000002') = 0,
  'AC-044.2.1: Request Changes and Reject need a comment, and there is no other kind of decision');

select pg_temp.assert_true(
  pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'approve', null, '{venue}', pg_temp.us44_assess()) = '22023'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'request_changes', 'Exits blocked', '{}', pg_temp.us44_assess()) = '22023'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'request_changes', 'Exits blocked', '{catering}', pg_temp.us44_assess()) = '22023'
  and pg_temp.us44_decisions('44a30000-0000-0000-0000-000000000002') = 0 and pg_temp.us44_status('44a30000-0000-0000-0000-000000000002') = 'awaiting_safety_review',
  'AC-044.2.2: Request Changes and Reject name venue, equipment or both to revisit; Approve names nothing');

-- ---------------------------------------------------------------------------
-- AC-044.3: Approve moves the event to In Preparation
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us44_status('44a30000-0000-0000-0000-000000000001') = 'in_preparation'
  and (select decision = 'approve' and comment is null and revisit = '{}' from public.safety_review_decisions where event_id = '44a30000-0000-0000-0000-000000000001'),
  'AC-044.3.1: an approval moves the event to In Preparation');

-- ---------------------------------------------------------------------------
-- AC-044.4: Request Changes or Reject sends it back, naming what to revisit
-- ---------------------------------------------------------------------------
select pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'request_changes', 'Move the stage away from the fire exit',
    '{venue}', pg_temp.us44_assess('{"emergency_access": "Stage blocks the east exit"}')) as us44_a2 \gset
select pg_temp.us44_decide('44a00000-0000-0000-0000-000000000005', '44a30000-0000-0000-0000-000000000003', 'reject', 'Hall too small and cables across walkways',
    '{equipment,venue,venue}', pg_temp.us44_assess('{"venue_capacity_layout": "Over capacity", "equipment_placement": "Cables"}')) as us44_a3 \gset
select pg_temp.assert_true(
  :'us44_a2' = 'safety_changes_requested' and :'us44_a3' = 'safety_changes_requested'
  and (select decision = 'request_changes' and revisit = '{venue}' from public.safety_review_decisions where event_id = '44a30000-0000-0000-0000-000000000002')
  and (select decision = 'reject' and revisit = '{equipment,venue}' from public.safety_review_decisions where event_id = '44a30000-0000-0000-0000-000000000003')
  and pg_temp.us44_status('44a30000-0000-0000-0000-000000000002') = 'safety_changes_requested' and pg_temp.us44_status('44a30000-0000-0000-0000-000000000003') = 'safety_changes_requested',
  'AC-044.4.1: Request Changes and Reject both move the event to Safety Changes Requested, recording which, and what to revisit');

create function pg_temp.us44_set_as(actor uuid, event uuid, status text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  update public.events set status = us44_set_as.status where id = event;
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;
select pg_temp.assert_true(
  pg_temp.us44_set_as('44a00000-0000-0000-0000-000000000002', '44a30000-0000-0000-0000-000000000002', 'in_preparation') in ('42501', '22000')
  and pg_temp.us44_set_as('44a00000-0000-0000-0000-000000000002', '44a30000-0000-0000-0000-000000000002', 'confirmed') in ('42501', '22000')
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000002', 'approve', null, '{}', pg_temp.us44_assess()) = '22000'
  and pg_temp.us44_status('44a30000-0000-0000-0000-000000000002') = 'safety_changes_requested',
  'AC-044.4.2: an event sent back cannot move on: its Coordinator cannot prepare or confirm it, and it cannot be approved until sent for review again');

-- ---------------------------------------------------------------------------
-- AC-044.5: the assigned Coordinator is told the decision and the comments
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox where recipient_id = '44a00000-0000-0000-0000-000000000002' and notification_type = 'safety_review_decision'
     and event_id = '44a30000-0000-0000-0000-000000000002' and subject = 'Safety review changes requested: EVT-44A-2'
     and body like '%Revisit: venue.%' and body like '%Comment: Move the stage away from the fire exit%'
     and body like '%Concerns: Emergency Access (Stage blocks the east exit).%')
  and (select count(*) = 1 from public.user_notifications where recipient_id = '44a00000-0000-0000-0000-000000000002' and event_id = '44a30000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.notification_outbox where recipient_id = '44a00000-0000-0000-0000-000000000002' and event_id = '44a30000-0000-0000-0000-000000000001'
     and subject = 'Safety review approved: EVT-44A-1' and body like '%now In Preparation%')
  and (select count(*) = 1 from public.notification_outbox where recipient_id = '44a00000-0000-0000-0000-000000000002' and event_id = '44a30000-0000-0000-0000-000000000003'
     and subject = 'Safety review rejected: EVT-44A-3' and body like '%Revisit: equipment and venue.%'),
  'AC-044.5.1: the Coordinator is told each decision with its comment, what to revisit and the concerns, in the app and by email');

insert into public.notification_preferences (user_id, type_code, in_app, email) values ('44a00000-0000-0000-0000-000000000002', 'safety_review_decision', true, false);
select pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000004', 'approve', null, '{}', pg_temp.us44_assess()) as us44_a4 \gset
select pg_temp.assert_true(
  :'us44_a4' = 'in_preparation'
  and not exists (select 1 from public.notification_outbox where event_id = '44a30000-0000-0000-0000-000000000004')
  and (select count(*) = 1 from public.user_notifications where recipient_id = '44a00000-0000-0000-0000-000000000002' and event_id = '44a30000-0000-0000-0000-000000000004'),
  'AC-044.5.2: a Coordinator who turned these emails off is told in the app only');

-- ---------------------------------------------------------------------------
-- AC-044.6: only Safety Officers decide; every decision records who and when
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(
  pg_temp.us44_decide('44a00000-0000-0000-0000-000000000002', '44a30000-0000-0000-0000-000000000005', 'approve', null, '{}', pg_temp.us44_assess()) = '42501'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000001', '44a30000-0000-0000-0000-000000000005', 'approve', null, '{}', pg_temp.us44_assess()) = '42501'
  and pg_temp.us44_decide('44a00000-0000-0000-0000-000000000006', '44a30000-0000-0000-0000-000000000005', 'approve', null, '{}', pg_temp.us44_assess()) = '42501'
  and pg_temp.us44_decisions('44a30000-0000-0000-0000-000000000005') = 0 and pg_temp.us44_status('44a30000-0000-0000-0000-000000000005') = 'awaiting_safety_review',
  'AC-044.6.1: a Coordinator, Organiser or Lead cannot record a decision');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44a00000-0000-0000-0000-000000000002', true);
select json_agg(q)::text as us44_history from public.get_safety_review_decisions('44a30000-0000-0000-0000-000000000003') q \gset
select set_config('request.jwt.claim.sub', '44a00000-0000-0000-0000-000000000005', true);
select count(*) as us44_officer_reads from public.get_safety_review_decisions('44a30000-0000-0000-0000-000000000003') \gset
select set_config('request.jwt.claim.sub', '', true);
reset role;
create function pg_temp.us44_read_as(actor uuid, event uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform count(*) from public.get_safety_review_decisions(event);
  perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('request.jwt.claim.sub', '', true);
  return sqlstate;
end $$;
select pg_temp.assert_true(
  (select decided_by = '44a00000-0000-0000-0000-000000000005' and decided_at is not null from public.safety_review_decisions where event_id = '44a30000-0000-0000-0000-000000000003')
  and (:'us44_history'::jsonb -> 0 ->> 'decision') = 'reject'
  and (:'us44_history'::jsonb -> 0 -> 'assessments' -> 2 ->> 'factor') = 'emergency_access'
  and jsonb_array_length(:'us44_history'::jsonb -> 0 -> 'assessments') = 7
  and :'us44_officer_reads' = 1
  and pg_temp.us44_read_as('44a00000-0000-0000-0000-000000000003', '44a30000-0000-0000-0000-000000000003') = '42501' and pg_temp.us44_read_as('44a00000-0000-0000-0000-000000000001', '44a30000-0000-0000-0000-000000000003') = '42501',
  'AC-044.6.2: each decision records who made it and when; its assigned Coordinator and Safety Officers can read it, other people cannot');

update public.safety_review_settings set enabled = false;
select pg_temp.assert_true(
  pg_temp.us44_decide('44a00000-0000-0000-0000-000000000004', '44a30000-0000-0000-0000-000000000005', 'approve', null, '{}', pg_temp.us44_assess()) = '0A000'
  and pg_temp.us44_status('44a30000-0000-0000-0000-000000000005') = 'awaiting_safety_review',
  'AC-044.6.3: while the safety review is switched off, no decision can be recorded');

rollback;
