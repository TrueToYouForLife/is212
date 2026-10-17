-- 0058_event_waiting_list.sql — US16 (SCRUM-21 epic): Attendees join a waiting list for a full event.
--
-- Builds on 0043 (registrations) and 0050 (withdrawal). Nothing in those files is edited; the
-- one function that must change, register_for_event, is replaced here, as 0039 replaced 0008's.
-- Capacity is events.expected_attendance and nothing else (team decision): it is already the
-- event-level requirement that venue suitability reads, so there is no second number to drift.
-- A null capacity means no limit. Safe to re-run.
--
-- Expiry is lazy (team decision): there is no scheduler. Every path that touches an event's
-- list first expires overdue offers and passes their places on (process_waitlist), and a
-- read computes "expired" from the deadline, so the screen is right even before the next write.
-- The one consequence: an offer that lapses on a quiet event is passed on the next time anyone
-- touches that event, not at the minute it lapses.
begin;

-- ---------------------------------------------------------------------------
-- The waiting list
-- ---------------------------------------------------------------------------
create table if not exists public.event_waitlist_entries (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete restrict,
  attendee_id      uuid not null references public.profiles (id) on delete cascade,
  status           text not null default 'waiting',
  -- clock_timestamp, not now(): now() is the transaction start, so two joins in one
  -- transaction would tie. The id breaks any remaining tie, so the order is always total.
  joined_at        timestamptz not null default clock_timestamp(),
  offered_at       timestamptz,
  offer_expires_at timestamptz,
  resolved_at      timestamptz,

  constraint event_waitlist_status_valid
    check (status in ('waiting', 'offered', 'accepted', 'expired', 'left')),
  constraint event_waitlist_offer_fields_paired
    check ((offered_at is null) = (offer_expires_at is null)),
  constraint event_waitlist_offer_after_offer
    check (offer_expires_at is null or offer_expires_at > offered_at),
  -- Waiting people have never been offered; offered, accepted and expired always were.
  constraint event_waitlist_status_matches_offer check (
    (status = 'waiting' and offered_at is null)
    or (status in ('offered', 'accepted', 'expired') and offered_at is not null)
    or status = 'left'
  ),
  constraint event_waitlist_resolved_matches_status
    check ((status in ('waiting', 'offered')) = (resolved_at is null))
);

-- AC-016.5 as a constraint: one active entry per attendee and event, whatever races.
create unique index if not exists event_waitlist_one_active
  on public.event_waitlist_entries (event_id, attendee_id)
  where status in ('waiting', 'offered');

-- AC-016.2: the queue order, read by every offer.
create index if not exists event_waitlist_queue
  on public.event_waitlist_entries (event_id, joined_at, id)
  where status = 'waiting';

alter table public.event_waitlist_entries enable row level security;
revoke all on public.event_waitlist_entries from public, anon, authenticated;
grant select on public.event_waitlist_entries to authenticated;

-- Writes only through the functions below, which run as the owner.
drop policy if exists event_waitlist_select_own on public.event_waitlist_entries;
create policy event_waitlist_select_own on public.event_waitlist_entries
  for select to authenticated
  using (attendee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shared helpers (not APIs)
-- ---------------------------------------------------------------------------
-- One advisory lock per event serialises every list path. A row lock would not do: two
-- withdrawals each hold a shared lock on the event and would deadlock upgrading it.
-- Lock order everywhere: registration or entry row, then event row, then this lock.
create or replace function public.waitlist_lock(p_event_id uuid)
returns void language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('event_waitlist:' || p_event_id::text, 0));
$$;

