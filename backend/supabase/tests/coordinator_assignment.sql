-- US17: disposable PostgreSQL fixtures only; run through the database test runner.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000001', 'lead-us17@example.test');

-- AC1 prerequisite: an administrator can provision the role used for assignment.
do $$
begin
  update public.profiles set role = 'coordinator_lead'
    where id = '17000000-0000-0000-0000-000000000001';
exception when check_violation then
  raise exception 'FAIL: AC-017.1.2: database accepts an administrator-assigned Coordinator Lead profile. %', sqlerrm;
end $$;

select pg_temp.assert_true(
  (select role = 'coordinator_lead' from public.profiles
    where id = '17000000-0000-0000-0000-000000000001'),
  'AC-017.1.2: database accepts an administrator-assigned Coordinator Lead profile');

insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000002', 'organiser-us17@example.test'),
  ('17000000-0000-0000-0000-000000000003', 'coordinator-us17@example.test'),
  ('17000000-0000-0000-0000-000000000004', 'manager-us17@example.test');
-- Self sign-up creates Attendees since US29 (0042), so organisers are assigned like other roles.
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001'
  where id = '17000000-0000-0000-0000-000000000002';
update public.profiles set role = 'coordinator'
  where id = '17000000-0000-0000-0000-000000000003';
update public.profiles set role = 'operations_manager'
  where id = '17000000-0000-0000-0000-000000000004';
insert into public.events (
  id, organiser_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status
) values (
  '17100000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000002',
  'US17 submitted event', 'Assignment test',
  '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'submitted'
);
insert into public.events (id, organiser_id, name, status) values (
  '17100000-0000-0000-0000-000000000002',
  '17000000-0000-0000-0000-000000000002', 'Private draft', 'draft'
);

-- Execute as a browser user and distinguish permission denial from unrelated SQL errors.
create function pg_temp.us17_assignment_attempt(actor uuid, direct_update boolean)
returns text language plpgsql as $$
declare affected integer;
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  if direct_update then
    update public.events set coordinator_id = '17000000-0000-0000-0000-000000000003'
      where id = '17100000-0000-0000-0000-000000000001';
    get diagnostics affected = row_count;
    return 'rows:' || affected;
  end if;
  perform public.assign_event_coordinator(
    '17100000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000003'
  );
  return 'allowed';
exception when insufficient_privilege then
  return '42501';
end $$;

set local role authenticated;
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000002', false) = '42501',
  'AC-017.1.3: organiser cannot assign through the function');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000002', true) in ('42501', 'rows:0'),
  'AC-017.1.4: organiser cannot assign through a direct update');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000003', false) = '42501',
  'AC-017.1.5: coordinator cannot self-assign through the function');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000003', true) in ('42501', 'rows:0'),
  'AC-017.1.6: coordinator cannot self-assign through a direct update');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000004', false) = '42501',
  'AC-017.1.7: legacy Operations Manager cannot assign through the function');
select pg_temp.assert_true(
  pg_temp.us17_assignment_attempt('17000000-0000-0000-0000-000000000004', true) in ('42501', 'rows:0'),
  'AC-017.1.8: legacy Operations Manager cannot assign through a direct update');

select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
-- Do not filter out drafts in the query: database access must keep them private.
select pg_temp.assert_true(
  (select array_agg(id::text order by id) from public.events
    where organiser_id = '17000000-0000-0000-0000-000000000002')
      = array['17100000-0000-0000-0000-000000000001']::text[]
  and exists (
    select 1 from public.events
    where id = '17100000-0000-0000-0000-000000000001'
      and coordinator_id is null
      and name = 'US17 submitted event'
      and purpose = 'Assignment test'
      and proposed_start = '2030-01-01 01:00+00'::timestamptz
      and expected_attendance = 10
  ),
  'AC-017.1.9: Lead reads unassigned submitted event details while drafts stay private');

do $$
begin
  perform public.assign_event_coordinator(
    '17100000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000003'
  );
exception when insufficient_privilege then
  raise exception 'FAIL: AC-017.2.1: Coordinator Lead assigns a submitted event to an Event Coordinator. %', sqlerrm;
end $$;

-- Inspect persistence as the test administrator; Lead queue read access is a separate check.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select coordinator_id = '17000000-0000-0000-0000-000000000003'
      and status = 'submitted'
      and organiser_id = '17000000-0000-0000-0000-000000000002'
    from public.events where id = '17100000-0000-0000-0000-000000000001'),
  'AC-017.2.1: Coordinator Lead assigns a submitted event to an Event Coordinator');

-- These rules predate US17; verify them against the new Lead role without claiming TDD red.
set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_error($q$
  select public.assign_event_coordinator('17100000-0000-0000-0000-000000000002',
    '17000000-0000-0000-0000-000000000003')$q$, '22000',
  'AC-017.2.2: Lead cannot assign a draft');
