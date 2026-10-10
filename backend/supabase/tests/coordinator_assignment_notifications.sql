-- US17 slice 4: run only in the disposable database test runner.
-- This checks queued delivery, not receipt by a live email provider.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('17400000-0000-0000-0000-000000000001', 'lead-us17-notify@example.test'),
  ('17400000-0000-0000-0000-000000000002', 'organiser-us17-notify@example.test'),
  ('17400000-0000-0000-0000-000000000003', 'coordinator-us17-notify@example.test');
-- 0042 defaults new users to attendees; provision each fixture explicitly.
update public.profiles set role = case id
  when '17400000-0000-0000-0000-000000000001'::uuid then 'coordinator_lead'
  when '17400000-0000-0000-0000-000000000002'::uuid then 'organiser'
  else 'coordinator' end
where id in ('17400000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000002', '17400000-0000-0000-0000-000000000003');

insert into public.events (id, organiser_id, name, purpose, proposed_start,
  proposed_end, expected_attendance, status)
values ('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000002', 'US17 notification fixture',
  'Check assignment recipients', '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'submitted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '17400000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000003');

-- Inspect private delivery records as test administrator, never grant browser
-- access to the email outbox just to make this assertion possible.
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare recipients text[]; notice_recipients uuid[];
begin
  select array_agg(recipient_email order by recipient_email) into recipients
  from public.notification_outbox
  where event_id = '17410000-0000-0000-0000-000000000001';
  if recipients is distinct from array[
    'coordinator-us17-notify@example.test', 'organiser-us17-notify@example.test'
  ]::text[] then
    raise exception 'FAIL: AC-017.5.1: successful assignment must queue one email each for the new coordinator and organiser; received %', recipients;
  end if;
  if exists (select 1 from public.notification_outbox
    where event_id = '17410000-0000-0000-0000-000000000001'
      and (status <> 'pending' or attempts <> 0 or sent_at is not null
        or nullif(btrim(subject), '') is null or nullif(btrim(body), '') is null)) then
    raise exception 'FAIL: AC-017.5.1: assignment emails must contain a message and await delivery';
  end if;
  if to_regclass('public.coordinator_assignment_notifications') is null then
    raise exception 'FAIL: AC-017.5.1: assignment must retain in-app notifications for its recipients';
  end if;
  select array_agg(recipient_id order by recipient_id) into notice_recipients
  from public.coordinator_assignment_notifications
  where event_id = '17410000-0000-0000-0000-000000000001';
  if notice_recipients is distinct from array[
    '17400000-0000-0000-0000-000000000002'::uuid,
    '17400000-0000-0000-0000-000000000003'::uuid
  ] then
    raise exception 'FAIL: AC-017.5.1: in-app recipients must be exactly the organiser and new coordinator';
  end if;
  raise notice 'PASS: AC-017.5.1: assignment records in-app notifications and queues email for the new coordinator and organiser';
end $$;

-- AC5 reassignment: a new history entry has its own recipients; a no-op or
-- refused attempt must not enqueue a second copy of either notification.
insert into auth.users (id, email) values
  ('17400000-0000-0000-0000-000000000004', 'replacement-us17-notify@example.test'),
  ('17400000-0000-0000-0000-000000000005', 'outsider-us17-notify@example.test');
update public.profiles set role = 'coordinator'
  where id = '17400000-0000-0000-0000-000000000004';
update public.profiles set role = 'organiser'
  where id = '17400000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub', '17400000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000004');
select public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000004');
do $$ begin
  begin
    perform public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
      '17400000-0000-0000-0000-000000000002');
    raise exception 'FAIL: AC-017.5.2: assigning an organiser must be refused';
  exception when sqlstate '22000' then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '17400000-0000-0000-0000-000000000003', true);
do $$ begin
  begin
    perform public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
      '17400000-0000-0000-0000-000000000003');
    raise exception 'FAIL: AC-017.5.2: coordinator self-assignment must be refused';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare recipients text[]; notice_recipients uuid[]; history_id uuid;
begin
  select id into strict history_id from public.event_coordinator_assignment_history
    where event_id = '17410000-0000-0000-0000-000000000001'
      and previous_coordinator_id = '17400000-0000-0000-0000-000000000003'
      and new_coordinator_id = '17400000-0000-0000-0000-000000000004';
  select array_agg(recipient_id order by recipient_id) into notice_recipients
    from public.coordinator_assignment_notifications where assignment_history_id = history_id;
  select array_agg(o.recipient_email order by o.recipient_email) into recipients
    from public.coordinator_assignment_notifications n
    join public.notification_outbox o on o.id = n.email_outbox_id
    where n.assignment_history_id = history_id and o.event_id = n.event_id;
  if notice_recipients is distinct from array[
    '17400000-0000-0000-0000-000000000002'::uuid,
    '17400000-0000-0000-0000-000000000004'::uuid
  ] or recipients is distinct from array[
    'organiser-us17-notify@example.test', 'replacement-us17-notify@example.test'
  ]::text[] then
    raise exception 'FAIL: AC-017.5.2: reassignment must notify the replacement and organiser with linked emails';
  end if;
  if (select count(*) from public.coordinator_assignment_notifications
      where event_id = '17410000-0000-0000-0000-000000000001') <> 4
    or (select count(*) from public.notification_outbox
      where event_id = '17410000-0000-0000-0000-000000000001') <> 4
    or (select count(*) from public.event_coordinator_assignment_history
      where event_id = '17410000-0000-0000-0000-000000000001') <> 2
    or (select coordinator_id from public.events
      where id = '17410000-0000-0000-0000-000000000001') is distinct from
        '17400000-0000-0000-0000-000000000004'::uuid then
    raise exception 'FAIL: AC-017.5.2: no-op and failed assignments must preserve assignment and notification counts';
  end if;
  raise notice 'PASS: AC-017.5.2: reassignment notifies replacement and organiser; no-op and failed attempts create nothing';
