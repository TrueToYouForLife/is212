-- 0059_waitlist_expiry_on_read.sql — US16 follow-up to 0058 (which is applied: not edited).
--
-- Lazy expiry (0058) passes an overdue offer to the next person whenever someone touches the event.
-- A call that then RAISES an error is rolled back as a whole, including that expiry, so a quiet
-- event could keep a lapsed offer in place for as long as every touch happened to be refused.
-- Two changes close that gap without a scheduler:
--   * the two read functions an Attendee opens (the event page and My registrations) now run
--     process_waitlist first. They always succeed, so the expiry and the next offer are saved.
--   * accept_waitlist_offer answers null, instead of an error, when the offer has just lapsed,
--     for the same reason: an error would undo the expiry it had only just recorded.
-- Same signatures and result columns as 0058, so grants and callers are unchanged. Safe to re-run.
begin;

-- VOLATILE on purpose: PostgREST runs a STABLE function in a read-only transaction, where this
-- write would fail. Written in plpgsql because the expiry has to run before the query.
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
                   and (x.joined_at, x.id) < (w.joined_at, w.id))
         end,
         w.offer_expires_at
  from public.events e
  left join public.event_waitlist_entries w
    on w.event_id = e.id and w.attendee_id = auth.uid() and w.status in ('waiting', 'offered')
  where e.id = p_event_id
    and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start);
end;
$$;

-- Events are processed in id order, so two Attendees opening the page at once take the per-event
-- locks in the same order and cannot deadlock each other.
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
                   and (x.joined_at, x.id) < (w.joined_at, w.id))
         end,
         w.offer_expires_at
  from public.event_waitlist_entries w
  join public.events e on e.id = w.event_id
  where w.attendee_id = auth.uid() and w.status in ('waiting', 'offered', 'expired')
  order by e.proposed_start, w.joined_at;
end;
$$;

-- 0058's function with one change: a lapsed offer returns null rather than raising, so the expiry
-- recorded by process_waitlist is kept and the next person is offered the place.
create or replace function public.accept_waitlist_offer(
  p_entry_id uuid,
  p_phone text,
  p_dietary_requirements text,
  p_accessibility_needs text,
  p_prerequisites_confirmed boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ev_id uuid;
  prerequisites text;
  current_status text;
  phone text;
  new_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'attendee' then
    raise exception 'Only attendees can accept an offer' using errcode = '42501';
  end if;

  select w.event_id into ev_id from public.event_waitlist_entries w
   where w.id = p_entry_id and w.attendee_id = auth.uid();
  if not found then
    raise exception 'Waiting-list entry not found' using errcode = 'P0002';
  end if;

  select e.registration_prerequisites into prerequisites from public.events e
   where e.id = ev_id
     and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start)
   for share;
  if not found then
    raise exception 'Registration is not open for this event' using errcode = '22000';
  end if;

  -- May expire this very offer: the deadline is checked here, not trusted from the screen.
  perform public.process_waitlist(ev_id);

  select w.status into current_status from public.event_waitlist_entries w
   where w.id = p_entry_id for update;
  if current_status = 'expired' then
    return null;
  end if;
  if current_status <> 'offered' then
    raise exception 'This offer is no longer available' using errcode = '55000', hint = current_status;
  end if;

  phone := public.check_registration_answers(p_phone, prerequisites, p_prerequisites_confirmed);

  -- The offer already held this place, so registering stays within capacity.
  update public.event_waitlist_entries set status = 'accepted', resolved_at = now() where id = p_entry_id;
  insert into public.event_registrations
    (event_id, attendee_id, phone, dietary_requirements, accessibility_needs, prerequisites_confirmed)
  values
    (ev_id, auth.uid(), phone, nullif(btrim(p_dietary_requirements), ''),
     nullif(btrim(p_accessibility_needs), ''), coalesce(p_prerequisites_confirmed, false))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.get_open_event(uuid) from public, anon;
revoke execute on function public.list_my_waitlist() from public, anon;
revoke execute on function public.accept_waitlist_offer(uuid, text, text, text, boolean)
  from public, anon;
grant execute on function public.get_open_event(uuid) to authenticated;
grant execute on function public.list_my_waitlist() to authenticated;
grant execute on function public.accept_waitlist_offer(uuid, text, text, text, boolean)
  to authenticated;

commit;
