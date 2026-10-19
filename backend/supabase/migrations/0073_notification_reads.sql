-- US32 View in-app notifications (SCRUM-229), slice 2: read and unread.
-- AC-032.2 unread notifications stand out, with an unread count in the navigation.
-- AC-032.3 opening a notification marks it read. AC-032.4 a user can mark all as read.
-- AC-032.5 each user's read state is their own.
-- Apply after 0072. Safe to replay.
begin;

-- ---------------------------------------------------------------------------
-- Read state, keyed on the feed's (source, id), so no source table changes
-- ---------------------------------------------------------------------------
create table if not exists public.notification_reads (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  source          text not null check (source in ('arrangement_review', 'change_request', 'coordinator_assignment',
                                                  'equipment', 'venue_decision', 'venue_request', 'email')),
  notification_id uuid not null,
  read_at         timestamptz not null default now(),
  primary key (user_id, source, notification_id)
);

alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from anon, authenticated;
grant select, insert on public.notification_reads to authenticated;
drop policy if exists notification_reads_own on public.notification_reads;
create policy notification_reads_own on public.notification_reads
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notification_reads_insert_own on public.notification_reads;
create policy notification_reads_insert_own on public.notification_reads
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The feed, now with when each notice was read and the item it is about
-- ---------------------------------------------------------------------------
-- 0072's feed plus two columns: read_at (null while unread) and item_id (the venue booking a
-- venue notice is about, so it can be opened). The return type changes, so it is dropped first.
-- US9's booking-request notices already had a read_at of their own; either one counts.
drop function if exists public.get_my_notifications(integer);
create function public.get_my_notifications(p_limit integer default 100)
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

-- Every notice in a user's feed, for counting and marking. The feed is small per user; the
-- limit is only there to keep it bounded.
create or replace function public.count_my_unread_notifications()
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::integer from public.get_my_notifications(10000) f where f.read_at is null;
$$;
revoke all on function public.count_my_unread_notifications() from public, anon;
grant execute on function public.count_my_unread_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- AC-032.3: opening a notification marks it read
-- ---------------------------------------------------------------------------
-- Only a notice in the user's own feed can be marked, so nobody can mark someone else's.
-- Marking twice is harmless. A booking-request notice is also marked read where US9 shows it.
create or replace function public.mark_notification_read(p_source text, p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your notifications' using errcode = '42501';
  end if;
  if not exists (select 1 from public.get_my_notifications(10000) f where f.source = p_source and f.id = p_id) then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;
  insert into public.notification_reads (user_id, source, notification_id)
  values (auth.uid(), p_source, p_id)
  on conflict do nothing;
  if p_source = 'venue_request' then
    update public.venue_booking_notifications set read_at = coalesce(read_at, now()) where id = p_id;
  end if;
end $$;
revoke all on function public.mark_notification_read(text, uuid) from public, anon;
grant execute on function public.mark_notification_read(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- AC-032.4: mark all as read
-- ---------------------------------------------------------------------------
-- Returns how many notices were unread.
create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_marked integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your notifications' using errcode = '42501';
  end if;
  insert into public.notification_reads (user_id, source, notification_id)
  select auth.uid(), f.source, f.id from public.get_my_notifications(10000) f where f.read_at is null
  on conflict do nothing;
  get diagnostics v_marked = row_count;
  update public.venue_booking_notifications set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
  return v_marked;
end $$;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

commit;