select pg_temp.expect_error($q$
  select public.assign_event_coordinator('17100000-0000-0000-0000-000000000001', null)$q$, '22000',
  'AC-017.2.3: Lead must select a coordinator');
select pg_temp.expect_error($q$
  select public.assign_event_coordinator('17100000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000002')$q$, '22000',
  'AC-017.2.4: Lead cannot select an organiser as coordinator');
select pg_temp.expect_error($q$
  select public.assign_event_coordinator('17100000-0000-0000-0000-000000000001',
    '17000000-0000-0000-0000-000000000099')$q$, '22000',
  'AC-017.2.5: Lead cannot select a nonexistent coordinator');

reset role;
select set_config('request.jwt.claim.sub', '', true);
-- Rejected attempts must leave both the draft and the existing assignment unchanged.
do $$ begin
  if not exists (select 1 from public.events
      where id = '17100000-0000-0000-0000-000000000002'
        and coordinator_id is null and status = 'draft')
    or not exists (select 1 from public.events
      where id = '17100000-0000-0000-0000-000000000001'
        and coordinator_id = '17000000-0000-0000-0000-000000000003'
        and status = 'submitted') then
    raise exception 'FAIL: AC-017.2.2–5: rejected assignments changed event data';
  end if;
end $$;
insert into public.events (
  id, organiser_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status
) values (
  '17100000-0000-0000-0000-000000000003',
  '17000000-0000-0000-0000-000000000002',
  'Second US17 event', 'Multiple assignments',
  '2030-01-02 01:00+00', '2030-01-02 02:00+00', 20, 'submitted'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17100000-0000-0000-0000-000000000003',
  '17000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  (select count(*) = 2 from public.events
    where id in ('17100000-0000-0000-0000-000000000001', '17100000-0000-0000-0000-000000000003')
      and coordinator_id = '17000000-0000-0000-0000-000000000003'
      and status = 'submitted'),
  'AC-017.2.6: one coordinator can hold multiple submitted events');
select pg_temp.expect_error($q$
  select public.assign_event_coordinator('17100000-0000-0000-0000-000000000099',
    '17000000-0000-0000-0000-000000000003')$q$, '22000',
  'AC-017.2.7: Lead cannot assign a nonexistent event');

-- AC3: one lifecycle scenario, with both terminal-state boundaries.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000005', 'replacement-us17@example.test');
update public.profiles set role = 'coordinator'
  where id = '17000000-0000-0000-0000-000000000005';
insert into public.events (
  id, organiser_id, coordinator_id, name, purpose, proposed_start, proposed_end,
  expected_attendance, status
) select
  fixture.id::uuid, '17000000-0000-0000-0000-000000000002'::uuid,
  '17000000-0000-0000-0000-000000000003'::uuid,
  'US17 reassignment boundary', 'Reassignment test',
  '2030-01-03 01:00+00'::timestamptz, '2030-01-03 02:00+00'::timestamptz,
  10, 'submitted'
from (values
  ('17100000-0000-0000-0000-000000000004'),
  ('17100000-0000-0000-0000-000000000005')
) as fixture(id);
-- Administrator setup bypasses user transition restrictions, not assignment guards.
update public.events set status = 'completed'
  where id = '17100000-0000-0000-0000-000000000004';
update public.events set status = 'cancelled'
  where id = '17100000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17100000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000005');
do $$
declare fixture record; refused boolean;
begin
  if not exists (select 1 from public.events
      where id = '17100000-0000-0000-0000-000000000001'
        and coordinator_id = '17000000-0000-0000-0000-000000000005'
        and status = 'submitted'
        and organiser_id = '17000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL: AC-017.3.1: active-event reassignment must take effect immediately without changing status or organiser';
  end if;
  for fixture in select * from (values
    ('17100000-0000-0000-0000-000000000004'::uuid, 'completed'),
    ('17100000-0000-0000-0000-000000000005'::uuid, 'cancelled')
  ) as cases(id, status) loop
    refused := false;
    begin
      perform public.assign_event_coordinator(fixture.id,
        '17000000-0000-0000-0000-000000000005');
    exception when sqlstate '22000' then
      refused := true;
    end;
    if not refused then
      raise exception 'FAIL: AC-017.3.1: reassignment of a % event must be refused', fixture.status;
    end if;
    if not exists (select 1 from public.events where id = fixture.id
        and coordinator_id = '17000000-0000-0000-0000-000000000003'
        and status = fixture.status) then
      raise exception 'FAIL: AC-017.3.1: refused reassignment changed the % event', fixture.status;
    end if;
  end loop;
  raise notice 'PASS: AC-017.3.1: immediate active-event reassignment; completed/cancelled events remain unchanged';
end $$;

-- AC4: reuse the event just reassigned from coordinator 003 to coordinator 005.
-- Exercise the same review operation as the UI, under each user's database identity.
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000003', true);
do $$
declare refused boolean := false;
begin
  begin
    perform public.review_submitted_event(
      '17100000-0000-0000-0000-000000000001', 'approved', null);
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then
    raise exception 'FAIL: AC-017.4.1: previous coordinator must not approve a reassigned event';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if not exists (select 1 from public.events
      where id = '17100000-0000-0000-0000-000000000001'
        and status = 'submitted' and reviewed_by is null
        and coordinator_id = '17000000-0000-0000-0000-000000000005') then
    raise exception 'FAIL: AC-017.4.1: denied review must leave the reassigned event unchanged';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000005', true);
select public.review_submitted_event(
  '17100000-0000-0000-0000-000000000001', 'approved', null);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  (select status = 'approved'
      and coordinator_id = '17000000-0000-0000-0000-000000000005'
      and reviewed_by = '17000000-0000-0000-0000-000000000005'
    from public.events where id = '17100000-0000-0000-0000-000000000001'),
  'AC-017.4.1: reassignment denies the previous coordinator and permits the new coordinator to approve');

