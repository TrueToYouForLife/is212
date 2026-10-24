-- US43 Operational safety review (SCRUM-239), slice 1: sending an event for its safety review.
-- Week 7 change 6. Team decision: an event is confirmed only after the Safety Officer approves it.
-- AC-043.1 (as revised, see docs/test-cases/US43_test_cases.md) the Coordinator sends an event for
-- its safety review once every arrangement on its readiness card (US5) is complete, and the
-- system refuses until then. AC-043.2 that moves it to Awaiting Safety Review and notifies the
-- Safety Officers (US33 helper). AC-043.3 while awaiting review it cannot move to In Preparation
-- or Confirmed; only a Safety Officer decides the review (US44).
-- Apply after 0106. Safe to replay.
--
-- approved -> planning -> awaiting_safety_review -> in_preparation -> confirmed -> completed
--                                |        ^
--                                v        |
--                      safety_changes_requested
-- Any status before completed can still be cancelled; submitted and under_review can still be
-- withdrawn (US22). Planning -> Confirmed is no longer possible.
begin;

-- ---------------------------------------------------------------------------
-- The Safety Officer role (Week 7 change 6)
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_valid;
alter table public.profiles add constraint profiles_role_valid check (
  role in ('organiser', 'coordinator', 'coordinator_lead', 'operations_manager',
           'venue_staff', 'tech_support', 'safety_officer', 'attendee')
);

-- ---------------------------------------------------------------------------
-- The safety review statuses
-- ---------------------------------------------------------------------------
alter table public.events drop constraint if exists events_status_valid;
alter table public.events add constraint events_status_valid check (
  status in ('draft', 'submitted', 'under_review', 'approved', 'planning',
             'awaiting_safety_review', 'safety_changes_requested', 'in_preparation',
             'confirmed', 'completed', 'cancelled', 'rejected', 'withdrawn')
);

-- 0066's rule (with US22's withdrawal) and the safety stages in the middle. The frontend
-- mirror is statusRules.ts.
create or replace function public.is_valid_status_transition(old_status text, new_status text)
returns boolean
language sql
immutable
as $$
  select case old_status
    when 'draft'      then new_status in ('submitted', 'cancelled')
    when 'submitted'  then new_status in ('under_review', 'cancelled', 'withdrawn')
    -- under_review can return to submitted: a coordinator asking the organiser for more
    -- detail is a normal outcome of review, not a rejection.
    when 'under_review' then new_status in ('approved', 'rejected', 'submitted',
                                            'cancelled', 'withdrawn')
    when 'approved'   then new_status in ('planning', 'cancelled')
    when 'planning'   then new_status in ('awaiting_safety_review', 'cancelled')
    when 'awaiting_safety_review' then new_status in ('in_preparation', 'safety_changes_requested', 'cancelled')
    when 'safety_changes_requested' then new_status in ('awaiting_safety_review', 'cancelled')
    when 'in_preparation' then new_status in ('confirmed', 'cancelled')
    when 'confirmed'  then new_status in ('completed', 'cancelled')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- AC-043.1: one readiness rule for the card (US5) and for the safety review
