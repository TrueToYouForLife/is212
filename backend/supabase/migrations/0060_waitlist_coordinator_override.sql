-- 0060_waitlist_coordinator_override.sql — US16 SCRUM-154: the assigned Coordinator can override
-- the waiting-list order (Thread 26: "first-in, first-out, with a manual override").
--
-- 0058 and 0059 are applied and are not edited. FIFO stays the rule: the queue is ordered by
-- queue_key, which starts equal to joined_at, so nothing changes until someone is moved.
-- joined_at is kept untouched as the true record of when the Attendee joined. Safe to re-run.
begin;

-- ---------------------------------------------------------------------------
-- The ordering key, and who last moved an entry
-- ---------------------------------------------------------------------------
alter table public.event_waitlist_entries add column if not exists queue_key timestamptz;
update public.event_waitlist_entries set queue_key = joined_at where queue_key is null;
alter table public.event_waitlist_entries alter column queue_key set default clock_timestamp();
alter table public.event_waitlist_entries alter column queue_key set not null;

-- Retained for accountability: the last Coordinator to move this entry, and when. Null for an
-- entry nobody has moved. A foreign key, so the identity cannot be deleted from under the record.
alter table public.event_waitlist_entries
  add column if not exists overridden_by uuid references public.profiles (id),
  add column if not exists overridden_at timestamptz;
alter table public.event_waitlist_entries drop constraint if exists event_waitlist_override_paired;
alter table public.event_waitlist_entries
  add constraint event_waitlist_override_paired check ((overridden_by is null) = (overridden_at is null));

drop index if exists public.event_waitlist_queue;
create index if not exists event_waitlist_queue_key
  on public.event_waitlist_entries (event_id, queue_key, id)
  where status = 'waiting';

