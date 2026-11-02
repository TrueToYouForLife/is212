-- US21 Cancel, postpone or reschedule an event (SCRUM-66), slice 2: rescheduling, and telling
-- attendees about postponements and new dates.
-- AC-021.1 (reschedule) The assigned Coordinator reschedules an event at any stage before it ends.
-- AC-021.2 (revised 1 Nov 2026, team proposal #70 / US38) A rescheduled event returns to Planning
--          with the new date; its bookings and reservations are kept but flagged for review. A
--          postponed event (US38, 0119) keeps everything until it is re-planned or rescheduled.
-- AC-021.3 (postpone, reschedule) Attendees registered or waiting for a place are told.
-- AC-021.4 They are told the new date and time.
--
-- reschedule_event() records each change in event_reschedules, moves the event to Planning
-- through the routes the status rules already have (US38's for Confirmed, as 0121 does; US45's for
-- Awaiting Safety Review and In Preparation; the Coordinator's own for Safety Changes Requested
-- and Postponed), and flags each live venue and equipment booking with US41's arrangement
-- reviews, as 0121 leaves them for a significant change. The status rules are not replaced.
-- Uses slice 1's attendee notification type (0120), so it is applied after 0120.
-- Apply after 0121. Safe to replay.
begin;

-- ---------------------------------------------------------------------------
-- AC-021.2: every reschedule is kept, with the date it replaced
-- ---------------------------------------------------------------------------
create table if not exists public.event_reschedules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  previous_status text not null,
  previous_start timestamptz,
  previous_end timestamptz,
  new_start timestamptz not null,
  new_end timestamptz not null,
  reason text,
  rescheduled_by uuid not null references public.profiles (id),
  rescheduled_at timestamptz not null default clock_timestamp(),
  constraint event_reschedules_window check (new_end > new_start)
);
create index if not exists event_reschedules_event_idx on public.event_reschedules (event_id, rescheduled_at desc);
alter table public.event_reschedules enable row level security;
revoke all on public.event_reschedules from public, anon, authenticated;

-- The reschedule can be the source of an arrangement review; widen, never narrow, as 0105 does.
alter table public.arrangement_review_flags
  add column if not exists event_reschedule_id uuid references public.event_reschedules (id) on delete cascade;
do $$ declare expression text; begin
  select pg_get_expr(conbin, conrelid) into expression from pg_constraint
   where conrelid = 'public.arrangement_review_flags'::regclass and conname = 'arrangement_review_source';
  if expression not like '%event_reschedule_id%' then
    alter table public.arrangement_review_flags drop constraint arrangement_review_source;
    execute format('alter table public.arrangement_review_flags add constraint arrangement_review_source check (%s)',
      replace(expression, 'num_nonnulls(', 'num_nonnulls(event_reschedule_id, '));
  end if;
  select pg_get_expr(conbin, conrelid) into expression from pg_constraint
   where conrelid = 'public.arrangement_review_flags'::regclass and conname = 'arrangement_review_flags_reason_code_check';
  if expression not like '%event_rescheduled%' then
    alter table public.arrangement_review_flags drop constraint arrangement_review_flags_reason_code_check;
    execute format('alter table public.arrangement_review_flags add constraint arrangement_review_flags_reason_code_check check ((%s) or reason_code = %L)',
      expression, 'event_rescheduled');
  end if;
end $$;
create unique index if not exists reschedule_flag_venue on public.arrangement_review_flags
  (event_reschedule_id, venue_booking_id) where event_reschedule_id is not null and venue_booking_id is not null;
create unique index if not exists reschedule_flag_equipment on public.arrangement_review_flags
  (event_reschedule_id, equipment_booking_id) where event_reschedule_id is not null and equipment_booking_id is not null;

-- Dates as attendees read them.
create or replace function public.us21_when(p_start timestamptz)
returns text language sql immutable set search_path = '' as $$
  select to_char(p_start at time zone 'Asia/Singapore', 'FMDD Mon YYYY, FMHH12:MI AM')
$$;

