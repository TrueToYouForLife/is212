-- US2/US6 structured event requirements (0054-0056). Disposable PostgreSQL only.
-- Run after change_request_field_clarification.sql, which leaves the US7 review fixtures
-- in place; this file makes its own events so it does not depend on their state.
--
-- What is worth checking in the database rather than in Vitest: the browser can only
-- offer catalogue options, so every interesting case here is one that bypasses the
-- browser. That is exactly what the trigger and the foreign key exist for.

reset role;
select set_config('request.jwt.claim.sub','',false);

insert into auth.users (id, email) values
  ('52000000-0000-0000-0000-000000000001','organiser.sr@example.com'),
  ('52000000-0000-0000-0000-000000000002','coordinator.sr@example.com');
insert into public.profiles (id, full_name, role) values
  ('52000000-0000-0000-0000-000000000001','SR Organiser','organiser'),
  ('52000000-0000-0000-0000-000000000002','SR Coordinator','coordinator')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.equipment_types (id, name, category) values
  ('52100000-0000-0000-0000-000000000001','SR Projector','Visual')
on conflict (id) do nothing;

insert into public.events (id, reference, organiser_id, coordinator_id, name, purpose,
  proposed_start, proposed_end, expected_attendance, status)
values
  ('52200000-0000-0000-0000-000000000001','EVT-SR-1','52000000-0000-0000-0000-000000000001',
   '52000000-0000-0000-0000-000000000002','SR event','Structured requirements',
   '2041-05-01 01:00+00','2041-05-01 03:00+00',80,'approved');

-- AC-002.1 — the catalogues exist and hold the codes the app offers
select pg_temp.assert_true(
  (select count(*) from public.accessibility_types
   where code in ('wheelchair_access','hearing_loop','accessible_toilet','lift_access')) = 4
  and (select count(*) from public.facility_types
       where code in ('projector','microphone','stage','wifi')) = 4,
  'AC-002.1.15: the accessibility and facility catalogues hold the shared codes');

select pg_temp.assert_true(
  (select count(*) from public.equipment_types where code is null) = 0
  and (select code = 'sr_projector' from public.equipment_types
       where id = '52100000-0000-0000-0000-000000000001'),
  'AC-002.1.16: every equipment type has a slug code derived from its name');

-- AC-002.1 — a code outside its catalogue is refused, whoever writes it
do $$ begin
  begin
    update public.events set accessibility_requirements = array['made_up']
      where id = '52200000-0000-0000-0000-000000000001';
    raise exception 'FAIL AC-002.1.17';
  exception when check_violation then
    raise notice 'PASS: AC-002.1.17: an unknown accessibility code is refused';
  end;
end $$;

do $$ begin
  begin
    update public.events set facility_requirements = array['projector','made_up']
      where id = '52200000-0000-0000-0000-000000000001';
    raise exception 'FAIL AC-002.1.18';
  exception when check_violation then
    raise notice 'PASS: AC-002.1.18: one bad code refuses the whole list';
  end;
end $$;

do $$ begin
  begin
    update public.events set equipment_requirements = array['not_in_the_catalogue']
      where id = '52200000-0000-0000-0000-000000000001';
    raise exception 'FAIL AC-002.1.19';
  exception when check_violation then
    raise notice 'PASS: AC-002.1.19: an unknown equipment code is refused';
  end;
end $$;

do $$ begin
  begin
    update public.events set layout_preference = 'not_a_layout'
      where id = '52200000-0000-0000-0000-000000000001';
    raise exception 'FAIL AC-002.1.20';
  exception when foreign_key_violation then
    raise notice 'PASS: AC-002.1.20: an unknown layout is refused by the foreign key';
  end;
end $$;

do $$ begin
  begin
    update public.events set accessibility_requirements = array['']
      where id = '52200000-0000-0000-0000-000000000001';
    raise exception 'FAIL AC-002.1.21';
  exception when check_violation then
    raise notice 'PASS: AC-002.1.21: a blank code is refused';
  end;
end $$;

-- AC-002.1 — valid codes are stored, and a duplicate is collapsed rather than rejected
update public.events set
  layout_preference = 'theatre',
  accessibility_requirements = array['lift_access','wheelchair_access','lift_access'],
  facility_requirements = array['projector'],
  equipment_requirements = array['sr_projector']
where id = '52200000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  (select layout_preference = 'theatre'
    and accessibility_requirements @> array['lift_access','wheelchair_access']
    and array_length(accessibility_requirements, 1) = 2
    and facility_requirements = array['projector']
    and equipment_requirements = array['sr_projector']
   from public.events where id = '52200000-0000-0000-0000-000000000001'),
  'AC-002.1.22: valid codes are stored and a repeated code is collapsed, not refused');

-- AC-002.1 — an omitted requirement is an empty list, never null
insert into public.events (id, reference, organiser_id, name, purpose, status)
values ('52200000-0000-0000-0000-000000000002','EVT-SR-2',
  '52000000-0000-0000-0000-000000000001','SR draft','Draft','draft');
select pg_temp.assert_true(
  (select accessibility_requirements = '{}'::text[]
    and facility_requirements = '{}'::text[]
    and equipment_requirements = '{}'::text[]
    and layout_preference is null
   from public.events where id = '52200000-0000-0000-0000-000000000002'),
  'AC-002.1.23: a draft that asks for nothing holds empty lists and no layout');

