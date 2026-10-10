-- Run after the notification fixtures and migration 0046 replay, in Docker only.
begin;
do $$
declare actual_table text; snapshot_table text; changed boolean;
begin
  for actual_table, snapshot_table in select * from (values
    ('coordinator_assignment_notification_settings', 'assignment_settings_before_replay'),
    ('coordinator_assignment_notifications', 'assignment_notices_before_replay'),
    ('event_coordinator_assignment_history', 'assignment_history_before_replay'),
    ('notification_outbox', 'assignment_emails_before_replay')
  ) as snapshots(actual, saved) loop
    execute format('select exists ((select * from public.%I except select * from pg_temp.%I)
      union all (select * from pg_temp.%I except select * from public.%I))',
      actual_table, snapshot_table, snapshot_table, actual_table) into changed;
    if changed then
      raise exception 'FAIL: AC-017.5.5: replay changed %', actual_table;
    end if;
  end loop;
end $$;

-- A fresh real assignment proves replay leaves one working trigger that still
-- respects the saved in-app-only configuration.
set local role authenticated;
select set_config('request.jwt.claim.sub', '17400000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17410000-0000-0000-0000-000000000001',
  '17400000-0000-0000-0000-000000000004');
reset role;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare history_id uuid;
begin
  select id into strict history_id from public.event_coordinator_assignment_history
    where id not in (select id from assignment_history_before_replay);
  if (select count(*) from public.coordinator_assignment_notifications
      where assignment_history_id = history_id and in_app_enabled and email_outbox_id is null) <> 2
    or (select count(*) from public.coordinator_assignment_notifications) <>
      (select count(*) + 2 from assignment_notices_before_replay)
    or exists ((select * from public.notification_outbox except select * from assignment_emails_before_replay)
      union all (select * from assignment_emails_before_replay except select * from public.notification_outbox)) then
    raise exception 'FAIL: AC-017.5.5: notification trigger must work once with preserved settings after replay';
  end if;
  raise notice 'PASS: AC-017.5.5: replay preserves settings and records; subsequent assignments respect saved channels';
end $$;
rollback;