-- ---------------------------------------------------------------------------
-- 0076's readiness lines, readable by the database itself, plus the safety review's own line.
create or replace function public.event_readiness_lines(p_event_id uuid)
returns table (arrangement text, label text, complete boolean, detail text, sort_order integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  e                  public.events;
  v_confirmed        integer;
  v_waiting          integer;
  v_held             integer;
  v_requirements     integer;
  v_essential        integer;
  v_essential_ready  integer;
  v_unavailable      integer;
  v_pending_review   integer;
begin
  select * into e from public.events where id = p_event_id;
  if not found then
    return;
  end if;

  -- Venue booking: every live booking approved, and at least one. Rejected, cancelled and
  -- expired bookings no longer count either way.
  select count(*) filter (where b.status = 'confirmed'),
         count(*) filter (where b.status = 'pending_approval'),
         count(*) filter (where b.status = 'held' and b.hold_expires_at > now())
    into v_confirmed, v_waiting, v_held
  from public.venue_bookings b where b.event_id = e.id;

  arrangement := 'venue_booking';
  label := 'Venue booking';
  complete := v_confirmed > 0 and v_waiting = 0 and v_held = 0;
  detail := case
    when v_confirmed + v_waiting + v_held = 0 then 'No venue booked yet.'
    when complete then format('%s approved.', case when v_confirmed = 1 then '1 venue booking' else v_confirmed || ' venue bookings' end)
    else concat_ws(' ',
      case when v_waiting > 0 then format('%s awaiting Venue Staff.', case when v_waiting = 1 then '1 booking' else v_waiting || ' bookings' end) end,
      case when v_held > 0 then format('%s held, not yet requested.', case when v_held = 1 then '1 booking' else v_held || ' bookings' end) end,
      case when v_confirmed > 0 then format('%s approved.', v_confirmed) end)
  end;
  sort_order := 1;
  return next;

  -- Equipment, only for an event that has equipment requirements (AC-005.8).
  select count(*),
         count(*) filter (where r.essential),
         count(*) filter (where r.essential and r.status = 'reserved'),
         count(*) filter (where r.essential and r.status = 'unavailable'),
         count(*) filter (where r.status = 'pending_review')
    into v_requirements, v_essential, v_essential_ready, v_unavailable, v_pending_review
  from public.event_equipment_requirements r where r.event_id = e.id;

  if v_requirements > 0 then
    arrangement := 'equipment_reservation';
    label := 'Equipment reservation';
    complete := v_essential_ready = v_essential;
    detail := case
      when v_essential = 0 then 'No essential equipment needed.'
      else concat_ws(' ',
        format('%s of %s essential %s reserved.', v_essential_ready, v_essential, case when v_essential = 1 then 'item' else 'items' end),
        case when v_unavailable > 0 then format('%s unavailable.', v_unavailable) end)
    end;
    sort_order := 2;
    return next;

    -- Nobody is assigned to an event as its Technical Support; what the app records is
    -- Technical Support reviewing each equipment request (US13).
    arrangement := 'technical_support';
    label := 'Technical support';
    complete := v_pending_review = 0;
    detail := case
      when complete then 'Technical Support has reviewed every equipment request.'
      else format('%s awaiting Technical Support.',
                  case when v_pending_review = 1 then '1 equipment request' else v_pending_review || ' equipment requests' end)
    end;
    sort_order := 3;
    return next;
  end if;

  arrangement := 'programme';
  label := 'Programme';
  complete := nullif(btrim(coalesce(e.programme, '')), '') is not null;
  detail := case when complete then 'Programme added.' else 'No programme yet.' end;
  sort_order := 4;
  return next;

  -- Registration, only for an event that takes registrations (AC-005.8). Attendees can
  -- register once the event is Confirmed (US15, US52).
  if e.registration_required then
    arrangement := 'registration_setup';
    label := 'Registration setup';
    complete := e.status = 'confirmed';
    detail := case
      when complete then 'Registration is open to Attendees.'
      else 'Registration opens to Attendees once the event is confirmed.'
    end;
    sort_order := 5;
    return next;
  end if;

  -- US43: the safety review, the last step before the event can be confirmed.
  if e.status in ('planning', 'awaiting_safety_review', 'safety_changes_requested', 'in_preparation',
                  'confirmed', 'completed') then
    arrangement := 'safety_review';
    label := 'Safety review';
    complete := e.status in ('in_preparation', 'confirmed', 'completed');
    detail := case e.status
      when 'planning' then 'Send it to the Safety Officer once everything above is complete.'
      when 'awaiting_safety_review' then 'With the Safety Officer for review.'
      when 'safety_changes_requested' then 'The Safety Officer has asked for changes.'
      else 'Approved by the Safety Officer.'
    end;
    sort_order := 6;
    return next;
  end if;
end $$;
revoke all on function public.event_readiness_lines(uuid) from public, anon, authenticated;

-- 0076's function, now a thin wrapper: the event's assigned Coordinator only (AC-005.4).
create or replace function public.get_event_readiness(p_event_id uuid)
returns table (arrangement text, label text, complete boolean, detail text, sort_order integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see an event''s readiness' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  -- AC-005.4: the event's own Coordinator only.
  if public.current_user_role() is distinct from 'coordinator' or e.coordinator_id is distinct from auth.uid() then
    raise exception 'Only the event''s assigned Coordinator can see its readiness' using errcode = '42501';
  end if;

  return query select * from public.event_readiness_lines(p_event_id);
end $$;
revoke all on function public.get_event_readiness(uuid) from public, anon;
grant execute on function public.get_event_readiness(uuid) to authenticated;

-- Ready for the Safety Officer: every readiness line is complete, except registration setup
-- (registration only opens once the event is confirmed) and the safety review itself.
create or replace function public.event_ready_for_safety_review(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_readiness_lines(p_event))
     and not exists (select 1 from public.event_readiness_lines(p_event) l
                     where l.arrangement not in ('registration_setup', 'safety_review') and not l.complete);
$$;
revoke all on function public.event_ready_for_safety_review(uuid) from public, anon, authenticated;

-- Who sent the event for review, and when (US44 and US45 build on this).
alter table public.events
  add column if not exists safety_review_requested_at timestamptz,
  add column if not exists safety_review_requested_by uuid references public.profiles (id);

-- AC-043.1: the Coordinator's "Send for safety review".
create or replace function public.send_for_safety_review(p_event_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if auth.uid() is null then
    raise exception 'Sign in to send an event for safety review' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if public.current_user_role() is distinct from 'coordinator' or e.coordinator_id is distinct from auth.uid() then
    raise exception 'Only the event''s assigned Coordinator can send it for safety review' using errcode = '42501';
  end if;
  if e.status <> 'planning' then
    raise exception 'Only an event in Planning can be sent for safety review' using errcode = '22000';
  end if;
  if not public.event_ready_for_safety_review(e.id) then
    raise exception 'This event is not ready for its safety review: every arrangement on its readiness card must be complete'
      using errcode = '55000';
  end if;
  update public.events
     set status = 'awaiting_safety_review', safety_review_requested_at = now(), safety_review_requested_by = auth.uid()
   where id = e.id;
  return 'awaiting_safety_review';
end $$;
revoke all on function public.send_for_safety_review(uuid) from public, anon;
grant execute on function public.send_for_safety_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- AC-043.1, AC-043.3: who may move an event through the safety stages
-- ---------------------------------------------------------------------------
-- 0006's trigger with the safety stages added before its role rules. Everything else is
-- unchanged: a Coordinator still confirms (now from In Preparation), resubmits after changes
-- (US45), cancels and withdraws.
create or replace function public.enforce_event_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- No JWT means the SQL editor or a service key: an administrator fixing data, which we
  -- do not stand in the way of.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_valid_status_transition(old.status, new.status) then
    raise exception 'An event cannot move from % to %', old.status, new.status
      using errcode = '22000';
  end if;

  -- AC-043.1: only the Coordinator sends an event for review, and only once every arrangement
  -- on its readiness card is complete (send_for_safety_review() is the way in).
  if old.status = 'planning' and new.status = 'awaiting_safety_review' then
    if public.current_user_role() is distinct from 'coordinator' then
      raise exception 'Only the event''s Coordinator can send it for safety review'
        using errcode = '42501';
    end if;
    if not public.event_ready_for_safety_review(new.id) then
      raise exception 'This event is not ready for its safety review: every arrangement on its readiness card must be complete'
        using errcode = '55000';
    end if;
    return new;
  end if;

  actor_role := public.current_user_role();

  if old.status = 'awaiting_safety_review' and new.status in ('in_preparation', 'safety_changes_requested') then
    if actor_role is distinct from 'safety_officer' then
      raise exception 'Only a Safety Officer can decide an event''s safety review'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if actor_role = 'coordinator' then
    -- A coordinator reviews, but does not file requests on an organiser's behalf.
    if new.status = 'submitted' and old.status = 'draft' then
      raise exception 'Only the organiser may submit their own request'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if actor_role = 'organiser' and old.organiser_id = auth.uid() then
    -- The organiser submits and may withdraw. Approval is not theirs to grant, which is
    -- the whole point of having a review step.
    if new.status not in ('submitted', 'cancelled') then
      raise exception 'An organiser cannot move their own request to %', new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'You are not permitted to change the status of this event'
    using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------
-- AC-043.2: the Safety Officers are notified
-- ---------------------------------------------------------------------------
insert into public.notification_types (code, label, description, roles, delivered_in_app, delivered_by_email, sort_order)
values ('safety_review_request', 'Events awaiting safety review',
        'When an event is ready for its Operational Safety Check.', '{safety_officer}', true, true, 120)
on conflict (code) do update set
  label = excluded.label, description = excluded.description, roles = excluded.roles,
  delivered_in_app = excluded.delivered_in_app, delivered_by_email = excluded.delivered_by_email,
  sort_order = excluded.sort_order;

-- Each time an event enters review, first or again (US45), every Safety Officer is told through
-- the US33 helper, in the app and/or by email as each has chosen.
create or replace function public.notify_safety_officers_of_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  officer record;
begin
  for officer in select p.id from public.profiles p where p.role = 'safety_officer' loop
    perform public.send_notification(officer.id, 'safety_review_request', new.id,
      format('Safety review needed: %s', coalesce(new.reference, new.name)),
      format('%s%s is ready for its Operational Safety Check. Expected attendance: %s. Its venue and equipment arrangements are confirmed.',
             coalesce(new.reference || ' ', ''), new.name, coalesce(new.expected_attendance::text, 'not given')));
  end loop;
  return null;
end $$;
revoke all on function public.notify_safety_officers_of_review() from public, anon, authenticated;

drop trigger if exists events_notify_safety_officers on public.events;
create trigger events_notify_safety_officers
  after update of status on public.events
  for each row when (new.status = 'awaiting_safety_review' and old.status is distinct from 'awaiting_safety_review')
  execute function public.notify_safety_officers_of_review();

-- ---------------------------------------------------------------------------
-- Week 7 change 5: the safety stages are still active events in the Lead's workload counts
-- ---------------------------------------------------------------------------
-- 0041's function with the new statuses in its active list; nothing else changes.
create or replace function public.list_assignment_coordinators()
returns table (coordinator_id uuid, full_name text, active_event_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator_lead' then
    raise exception 'Only a Coordinator Lead may list assignment options' using errcode = '42501';
  end if;

  -- Do not broaden profiles RLS: expose only the coordinator identity and workload.
  -- Counts guide selection; they neither impose a limit nor reserve capacity.
  return query
    select p.id, p.full_name, count(e.id)
    from public.profiles p
    left join public.events e on e.coordinator_id = p.id
      and e.status in ('submitted', 'under_review', 'approved', 'planning',
                       'awaiting_safety_review', 'safety_changes_requested', 'in_preparation', 'confirmed')
    where p.role = 'coordinator'
    group by p.id, p.full_name
    order by lower(p.full_name), p.id;
end $$;

revoke all on function public.list_assignment_coordinators() from public, anon, authenticated;
grant execute on function public.list_assignment_coordinators() to authenticated;

commit;