-- Places not taken by a registration or by an unexpired offer. An overdue offer no longer holds
-- one, so reads are right even before process_waitlist has run. No limit reads as a huge number.
create or replace function public.waitlist_places_left(p_event_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(greatest(
    e.expected_attendance
      - (select count(*) from public.event_registrations r
          where r.event_id = e.id and r.status = 'registered')
      - (select count(*) from public.event_waitlist_entries w
          where w.event_id = e.id and w.status = 'offered' and w.offer_expires_at > now()),
    0), 2147483647)::integer
  from public.events e
  where e.id = p_event_id;
$$;

-- "Full" for an Attendee: no place left, or people already queued (they come first, AC-016.2).
create or replace function public.waitlist_event_is_full(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.waitlist_places_left(p_event_id) <= 0
      or exists (select 1 from public.event_waitlist_entries w
                  where w.event_id = p_event_id and w.status = 'waiting');
$$;

-- The same answer checks register_for_event always made (0043), written once so registering and
-- accepting an offer cannot disagree. Returns the cleaned phone number.
create or replace function public.check_registration_answers(
  p_phone text, p_prerequisites text, p_confirmed boolean)
returns text language plpgsql immutable set search_path = '' as $$
declare
  phone text := btrim(coalesce(p_phone, ''));
begin
  if phone = '' then
    raise exception 'Enter a phone number.' using errcode = '22023';
  end if;
  if regexp_replace(phone, '[[:space:]-]', '', 'g') !~ '^\+?[0-9]{8,15}$' then
    raise exception 'Enter a phone number of 8 to 15 digits.' using errcode = '22023';
  end if;
  if nullif(btrim(p_prerequisites), '') is not null and not coalesce(p_confirmed, false) then
    raise exception 'Confirm that you meet the prerequisites.' using errcode = '22023';
  end if;
  return phone;
end;
$$;

-- Expire overdue offers, then offer free places to the people waiting longest (AC-016.3,
-- AC-016.4). Called by every path below and by the triggers; safe to call at any time.
-- No new offers once registration is closed (SCRUM-155), and none in the last 24 hours before
-- the start: a team proposal for Thread 116, there being no fixed rule. An offer never outlives
-- the event: it expires after 3 days or at the start, whichever is sooner.
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
                 order by w.joined_at, w.id
                 limit places);
end;
$$;

revoke execute on function public.waitlist_lock(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_places_left(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_event_is_full(uuid) from public, anon, authenticated;
revoke execute on function public.check_registration_answers(text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.process_waitlist(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registering now respects capacity (AC-016.1) and the queue (AC-016.2)
-- ---------------------------------------------------------------------------
-- Replaces 0043's function. Same signature and the same errors as before, plus:
--   53000 the event is full or has a queue: join the waiting list instead
--   23505 with hint already_waitlisted: the caller is already in line for this event.
create or replace function public.register_for_event(
  p_event_id uuid,
  p_phone text,
  p_dietary_requirements text,
  p_accessibility_needs text,
  p_prerequisites_confirmed boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  prerequisites text;
  phone text;
  new_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'attendee' then
    raise exception 'Only attendees can register for events' using errcode = '42501';
  end if;

  -- FOR SHARE: the event cannot be closed, cancelled or have registration switched off
  -- between this check and the insert below.
  select e.registration_prerequisites into prerequisites
  from public.events e
  where e.id = p_event_id
    and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start)
  for share;

  if not found then
    raise exception 'Registration is not open for this event' using errcode = '22000';
  end if;

  -- Expires overdue offers and takes the event's lock, so the count below cannot change under us.
  perform public.process_waitlist(p_event_id);

  if exists (select 1 from public.event_waitlist_entries w
              where w.event_id = p_event_id and w.attendee_id = auth.uid()
                and w.status in ('waiting', 'offered')) then
    raise exception 'You are already on the waiting list for this event'
      using errcode = '23505', hint = 'already_waitlisted';
  end if;

  if public.waitlist_event_is_full(p_event_id) then
    raise exception 'This event is full' using errcode = '53000';
  end if;

  phone := public.check_registration_answers(p_phone, prerequisites, p_prerequisites_confirmed);

  -- A second active registration fails here with 23505 (event_registrations_one_active).
  insert into public.event_registrations
    (event_id, attendee_id, phone, dietary_requirements, accessibility_needs, prerequisites_confirmed)
  values
    (p_event_id, auth.uid(), phone, nullif(btrim(p_dietary_requirements), ''),
     nullif(btrim(p_accessibility_needs), ''), coalesce(p_prerequisites_confirmed, false))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.register_for_event(uuid, text, text, text, boolean)
  from public, anon;
grant execute on function public.register_for_event(uuid, text, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Joining, leaving and accepting (AC-016.1, .3, .5)
-- ---------------------------------------------------------------------------
-- Error codes: 42501 not an Attendee · 22000 registration is not open · 55000 wrong state
-- (the event still has places, or the entry is not in the state the call needs; hint says which) ·
-- 23505 already registered / already waitlisted (hint) · P0002 no such entry (or not yours) ·
-- 22023 invalid answers.
create or replace function public.join_waitlist(p_event_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'attendee' then
    raise exception 'Only attendees can join a waiting list' using errcode = '42501';
  end if;

  perform 1 from public.events e
   where e.id = p_event_id
     and public.event_is_open_for_registration(e.status, e.registration_required, e.proposed_start)
   for share;
  if not found then
    raise exception 'Registration is not open for this event' using errcode = '22000';
  end if;

  perform public.process_waitlist(p_event_id);

  if exists (select 1 from public.event_registrations r
              where r.event_id = p_event_id and r.attendee_id = auth.uid() and r.status = 'registered') then
    raise exception 'You are already registered for this event'
      using errcode = '23505', hint = 'already_registered';
  end if;
  if exists (select 1 from public.event_waitlist_entries w
              where w.event_id = p_event_id and w.attendee_id = auth.uid()
                and w.status in ('waiting', 'offered')) then
    raise exception 'You are already on the waiting list for this event'
      using errcode = '23505', hint = 'already_waitlisted';
  end if;

  -- AC-016.1: the list is for a full event only.
  if not public.waitlist_event_is_full(p_event_id) then
    raise exception 'This event still has places; register instead'
      using errcode = '55000', hint = 'not_full';
  end if;

  insert into public.event_waitlist_entries (event_id, attendee_id)
  values (p_event_id, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.leave_waitlist(p_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ev_id uuid;
  current_status text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'attendee' then
    raise exception 'Only attendees can leave a waiting list' using errcode = '42501';
  end if;

  select w.event_id into ev_id from public.event_waitlist_entries w
   where w.id = p_entry_id and w.attendee_id = auth.uid();
  if not found then
    raise exception 'Waiting-list entry not found' using errcode = 'P0002';
  end if;

  perform public.waitlist_lock(ev_id);
  select w.status into current_status from public.event_waitlist_entries w
   where w.id = p_entry_id for update;
  if current_status not in ('waiting', 'offered') then
    raise exception 'You are no longer on this waiting list'
      using errcode = '55000', hint = current_status;
  end if;

  update public.event_waitlist_entries set status = 'left', resolved_at = now() where id = p_entry_id;
  -- A held place is free again: offer it to the next person.
  perform public.process_waitlist(ev_id);
end;
$$;

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

revoke execute on function public.join_waitlist(uuid) from public, anon;
revoke execute on function public.leave_waitlist(uuid) from public, anon;
revoke execute on function public.accept_waitlist_offer(uuid, text, text, text, boolean)
  from public, anon;
grant execute on function public.join_waitlist(uuid) to authenticated;
grant execute on function public.leave_waitlist(uuid) to authenticated;
grant execute on function public.accept_waitlist_offer(uuid, text, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- What the Attendee reads
-- ---------------------------------------------------------------------------
-- get_open_event gains the waiting-list columns, so it is dropped and recreated (a function's
-- result columns cannot change in place). Every 0043 column keeps its name and meaning.
drop function if exists public.get_open_event(uuid);
create function public.get_open_event(p_event_id uuid)
returns table (
  id uuid, name text, event_type text, description text, programme text,
  proposed_start timestamptz, proposed_end timestamptz, prerequisites text, venue text,
  registered boolean, full boolean, waitlist_entry_id uuid, waitlist_status text,
  waitlist_position integer, offer_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.event_type, e.description, e.programme,
         e.proposed_start, e.proposed_end, e.registration_prerequisites,
         public.event_venue_label(e.id),
         exists (select 1 from public.event_registrations r
                  where r.event_id = e.id and r.attendee_id = auth.uid()
                    and r.status = 'registered'),
         public.waitlist_event_is_full(e.id),
         w.id,
         -- An overdue offer reads as expired at once; the row itself changes on the next write.
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
$$;

revoke execute on function public.get_open_event(uuid) from public, anon;
grant execute on function public.get_open_event(uuid) to authenticated;

-- The caller's own waiting lists, including offers that have just lapsed so they can see why.
create or replace function public.list_my_waitlist()
returns table (
  entry_id uuid, event_id uuid, event_name text, proposed_start timestamptz, venue text,
  status text, queue_position integer, offer_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.list_my_waitlist() from public, anon;
grant execute on function public.list_my_waitlist() to authenticated;

-- ---------------------------------------------------------------------------
-- A place opens (AC-016.3): withdrawal, a bigger event, registration switched back on
-- ---------------------------------------------------------------------------
-- Triggers rather than code in withdraw_registration (0050, untouched): any future way of
-- freeing a place gets the same behaviour, in the same transaction.
create or replace function public.waitlist_on_registration_withdrawn()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.process_waitlist(new.event_id);
  return new;
end;
$$;

drop trigger if exists event_registrations_process_waitlist on public.event_registrations;
create trigger event_registrations_process_waitlist
  after update on public.event_registrations
  for each row
  when (old.status = 'registered' and new.status = 'withdrawn')
  execute function public.waitlist_on_registration_withdrawn();

create or replace function public.waitlist_on_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.process_waitlist(new.id);
  return new;
end;
$$;

drop trigger if exists events_process_waitlist on public.events;
create trigger events_process_waitlist
  after update of expected_attendance, registration_required on public.events
  for each row
  when (new.expected_attendance is distinct from old.expected_attendance
        or new.registration_required is distinct from old.registration_required)
  execute function public.waitlist_on_event_change();

revoke execute on function public.waitlist_on_registration_withdrawn()
  from public, anon, authenticated;
revoke execute on function public.waitlist_on_event_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications on every status change that matters to the Attendee
-- ---------------------------------------------------------------------------
-- Same mechanism as 0043/0050: a notification_outbox row in the same transaction, sent by the
-- existing send-review-notifications function. If it cannot be queued, the change rolls back.
create or replace function public.queue_waitlist_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient text;
  event_name text;
  event_start timestamptz;
  subject text;
  body text;
  deadline text;
begin
  if tg_op = 'INSERT' then
    subject := 'You are on the waiting list for ';
  elsif old.status = 'waiting' and new.status = 'offered' then
    subject := 'A place is available for ';
  elsif old.status = 'offered' and new.status = 'expired' then
    subject := 'Your offer has expired for ';
  else
    return new;
  end if;

  select u.email into recipient from auth.users u where u.id = new.attendee_id;
  if recipient is null then return new; end if;
  select e.name, e.proposed_start into event_name, event_start
  from public.events e where e.id = new.event_id;
  subject := subject || coalesce(event_name, 'your event');

  if new.status = 'waiting' then
    body := 'You are on the waiting list for ' || coalesce(event_name, 'your event') || '.' || E'\n\n'
      || 'If a place becomes available we will email you. You will then have 3 days to accept it.';
  elsif new.status = 'offered' then
    -- Singapore time explicitly: the server's time zone is not the Attendee's.
    deadline := to_char(new.offer_expires_at at time zone 'Asia/Singapore', 'FMDD Mon YYYY, HH24:MI');
    body := 'A place is available for ' || coalesce(event_name, 'your event') || '.' || E'\n\n'
      || 'Accept it under My registrations before ' || deadline || ' (Singapore time), '
      || 'or it will pass to the next person on the waiting list.';
  else
    body := 'The place offered to you for ' || coalesce(event_name, 'your event')
      || ' was not accepted in time and has passed to the next person on the waiting list.' || E'\n\n'
      || 'You can join the waiting list again if the event is still full.';
  end if;

  insert into public.notification_outbox (event_id, recipient_email, subject, body)
  values (new.event_id, recipient, subject, body);
  return new;
end;
$$;

revoke execute on function public.queue_waitlist_notification() from public, anon, authenticated;

drop trigger if exists event_waitlist_queue_notification on public.event_waitlist_entries;
create trigger event_waitlist_queue_notification
  after insert or update on public.event_waitlist_entries
  for each row execute function public.queue_waitlist_notification();

commit;