-- ---------------------------------------------------------------------------
-- Everything that read the order now reads queue_key
-- ---------------------------------------------------------------------------
-- 0058's offer function, with only the ORDER BY changed.
create or replace function public.process_waitlist(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ev record;
  places integer;
begin
  perform public.waitlist_lock(p_event_id);

  update public.event_waitlist_entries
     set status = 'expired', resolved_at = now()
   where event_id = p_event_id and status = 'offered' and offer_expires_at <= now();

  select e.status, e.registration_required, e.proposed_start into ev
  from public.events e where e.id = p_event_id;
  if not found
     or not public.event_is_open_for_registration(ev.status, ev.registration_required, ev.proposed_start)
     or ev.proposed_start - now() < interval '24 hours' then
    return;
  end if;

  places := public.waitlist_places_left(p_event_id);
  if places <= 0 then return; end if;

  update public.event_waitlist_entries
     set status = 'offered', offered_at = now(),
         offer_expires_at = least(now() + interval '3 days', ev.proposed_start)
   where id in (select w.id from public.event_waitlist_entries w
                 where w.event_id = p_event_id and w.status = 'waiting'
                 order by w.queue_key, w.id
                 limit places);
end;
$$;
revoke execute on function public.process_waitlist(uuid) from public, anon, authenticated;

-- 0059's two read functions, with only the position rule changed.
create or replace function public.get_open_event(p_event_id uuid)
returns table (
  id uuid, name text, event_type text, description text, programme text,
  proposed_start timestamptz, proposed_end timestamptz, prerequisites text, venue text,
  registered boolean, full boolean, waitlist_entry_id uuid, waitlist_status text,
  waitlist_position integer, offer_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.process_waitlist(p_event_id);

  return query
  select e.id, e.name, e.event_type, e.description, e.programme,
         e.proposed_start, e.proposed_end, e.registration_prerequisites,
         public.event_venue_label(e.id),
         exists (select 1 from public.event_registrations r
                  where r.event_id = e.id and r.attendee_id = auth.uid()
                    and r.status = 'registered'),
         public.waitlist_event_is_full(e.id),
         w.id,
         case when w.status = 'offered' and w.offer_expires_at <= now() then 'expired' else w.status end,
         case when w.status = 'waiting' then
           1 + (select count(*)::integer from public.event_waitlist_entries x
                 where x.event_id = w.event_id and x.status = 'waiting'
                   and (x.queue_key, x.id) < (w.queue_key, w.id))
         end,
         w.offer_expires_at
  from public.events e
  left join public.event_waitlist_entries w
    on w.event_id = e.id and w.attendee_id = auth.uid() and w.status in ('waiting', 'offered')
  where e.id = p_event_id
    and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start);
end;
$$;

create or replace function public.list_my_waitlist()
returns table (
  entry_id uuid, event_id uuid, event_name text, proposed_start timestamptz, venue text,
  status text, queue_position integer, offer_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  ev uuid;
begin
  for ev in
    select distinct w.event_id from public.event_waitlist_entries w
     where w.attendee_id = auth.uid() and w.status in ('waiting', 'offered')
     order by w.event_id
  loop
    perform public.process_waitlist(ev);
  end loop;

  return query
  select w.id, e.id, e.name, e.proposed_start, public.event_venue_label(e.id),
         case when w.status = 'offered' and w.offer_expires_at <= now() then 'expired' else w.status end,
         case when w.status = 'waiting' then
           1 + (select count(*)::integer from public.event_waitlist_entries x
                 where x.event_id = w.event_id and x.status = 'waiting'
                   and (x.queue_key, x.id) < (w.queue_key, w.id))
         end,
         w.offer_expires_at
  from public.event_waitlist_entries w
  join public.events e on e.id = w.event_id
  where w.attendee_id = auth.uid() and w.status in ('waiting', 'offered', 'expired')
  order by e.proposed_start, w.joined_at;
end;
$$;

revoke execute on function public.get_open_event(uuid) from public, anon;
revoke execute on function public.list_my_waitlist() from public, anon;
grant execute on function public.get_open_event(uuid) to authenticated;
grant execute on function public.list_my_waitlist() to authenticated;

-- ---------------------------------------------------------------------------
-- What the assigned Coordinator reads
-- ---------------------------------------------------------------------------
-- Held places first (they are not in the queue any more), then the queue in order. Only the
-- Attendee's name: the Coordinator needs to recognise a person, not to read an address.
-- Volatile because it also clears overdue offers first, so the list is never stale.
create or replace function public.list_event_waitlist(p_event_id uuid)
returns table (
  entry_id uuid, attendee_name text, status text, queue_position integer,
  joined_at timestamptz, offer_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.is_assigned_event_coordinator(p_event_id) then
    raise exception 'Only the assigned coordinator can see this waiting list' using errcode = '42501';
  end if;

  perform public.process_waitlist(p_event_id);

  return query
  select w.id, p.full_name,
         case when w.status = 'offered' and w.offer_expires_at <= now() then 'expired' else w.status end,
         case when w.status = 'waiting' then
           1 + (select count(*)::integer from public.event_waitlist_entries x
                 where x.event_id = w.event_id and x.status = 'waiting'
                   and (x.queue_key, x.id) < (w.queue_key, w.id))
         end,
         w.joined_at, w.offer_expires_at
  from public.event_waitlist_entries w
  join public.profiles p on p.id = w.attendee_id
  where w.event_id = p_event_id and w.status in ('waiting', 'offered')
  order by (w.status = 'waiting'), w.queue_key, w.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The override itself
-- ---------------------------------------------------------------------------
-- Moves one waiting entry to the front, or one place up or down. Only people still waiting can
-- move: an offered place is already held. Errors: 42501 not the assigned coordinator (also for an
-- unknown entry, so ids cannot be probed) · 22023 not front, up or down · 22000 event not
-- Confirmed · 55000 the entry is not waiting (hint says what it is).
create or replace function public.move_waitlist_entry(p_entry_id uuid, p_move text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ev_id uuid;
  ev_status text;
  current_status text;
  ids uuid[];
  idx integer;
  swap uuid;
  base timestamptz;
begin
  select w.event_id into ev_id from public.event_waitlist_entries w where w.id = p_entry_id;
  if auth.uid() is null or ev_id is null or not public.is_assigned_event_coordinator(ev_id) then
    raise exception 'Only the assigned coordinator can reorder this waiting list' using errcode = '42501';
  end if;
  if p_move is null or p_move not in ('front', 'up', 'down') then
    raise exception 'Choose front, up or down' using errcode = '22023';
  end if;

  select e.status into ev_status from public.events e where e.id = ev_id for share;
  if ev_status <> 'confirmed' then
    raise exception 'The waiting list can only be reordered while the event is Confirmed'
      using errcode = '22000';
  end if;

  perform public.waitlist_lock(ev_id);

  select w.status into current_status from public.event_waitlist_entries w
   where w.id = p_entry_id for update;
  if current_status <> 'waiting' then
    raise exception 'Only someone still waiting can be moved' using errcode = '55000', hint = current_status;
  end if;

  select array_agg(w.id order by w.queue_key, w.id) into ids
  from public.event_waitlist_entries w where w.event_id = ev_id and w.status = 'waiting';
  idx := array_position(ids, p_entry_id);

  if p_move = 'front' then
    if idx = 1 then return; end if;
    ids := array_prepend(p_entry_id, array_remove(ids, p_entry_id));
  elsif p_move = 'up' then
    if idx = 1 then return; end if;
    swap := ids[idx - 1]; ids[idx - 1] := ids[idx]; ids[idx] := swap;
  else
    if idx = array_length(ids, 1) then return; end if;
    swap := ids[idx + 1]; ids[idx + 1] := ids[idx]; ids[idx] := swap;
  end if;

  -- Rewrite the keys of everyone waiting, one microsecond apart from the earliest one. Their
  -- relative order is the new order, and nobody who joins later can fall in front of them.
  select min(w.queue_key) into base from public.event_waitlist_entries w where w.id = any(ids);
  update public.event_waitlist_entries w
     set queue_key = base + (n.ord - 1) * interval '1 microsecond',
         overridden_by = case when w.id = p_entry_id then auth.uid() else w.overridden_by end,
         overridden_at = case when w.id = p_entry_id then now() else w.overridden_at end
    from unnest(ids) with ordinality as n(id, ord)
   where w.id = n.id;

  perform public.process_waitlist(ev_id);
end;
$$;

revoke execute on function public.list_event_waitlist(uuid) from public, anon;
revoke execute on function public.move_waitlist_entry(uuid, text) from public, anon;
grant execute on function public.list_event_waitlist(uuid) to authenticated;
grant execute on function public.move_waitlist_entry(uuid, text) to authenticated;

commit;