end $$;

-- Exercise real authenticated RLS, including successful reads, rather than
-- merely inspecting policy definitions. An old recipient loses event access.
set local role authenticated;
do $$
declare actor uuid; expected_count integer; actual_count integer; forbidden text;
begin
  for actor, expected_count in select * from (values
    ('17400000-0000-0000-0000-000000000001'::uuid, 0), -- Lead is not a recipient
    ('17400000-0000-0000-0000-000000000002'::uuid, 2), -- owning organiser
    ('17400000-0000-0000-0000-000000000003'::uuid, 0), -- previous coordinator
    ('17400000-0000-0000-0000-000000000004'::uuid, 1), -- current coordinator
    ('17400000-0000-0000-0000-000000000005'::uuid, 0)  -- unrelated organiser
  ) as cases(actor_id, expected) loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    select count(*) into actual_count from public.coordinator_assignment_notifications
      where event_id = '17410000-0000-0000-0000-000000000001';
    if actual_count <> expected_count or exists (
      select 1 from public.coordinator_assignment_notifications where recipient_id <> actor
    ) then
      raise exception 'FAIL: AC-017.5.3: recipient/current-assignment access incorrect for %, expected %, got %', actor, expected_count, actual_count;
    end if;
    foreach forbidden in array array[
      'insert into public.coordinator_assignment_notifications default values',
      'update public.coordinator_assignment_notifications set body = ''forged''',
      'delete from public.coordinator_assignment_notifications',
      'select * from public.notification_outbox',
      'update public.coordinator_assignment_notification_settings set email_enabled = false'
    ] loop
      begin
        execute forbidden;
        raise exception 'FAIL: AC-017.5.3: browser operation unexpectedly allowed: %', forbidden;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end loop;
  raise notice 'PASS: AC-017.5.3: recipients read only their authorised notices; browser writes, settings changes and outbox reads are denied';
end $$;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform * from public.coordinator_assignment_notifications;
    raise exception 'FAIL: AC-017.5.3: anonymous access must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Settings affect future assignments only. Alternate coordinators so every
-- scenario is a real assignment, including when both channels are disabled.
create temp table notices_before_channel_changes as
  select * from public.coordinator_assignment_notifications;
do $$
declare app_channel boolean; email_channel boolean; target uuid;
  history_id uuid; before_emails bigint; expected_notices integer;
begin
  for app_channel, email_channel, target in select * from (values
    (true, false, '17400000-0000-0000-0000-000000000003'::uuid),
    (false, true, '17400000-0000-0000-0000-000000000004'::uuid),
    (false, false, '17400000-0000-0000-0000-000000000003'::uuid)
  ) as cases(app_enabled, email_enabled, coordinator) loop
    update public.coordinator_assignment_notification_settings
      set in_app_enabled = app_channel, email_enabled = email_channel;
    select count(*) into before_emails from public.notification_outbox;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', '17400000-0000-0000-0000-000000000001', true);
    perform public.assign_event_coordinator('17410000-0000-0000-0000-000000000001', target);
    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '', true);
    select id into strict history_id from public.event_coordinator_assignment_history
      where event_id = '17410000-0000-0000-0000-000000000001'
      order by assigned_at desc limit 1;
    expected_notices := case when app_channel or email_channel then 2 else 0 end;
    if (select count(*) from public.coordinator_assignment_notifications
        where assignment_history_id = history_id) <> expected_notices
      or exists (select 1 from public.coordinator_assignment_notifications
        where assignment_history_id = history_id and
          (in_app_enabled <> app_channel or (email_outbox_id is not null) <> email_channel))
      or (select count(*) from public.notification_outbox) - before_emails <>
        (case when email_channel then 2 else 0 end) then
      raise exception 'FAIL: AC-017.5.4: incorrect channel output for in-app %, email %', app_channel, email_channel;
    end if;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', target::text, true);
    if (select count(*) from public.coordinator_assignment_notifications
        where assignment_history_id = history_id) <> (case when app_channel then 1 else 0 end) then
      raise exception 'FAIL: AC-017.5.4: coordinator must see only enabled in-app notices';
    end if;
    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '', true);
  end loop;
  if exists (select * from notices_before_channel_changes
      except select * from public.coordinator_assignment_notifications) then
    raise exception 'FAIL: AC-017.5.4: channel changes must preserve earlier notices';
  end if;
  raise notice 'PASS: AC-017.5.4: channel settings control future notices without changing previous records';
end $$;

-- Keep a non-default setting and populated records across the runner's replay.
-- This fixture is committed only inside its disposable Docker database.
update public.coordinator_assignment_notification_settings
  set in_app_enabled = true, email_enabled = false;
create temp table assignment_settings_before_replay as
  select * from public.coordinator_assignment_notification_settings;
create temp table assignment_notices_before_replay as
  select * from public.coordinator_assignment_notifications;
create temp table assignment_history_before_replay as
  select * from public.event_coordinator_assignment_history;
create temp table assignment_emails_before_replay as
  select * from public.notification_outbox;
commit;
