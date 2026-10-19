-- US33 Choose notification channels by type (SCRUM-230), slice 2a: the sending helper.
-- AC-033.4 notifications are delivered only through the channels enabled for their type.
-- AC-033.5 a choice applies to notifications created after it.
-- Apply after 0077. Safe to replay.
--
-- One place decides, for a person and a notification type, whether it goes in-app, by email,
-- both or neither: their own choice (0077, on unless they turned it off), and for the three
-- types that already had one, the system-wide switch, kept as an all-on admin kill switch
-- (team decision). Each feature that sends notices is moved onto these helpers in its own PR;
-- until then it keeps sending as before, and this migration changes nothing anyone receives.
begin;

-- ---------------------------------------------------------------------------
-- Emails record what kind of notice they are and who they are for
-- ---------------------------------------------------------------------------
-- Null on every email queued before its feature was moved onto the helper.
alter table public.notification_outbox
  add column if not exists notification_type text references public.notification_types (code),
  add column if not exists recipient_id uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- In-app copies of notices that had none
-- ---------------------------------------------------------------------------
-- Event decisions, venue closures, registrations and waiting-list updates were only ever
-- emailed; US32's feed showed the email itself. Once their features use the helper, the in-app
-- copy lives here, so switching email off no longer hides it in the app too.
create table if not exists public.user_notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type_code    text not null references public.notification_types (code),
  event_id     uuid references public.events (id) on delete cascade,
  subject      text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists user_notifications_recipient_idx
  on public.user_notifications (recipient_id, created_at desc);

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
drop policy if exists user_notifications_own on public.user_notifications;
create policy user_notifications_own on public.user_notifications
  for select to authenticated using (recipient_id = auth.uid());

-- These four already reach people in-app through the feed.
update public.notification_types set delivered_in_app = true
  where code in ('event_request_decision', 'venue_block_alert', 'registration_update', 'waitlist_update');