-- AC-002.1 — the new column is readable by the browser role. 0005 revoked table-wide
-- SELECT and re-granted column by column, so this is easy to forget and silent when missed.
select pg_temp.assert_true(
  has_column_privilege('authenticated','public.events','facility_requirements','select')
  and has_column_privilege('authenticated','public.events','accessibility_requirements','select'),
  'AC-002.1.24: authenticated may select the requirement columns');

-- AC-002.1 — an organiser can read the catalogues they are asked to choose from.
-- 0019 limited equipment_types to coordinators and tech support, which would have left
-- the organiser's checkbox list empty with no error to explain why.
set role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(
  (select count(*) from public.layout_types) > 0
  and (select count(*) from public.accessibility_types) > 0
  and (select count(*) from public.facility_types) > 0
  and (select count(*) from public.equipment_types) > 0,
  'AC-002.1.25: an organiser can read every catalogue the request form offers');
reset role;
select set_config('request.jwt.claim.sub','',false);

-- AC-007.9 — the review RPC accepts a code list where it used to insist on a string
insert into public.event_change_requests (id, event_id, organiser_id, proposed_changes, reason, status)
values ('52300000-0000-0000-0000-000000000001','52200000-0000-0000-0000-000000000001',
  '52000000-0000-0000-0000-000000000001',
  '{"accessibilityRequirements":["hearing_loop"],"facilityRequirements":["stage","wifi"]}'::jsonb,
  'Needs a hearing loop','submitted');

set role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',false);
do $$
declare outcome text; updated_at timestamptz;
begin
  select e.updated_at into updated_at from public.events e
    where e.id = '52200000-0000-0000-0000-000000000001';
  outcome := public.review_event_change_request(
    '52300000-0000-0000-0000-000000000001', updated_at,
    '{"action":"decide","decisions":[
      {"field":"accessibilityRequirements","decision":"approved"},
      {"field":"facilityRequirements","decision":"approved"}]}'::jsonb);
  perform pg_temp.assert_true(outcome = 'approved',
    'AC-007.9.18: a review approving two code lists succeeds');
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);

select pg_temp.assert_true(
  (select accessibility_requirements = array['hearing_loop']
    and facility_requirements @> array['stage','wifi']
    and array_length(facility_requirements, 1) = 2
   from public.events where id = '52200000-0000-0000-0000-000000000001'),
  'AC-007.9.19: an approved code list replaces the event''s list outright');

-- AC-007.9 — a list proposal still has to be a list of codes
insert into public.event_change_requests (id, event_id, organiser_id, proposed_changes, reason, status)
values ('52300000-0000-0000-0000-000000000002','52200000-0000-0000-0000-000000000001',
  '52000000-0000-0000-0000-000000000001',
  '{"accessibilityRequirements":"wheelchair_access"}'::jsonb,
  'Typed instead of ticked','submitted');

set role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',false);
do $$
declare updated_at timestamptz;
begin
  select e.updated_at into updated_at from public.events e
    where e.id = '52200000-0000-0000-0000-000000000001';
  begin
    perform public.review_event_change_request(
      '52300000-0000-0000-0000-000000000002', updated_at,
      '{"action":"decide","decisions":[
        {"field":"accessibilityRequirements","decision":"approved"}]}'::jsonb);
    raise exception 'FAIL AC-007.9.20';
  exception when sqlstate '22000' then
    raise notice 'PASS: AC-007.9.20: a string proposed for a code list is refused';
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);

update public.event_change_requests
  set proposed_changes = '{"facilityRequirements":["projector",""]}'::jsonb
  where id = '52300000-0000-0000-0000-000000000002';

set role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',false);
do $$
declare updated_at timestamptz;
begin
  select e.updated_at into updated_at from public.events e
    where e.id = '52200000-0000-0000-0000-000000000001';
  begin
    perform public.review_event_change_request(
      '52300000-0000-0000-0000-000000000002', updated_at,
      '{"action":"decide","decisions":[
        {"field":"facilityRequirements","decision":"approved"}]}'::jsonb);
    raise exception 'FAIL AC-007.9.21';
  exception when sqlstate '22000' then
    raise notice 'PASS: AC-007.9.21: a blank element is refused before the event is touched';
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);

select pg_temp.assert_true(
  (select accessibility_requirements = array['hearing_loop']
   from public.events where id = '52200000-0000-0000-0000-000000000001'),
  'AC-007.9.22: a refused review leaves the event''s requirements unchanged');

-- AC-007.12 — a facility change queues a venue recheck, like layout and accessibility
update public.event_change_requests
  set proposed_changes = '{"facilityRequirements":["wifi"]}'::jsonb,
      status = 'submitted', field_decisions = '[]'::jsonb, reviewed_at = null, reviewed_by = null
  where id = '52300000-0000-0000-0000-000000000002';

set role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',false);
do $$
declare updated_at timestamptz;
begin
  select e.updated_at into updated_at from public.events e
    where e.id = '52200000-0000-0000-0000-000000000001';
  perform public.review_event_change_request(
    '52300000-0000-0000-0000-000000000002', updated_at,
    '{"action":"decide","decisions":[
      {"field":"facilityRequirements","decision":"approved"}]}'::jsonb);
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);

select pg_temp.assert_true(
  (select venue_required and not equipment_required
    and approved_fields = array['facilityRequirements']
   from public.event_change_revalidations
   where change_request_id = '52300000-0000-0000-0000-000000000002'),
  'AC-007.12.20: an approved facility change queues a venue recheck only');