-- AC6: the earlier scenario assigned event 001, rejected invalid attempts, then
-- reassigned it. Its retained history must describe exactly those two changes.
set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
-- Selecting the existing coordinator is not another assignment change.
select public.assign_event_coordinator('17100000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000005');
do $$ begin
  if to_regclass('public.event_coordinator_assignment_history') is null then
    raise exception 'FAIL: AC-017.6.1: assignment history is not stored';
  end if;
  if (select count(*) from public.event_coordinator_assignment_history
      where event_id = '17100000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'FAIL: AC-017.6.1: retain exactly the assignment and reassignment, not failed attempts or unchanged selections';
  end if;
  if not exists (
    select 1 from public.event_coordinator_assignment_history
    where event_id = '17100000-0000-0000-0000-000000000001'
      and previous_coordinator_id is null
      and new_coordinator_id = '17000000-0000-0000-0000-000000000003'
      and assigned_by = '17000000-0000-0000-0000-000000000001'
      and assigned_at between transaction_timestamp() and clock_timestamp()
  ) or not exists (
    select 1 from public.event_coordinator_assignment_history
    where event_id = '17100000-0000-0000-0000-000000000001'
      and previous_coordinator_id = '17000000-0000-0000-0000-000000000003'
      and new_coordinator_id = '17000000-0000-0000-0000-000000000005'
      and assigned_by = '17000000-0000-0000-0000-000000000001'
      and assigned_at between transaction_timestamp() and clock_timestamp()
  ) then
    raise exception 'FAIL: AC-017.6.1: Lead must be able to read the actor, previous/new coordinator and time for each change';
  end if;
  raise notice 'PASS: AC-017.6.1: assignment history retains who, from/to and when, excluding failed and unchanged assignments';
end $$;

-- Slice 3: picker data must include idle coordinators and exclude closed events
-- from workload. Use database identities, not a mocked list of profiles.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000006', 'idle-us17@example.test');
update public.profiles set role = 'coordinator', full_name = 'Idle Coordinator'
  where id = '17000000-0000-0000-0000-000000000006';
update public.profiles set full_name = 'Original Coordinator'
  where id = '17000000-0000-0000-0000-000000000003';
update public.profiles set full_name = 'Replacement Coordinator'
  where id = '17000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-0000-0000-000000000001', true);
do $$
declare actual jsonb; actor text; refused boolean;
begin
  if to_regprocedure('public.list_assignment_coordinators()') is null then
    raise exception 'FAIL: AC-017.2.8: Lead coordinator picker data is not available';
  end if;
  select jsonb_agg(jsonb_build_array(coordinator_id, full_name, active_event_count)
      order by coordinator_id) into actual
    from public.list_assignment_coordinators()
    where coordinator_id::text like '17000000-%';
  -- Event 003 is submitted under the original coordinator; event 001 is approved
  -- under the replacement. Completed/cancelled fixtures must not inflate workload.
  if actual is distinct from '[
    ["17000000-0000-0000-0000-000000000003", "Original Coordinator", 1],
    ["17000000-0000-0000-0000-000000000005", "Replacement Coordinator", 1],
    ["17000000-0000-0000-0000-000000000006", "Idle Coordinator", 0]
  ]'::jsonb then
    raise exception 'FAIL: AC-017.2.8: expected only coordinators with names and active counts (including zero); received %', actual;
  end if;
  foreach actor in array array[
    '17000000-0000-0000-0000-000000000002',
    '17000000-0000-0000-0000-000000000003',
    '17000000-0000-0000-0000-000000000004', ''
  ] loop
    perform set_config('request.jwt.claim.sub', actor, true);
    refused := false;
    begin
      perform * from public.list_assignment_coordinators();
    exception when insufficient_privilege then refused := true;
    end;
    if not refused then
      raise exception 'FAIL: AC-017.2.8: picker data must be restricted to Coordinator Leads (actor %)', actor;
    end if;
  end loop;
  raise notice 'PASS: AC-017.2.8: Lead-only coordinator list includes names and active assignment counts, including idle coordinators';
end $$;

rollback;
