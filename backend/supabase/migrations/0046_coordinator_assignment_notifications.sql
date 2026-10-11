-- US17 AC5: notify the new coordinator and organiser after a Lead assignment.
-- Additive; delivery reuses the existing US4 email outbox and sender.
begin;

create table if not exists public.coordinator_assignment_notification_settings (
  notification_type text primary key check (notification_type = 'coordinator_assignment'),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true
);
insert into public.coordinator_assignment_notification_settings (notification_type)
values ('coordinator_assignment') on conflict do nothing;
alter table public.coordinator_assignment_notification_settings enable row level security;
revoke all on public.coordinator_assignment_notification_settings from public, anon, authenticated;

create table if not exists public.coordinator_assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  assignment_history_id uuid not null references public.event_coordinator_assignment_history(id),
  event_id uuid not null references public.events(id),
  recipient_id uuid not null references public.profiles(id),
  notification_type text not null default 'coordinator_assignment'
    check (notification_type = 'coordinator_assignment'),
  subject text not null,
  body text not null,
  in_app_enabled boolean not null,
  email_outbox_id uuid references public.notification_outbox(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assignment_history_id, recipient_id)
);
create index if not exists coordinator_assignment_notifications_recipient_idx
  on public.coordinator_assignment_notifications(recipient_id, created_at desc);
alter table public.coordinator_assignment_notifications enable row level security;
revoke all on public.coordinator_assignment_notifications from public, anon, authenticated;
grant select on public.coordinator_assignment_notifications to authenticated;
drop policy if exists recipients_read_assignment_notifications on public.coordinator_assignment_notifications;
create policy recipients_read_assignment_notifications on public.coordinator_assignment_notifications
  for select to authenticated using (
    recipient_id = auth.uid() and in_app_enabled
    and exists (select 1 from public.events e where e.id = event_id
      and ((public.current_user_role() = 'organiser' and e.organiser_id = auth.uid())
        or (public.current_user_role() = 'coordinator' and e.coordinator_id = auth.uid())))
  );

create or replace function public.notify_coordinator_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  settings public.coordinator_assignment_notification_settings%rowtype;
  organiser uuid;
  recipient uuid;
  recipient_email text;
  notice_id uuid;
  outbox_id uuid;
  notice_subject text;
  notice_body text;
begin
  -- The history is written only for real Lead changes. Do not backfill old
  -- assignments or emit notifications for administrator repairs/unassignment.
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator_lead'
    or new.new_coordinator_id is null then return new; end if;
  select * into settings from public.coordinator_assignment_notification_settings
    where notification_type = 'coordinator_assignment';
  if not found or not (settings.in_app_enabled or settings.email_enabled) then return new; end if;
  select organiser_id into organiser from public.events where id = new.event_id;

  for recipient in select distinct id from unnest(array[new.new_coordinator_id, organiser]) as recipients(id)
    where id is not null loop
    if recipient = new.new_coordinator_id then
      notice_subject := 'An event has been assigned to you';
      notice_body := 'You have been assigned responsibility for an event. Sign in to ConnectSphere and open Requests to view events currently assigned to you.';
    else
      notice_subject := 'Your event coordinator assignment has changed';
      notice_body := 'A coordinator has been assigned or reassigned to your event. Sign in to ConnectSphere and open your event request to view its current details.';
    end if;
    -- Generic messages avoid disclosing event details in mail delivered after
    -- another reassignment. App links must still use current event permissions.
    insert into public.coordinator_assignment_notifications
      (assignment_history_id, event_id, recipient_id, subject, body, in_app_enabled)
    values (new.id, new.event_id, recipient, notice_subject, notice_body, settings.in_app_enabled)
    on conflict (assignment_history_id, recipient_id) do nothing returning id into notice_id;
    if notice_id is null then continue; end if;
    if settings.email_enabled then
      select email into recipient_email from auth.users where id = recipient;
      if nullif(btrim(recipient_email), '') is not null then
        insert into public.notification_outbox(event_id, recipient_email, subject, body)
        values (new.event_id, recipient_email, notice_subject, notice_body) returning id into outbox_id;
        update public.coordinator_assignment_notifications set email_outbox_id = outbox_id where id = notice_id;
      end if;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.notify_coordinator_assignment() from public, anon, authenticated;
-- Using the immutable history entry ties notices to one real assignment change.
-- Assignment, history and notices commit or roll back together.
drop trigger if exists assignment_history_notify_recipients on public.event_coordinator_assignment_history;
create trigger assignment_history_notify_recipients
  after insert on public.event_coordinator_assignment_history
  for each row execute function public.notify_coordinator_assignment();

commit;