-- ---------------------------------------------------------------------------
-- AC-033.4: which channels a notice may use
-- ---------------------------------------------------------------------------
-- The system-wide switches of US7, US17 and US14, read where they exist. A missing settings
-- row sends nothing, as those features did themselves.
create or replace function public.notification_system_channels(p_type text)
returns table (in_app boolean, email boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_type = 'change_request' then
    return query select coalesce(bool_and(s.in_app_enabled), false), coalesce(bool_and(s.email_enabled), false)
      from public.change_request_notification_settings s where s.notification_type = 'change_request_submitted';
  elsif p_type = 'coordinator_assignment' then
    return query select coalesce(bool_and(s.in_app_enabled), false), coalesce(bool_and(s.email_enabled), false)
      from public.coordinator_assignment_notification_settings s where s.notification_type = 'coordinator_assignment';
  elsif p_type = 'equipment_reservation_outcome' then
    return query select coalesce(bool_and(s.in_app_enabled), false), coalesce(bool_and(s.email_enabled), false)
      from public.equipment_notification_settings s where s.notification_type = 'equipment_requirement_outcome';
  else
    return query select true, true;
  end if;
end $$;

-- The person's own choice and the system-wide switch must both allow a channel. The choice
-- is read at the moment the notice is created, so it only affects notices from then on
-- (AC-033.5).
create or replace function public.notification_channels(p_recipient uuid, p_type text)
returns table (in_app boolean, email boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.notification_types t where t.code = p_type) then
    raise exception 'Unknown notification type: %', p_type using errcode = '22023';
  end if;
  return query
  select coalesce(p.in_app, true) and s.in_app, coalesce(p.email, true) and s.email
  from public.notification_system_channels(p_type) s
  left join public.notification_preferences p on p.user_id = p_recipient and p.type_code = p_type;
end $$;

-- Queues the email if the recipient's email channel is on and they have an address; returns
-- the outbox row, or null when nothing was queued.
create or replace function public.queue_notification_email(
  p_recipient uuid, p_type text, p_event uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_id    uuid;
begin
  if p_recipient is null or not (select c.email from public.notification_channels(p_recipient, p_type) c) then
    return null;
  end if;
  select u.email into v_email from auth.users u where u.id = p_recipient;
  if nullif(btrim(v_email), '') is null then
    return null;
  end if;
  insert into public.notification_outbox (event_id, recipient_email, subject, body, notification_type, recipient_id)
  values (p_event, v_email, p_subject, p_body, p_type, p_recipient)
  returning id into v_id;
  return v_id;
end $$;

-- Records the in-app copy, for a type with no in-app table of its own, if the recipient's
-- in-app channel is on; returns it, or null.
create or replace function public.record_in_app_notice(
  p_recipient uuid, p_type text, p_event uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_recipient is null or not (select c.in_app from public.notification_channels(p_recipient, p_type) c) then
    return null;
  end if;
  insert into public.user_notifications (recipient_id, type_code, event_id, subject, body)
  values (p_recipient, p_type, p_event, p_subject, p_body)
  returning id into v_id;
  return v_id;
end $$;

-- Both channels, for a notice with no in-app table of its own.
create or replace function public.send_notification(
  p_recipient uuid, p_type text, p_event uuid, p_subject text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_in_app_notice(p_recipient, p_type, p_event, p_subject, p_body);
  perform public.queue_notification_email(p_recipient, p_type, p_event, p_subject, p_body);
end $$;

-- Only the database's own triggers and functions send notices; nobody calls these from the
-- app, so nobody can fake one.
revoke all on function public.notification_system_channels(text) from public, anon, authenticated;
revoke all on function public.notification_channels(uuid, text) from public, anon, authenticated;
revoke all on function public.queue_notification_email(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_in_app_notice(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.send_notification(uuid, text, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- US32's feed: in-app copies in, typed emails out, so nothing shows twice
-- ---------------------------------------------------------------------------
-- 0072's list of emails, minus any email sent through the helper: its in-app side is already
-- in the feed (the feature's own table, or user_notifications), or the person turned in-app off.
create or replace function public.my_email_notifications()
returns table (id uuid, event_id uuid, event_name text, event_reference text,
               subject text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.name, e.reference, o.subject, o.body, o.created_at
  from public.notification_outbox o
  join auth.users u on u.id = auth.uid() and lower(o.recipient_email) = lower(u.email)
  left join public.events e on e.id = o.event_id
  where o.notification_type is null
    and not exists (select 1 from public.change_request_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.coordinator_assignment_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.equipment_requirement_notifications n where n.email_outbox_id = o.id);
$$;
revoke all on function public.my_email_notifications() from public, anon;
grant execute on function public.my_email_notifications() to authenticated;

-- The signed-in user's in-app copies, with their event's name and reference. Read on their
-- behalf, like their emails above, because some roles (Attendees) cannot read events directly
-- and these notices named the event when they were only emails.
create or replace function public.my_in_app_notices()
returns table (id uuid, event_id uuid, event_name text, event_reference text,
               subject text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.event_id, e.name, e.reference, n.subject, n.body, n.created_at
  from public.user_notifications n
  left join public.events e on e.id = n.event_id
  where n.recipient_id = auth.uid();
$$;
revoke all on function public.my_in_app_notices() from public, anon;
grant execute on function public.my_in_app_notices() to authenticated;

-- 0073's feed with one more source: 'notice', the in-app copies above.
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
    -- US33: in-app copies of notices that used to exist only as emails.
    select 'notice', m.id, m.event_id, m.event_name, m.event_reference, m.subject, m.body, m.created_at, null, null
    from public.my_in_app_notices() m

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

-- Read state accepts the new source.
alter table public.notification_reads drop constraint if exists notification_reads_source_check;
alter table public.notification_reads add constraint notification_reads_source_check
  check (source in ('arrangement_review', 'change_request', 'coordinator_assignment',
                    'equipment', 'venue_decision', 'venue_request', 'email', 'notice'));

commit;