-- AC-021.3: everyone registered or still waiting for a place.
create or replace function public.us21_tell_attendees(p_event uuid, p_subject text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select attendee_id from public.event_registrations where event_id = p_event and status = 'registered'
    union
    select attendee_id from public.event_waitlist_entries where event_id = p_event and status in ('waiting', 'offered')
  loop
    perform public.send_notification(r.attendee_id, 'event_schedule_change', p_event, p_subject, p_body);
  end loop;
end $$;
revoke all on function public.us21_tell_attendees(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- AC-021.1 / AC-021.2 / AC-021.4: the Coordinator reschedules
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_event(p_event_id uuid, p_start timestamptz, p_end timestamptz, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_target text;
  v_reschedule uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_detail text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Only the event''s assigned Coordinator can reschedule it' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if e.coordinator_id is distinct from auth.uid() then
    raise exception 'Only the event''s assigned Coordinator can reschedule it' using errcode = '42501';
  end if;
  if e.status not in ('approved', 'planning', 'awaiting_safety_review', 'safety_changes_requested',
                      'in_preparation', 'confirmed', 'postponed') then
    raise exception 'Only an event being planned, prepared, confirmed or postponed can be rescheduled' using errcode = '22000';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Choose a new start and an end after it' using errcode = '22023';
  end if;
  if p_start <= now() then
    raise exception 'The new date must be in the future' using errcode = '22023';
  end if;
  if p_start = e.proposed_start and p_end = e.proposed_end then
    raise exception 'Choose a different date or time' using errcode = '22023';
  end if;

  insert into public.event_reschedules (event_id, previous_status, previous_start, previous_end, new_start, new_end, reason, rescheduled_by)
  values (e.id, e.status, e.proposed_start, e.proposed_end, p_start, p_end, v_reason, auth.uid())
  returning id into v_reschedule;

  -- Back to Planning through the routes the status rules already have; Approved and Planning stay.
  v_target := case when e.status in ('approved', 'planning') then e.status else 'planning' end;
  if e.status = 'confirmed' then
    perform set_config('app.us38_leave_confirmed', 'on', true);
  elsif e.status in ('awaiting_safety_review', 'in_preparation') then
    perform set_config('app.us45_send_back', 'on', true);
  end if;
  update public.events set proposed_start = p_start, proposed_end = p_end, status = v_target where id = e.id;
  perform set_config('app.us38_leave_confirmed', '', true);
  perform set_config('app.us45_send_back', '', true);

  -- AC-021.2: the bookings are kept, each flagged for the Coordinator to confirm or replace.
  v_detail := format('The event moved from %s to %s. Check this booking still works at the new time, or replace it.',
                     coalesce(public.us21_when(e.proposed_start), 'no date'), public.us21_when(p_start));
  insert into public.arrangement_review_flags (event_id, venue_booking_id, reason_code, detail, event_reschedule_id)
  select e.id, b.id, 'event_rescheduled', v_detail, v_reschedule
    from public.venue_bookings b
   where b.event_id = e.id
     and (b.status in ('confirmed', 'pending_approval') or (b.status = 'held' and b.hold_expires_at > now()));
  insert into public.arrangement_review_flags (event_id, equipment_booking_id, reason_code, detail, event_reschedule_id)
  select e.id, eb.id, 'event_rescheduled', v_detail, v_reschedule
    from public.equipment_bookings eb
   where eb.event_id = e.id and eb.status not in ('cancelled', 'rejected', 'completed');

  -- AC-021.3 / AC-021.4: attendees get the new date.
  perform public.us21_tell_attendees(e.id, format('Event rescheduled: %s', e.name),
    format('%s has moved to %s (it was %s). Your registration is kept; if the new time does not suit you, you can withdraw under My registrations.',
           e.name, public.us21_when(p_start), coalesce(public.us21_when(e.proposed_start), 'not yet dated')));
  return v_target;
end $$;
revoke all on function public.reschedule_event(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.reschedule_event(uuid, timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- AC-021.3 (postpone): attendees are told when an event is postponed (US38's status)
-- ---------------------------------------------------------------------------
create or replace function public.tell_attendees_of_postponement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.us21_tell_attendees(new.id, format('Event postponed: %s', new.name),
    format('%s%s has been postponed. A new date will follow; your registration is kept.',
           new.name, coalesce(' (' || public.us21_when(new.proposed_start) || ')', '')));
  return null;
end $$;
revoke all on function public.tell_attendees_of_postponement() from public, anon, authenticated;

drop trigger if exists events_tell_attendees_of_postponement on public.events;
create trigger events_tell_attendees_of_postponement
  after update of status on public.events
  for each row when (new.status = 'postponed' and old.status is distinct from 'postponed')
  execute function public.tell_attendees_of_postponement();

commit;
