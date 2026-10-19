-- US37 (SCRUM-234, subtask SCRUM-265): AC-037.3 — the assigned Coordinator is notified
-- when the Organiser answers a clarification request and the request is resubmitted.
--
-- Apply after 0096, and after 0072/0073 (the notification feed and its read state). Safe
-- to replay.
--
-- Nothing new is invented here: this follows 0016, 0046 and 0051 exactly — a settings row
-- for the two channels, a table the trigger writes in the same transaction as the thing it
-- reports, the existing notification_outbox for mail, the unchanged US4 sender, and one
-- more arm in the feed.

begin;

-- ---------------------------------------------------------------------------
-- Channels
-- ---------------------------------------------------------------------------
-- Both on by default. 0016 left email off for change-request notices because the
-- Coordinator sees those on their queue anyway; this is the opposite case — the Coordinator
-- asked a question and is waiting on the answer, and a request sitting answered-but-unread
-- is the delay the clarification was meant to avoid.
--
-- Administrator configuration only: no browser role can read or write this table, so a
-- Coordinator cannot quietly turn off a notice the team agreed to send.
create table if not exists public.clarification_response_notification_settings (
  notification_type text primary key check (notification_type = 'clarification_response'),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true
);
insert into public.clarification_response_notification_settings (notification_type)
values ('clarification_response') on conflict do nothing;
alter table public.clarification_response_notification_settings enable row level security;
revoke all on public.clarification_response_notification_settings
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The notices
-- ---------------------------------------------------------------------------
-- Keyed on the response row, so one answered round can produce exactly one notice per
-- recipient however many times anything is retried. Same reasoning as 0046 keying on the
-- assignment-history entry.
create table if not exists public.clarification_response_notifications (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null
    references public.event_clarification_responses (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id),
  notification_type text not null default 'clarification_response'
    check (notification_type = 'clarification_response'),
  subject text not null,
  body text not null,
  in_app_enabled boolean not null,
  email_outbox_id uuid references public.notification_outbox (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (response_id, recipient_id)
);

create index if not exists clarification_response_notifications_recipient_idx
  on public.clarification_response_notifications (recipient_id, created_at desc);

alter table public.clarification_response_notifications enable row level security;
revoke all on public.clarification_response_notifications from public, anon, authenticated;
grant select on public.clarification_response_notifications to authenticated;

-- The recipient, while they are still the one responsible for the event. A reassignment
-- moves the notice to whoever holds the request now, as it does everywhere else since 0048
-- — an answer is only useful to the person who has to act on it.
drop policy if exists recipients_read_clarification_notifications
  on public.clarification_response_notifications;
create policy recipients_read_clarification_notifications
  on public.clarification_response_notifications
  for select to authenticated using (
    recipient_id = auth.uid()
    and in_app_enabled
    and public.is_assigned_event_coordinator(event_id)
  );

-- ---------------------------------------------------------------------------
-- Writing the notice
-- ---------------------------------------------------------------------------
-- Fires on the response row rather than on the event's status change. The two are the same
-- occasion — respond_to_clarification writes the row and makes the move in the next
-- statement of the same transaction, so a notice can never survive a resubmission that
-- failed — and the response row is what gives the notice a stable key.
--
-- An unassigned request produces no notice, as in 0016: there is nobody to tell. US17
-- assignment is the dependency, not something to work around by picking a Coordinator here.
--
-- auth.uid() is null means the SQL editor or the service role — an administrator repairing
-- data, which should not send mail to anyone.
create or replace function public.notify_clarification_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.clarification_response_notification_settings%rowtype;
  recipient uuid;
  recipient_email text;
  notice_id uuid;
  outbox_id uuid;
  notice_subject text;
  notice_body text;
begin
  if auth.uid() is null then return new; end if;

  select * into settings from public.clarification_response_notification_settings
   where notification_type = 'clarification_response';
  if not found or not (settings.in_app_enabled or settings.email_enabled) then
    return new;
  end if;

  select coordinator_id into recipient from public.events where id = new.event_id;
  if recipient is null then return new; end if;

  -- Generic, and deliberately carrying neither the question nor the reply. Mail leaves our
  -- control, and the Coordinator can read both on the request itself under the policy
  -- above; a subject line is not the place for whatever an Organiser typed.
  notice_subject := 'An organiser has answered your clarification request';
  notice_body := 'An organiser has replied to a request you returned for clarification, '
    || 'and it is back under review. Sign in to ConnectSphere and open the request to read '
    || 'the reply and see what changed.';

  insert into public.clarification_response_notifications
    (response_id, event_id, recipient_id, subject, body, in_app_enabled)
  values (new.id, new.event_id, recipient, notice_subject, notice_body,
          settings.in_app_enabled)
  on conflict (response_id, recipient_id) do nothing
  returning id into notice_id;
  if notice_id is null then return new; end if;

  if settings.email_enabled then
    select email into recipient_email from auth.users where id = recipient;
    if nullif(btrim(recipient_email), '') is not null then
      insert into public.notification_outbox (event_id, recipient_email, subject, body)
      values (new.event_id, recipient_email, notice_subject, notice_body)
      returning id into outbox_id;
      update public.clarification_response_notifications
         set email_outbox_id = outbox_id where id = notice_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_clarification_response()
  from public, anon, authenticated;

-- The answer, the notice and the resubmission commit or roll back together.
drop trigger if exists clarification_responses_notify_coordinator
  on public.event_clarification_responses;
create trigger clarification_responses_notify_coordinator
  after insert on public.event_clarification_responses
  for each row execute function public.notify_clarification_response();

-- ---------------------------------------------------------------------------
-- The feed (US32)
-- ---------------------------------------------------------------------------
-- A new source has to be registered in three places, which is the cost of 0072 having
-- chosen a union over one notifications table. Missing any one of them fails quietly:
-- without the CHECK the notice cannot be marked read, without the feed arm it never
-- appears, and without the outbox exclusion it appears twice.
alter table public.notification_reads
  drop constraint if exists notification_reads_source_check;
alter table public.notification_reads
  add constraint notification_reads_source_check check (
    source in ('arrangement_review', 'change_request', 'coordinator_assignment',
               'equipment', 'venue_decision', 'venue_request', 'email',
               'clarification_response')
  );

-- Unchanged but for the last clause: mail this feature also recorded in-app is left out,
-- because the in-app record is already in the feed and already respects the in-app setting.
create or replace function public.my_email_notifications()
returns table (id uuid, event_id uuid, event_name text, event_reference text,
               subject text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.name, e.reference, o.subject, o.body, o.created_at
  from public.notification_outbox o
  join auth.users u on u.id = auth.uid() and lower(o.recipient_email) = lower(u.email)
  left join public.events e on e.id = o.event_id
  where not exists (select 1 from public.change_request_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.coordinator_assignment_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.equipment_requirement_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.clarification_response_notifications n where n.email_outbox_id = o.id);
$$;
revoke all on function public.my_email_notifications() from public, anon;
grant execute on function public.my_email_notifications() to authenticated;

-- 0073's feed with one more arm. Replaced rather than dropped: the signature is unchanged,
-- and count_my_unread_notifications, mark_notification_read and mark_all_notifications_read
-- all read through this function, so they pick the new source up without being touched.
create or replace function public.get_my_notifications(p_limit integer default 100)
returns table (source text, id uuid, event_id uuid, event_name text, event_reference text,
               title text, detail text, created_at timestamptz, item_id uuid, read_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your notifications' using errcode = '42501';
  end if;

  return query
  select f.source, f.id, f.event_id, f.event_name, f.event_reference, f.title, f.detail, f.created_at,
         f.item_id, coalesce(r.read_at, f.source_read_at)
  from (
    select 'arrangement_review'::text as source, n.id, n.event_id, e.name as event_name, e.reference as event_reference,
           'An arrangement needs review'::text as title, n.detail, n.created_at,
           null::uuid as item_id, null::timestamptz as source_read_at
    from public.arrangement_review_notifications n
    left join public.events e on e.id = n.event_id

    union all
    select 'change_request', n.id, n.event_id, e.name, e.reference,
           'A change request is ready for review', 'The organiser has asked to change this event.', n.created_at,
           null, null
    from public.change_request_notifications n
    left join public.events e on e.id = n.event_id

    union all
    select 'coordinator_assignment', n.id, n.event_id, e.name, e.reference, n.subject, n.body, n.created_at,
           null, null
    from public.coordinator_assignment_notifications n
    left join public.events e on e.id = n.event_id

    union all
    -- US37: the Organiser has answered a clarification request.
    select 'clarification_response', n.id, n.event_id, e.name, e.reference, n.subject, n.body, n.created_at,
           null, null
    from public.clarification_response_notifications n
    left join public.events e on e.id = n.event_id

    union all
    select 'equipment', n.id, n.event_id, e.name, e.reference,
           case n.action
             when 'added' then 'Equipment requirement added'
             when 'changed' then 'Equipment requirement changed'
             when 'removed' then 'Equipment requirement removed'
             when 'reserved' then 'Equipment reserved'
             when 'partially_reserved' then 'Equipment partly reserved'
             else 'Equipment unavailable'
           end,
           concat_ws('. ',
             format('%s × %s', n.type_name, n.quantity),
             case when n.action = 'partially_reserved' then format('%s reserved', n.quantity_reserved) end,
             case when n.alternative_type_name is not null then format('Alternative offered: %s', n.alternative_type_name) end,
             n.alternative_note),
           n.created_at, null, null
    from public.equipment_requirement_notifications n
    left join public.events e on e.id = n.event_id

    union all
    select 'venue_decision', n.id, n.event_id, e.name, coalesce(e.reference, n.event_reference),
           case n.decision when 'confirmed' then 'Venue booking confirmed' else 'Venue booking rejected' end,
           concat_ws('. ', n.venue_name, n.reason, case when n.alternative is not null then format('Suggested instead: %s', n.alternative) end),
           n.created_at, n.booking_id, null
    from public.venue_booking_decision_notifications n
    left join public.events e on e.id = n.event_id

    union all
    select 'venue_request', n.id, b.event_id, e.name, e.reference,
           'New venue booking request', v.name, n.created_at, n.venue_booking_id, n.read_at
    from public.venue_booking_notifications n
    left join public.venue_bookings b on b.id = n.venue_booking_id
    left join public.venues v on v.id = n.venue_id
    left join public.events e on e.id = b.event_id

    union all
    select 'email', m.id, m.event_id, m.event_name, m.event_reference, m.subject, m.body, m.created_at, null, null
    from public.my_email_notifications() m
  ) f
  left join public.notification_reads r
    on r.user_id = auth.uid() and r.source = f.source and r.notification_id = f.id
  order by f.created_at desc, f.source, f.id
  limit greatest(coalesce(p_limit, 100), 1);
end $$;
revoke all on function public.get_my_notifications(integer) from public, anon;
grant execute on function public.get_my_notifications(integer) to authenticated;

commit;
