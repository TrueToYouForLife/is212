-- US45 Revise arrangements after a safety review (SCRUM-240). Week 7 change 6.
-- AC-045.1 The Coordinator sees the decision, comments and arrangements named (US44's panel; tested).
-- AC-045.2 The named venue and equipment arrangements are flagged "Needs review".
-- AC-045.3 Changes go through the normal approval flows again (Venue Staff, Technical Support).
-- AC-045.4 Once every flag is resolved, the Coordinator resubmits: back to Awaiting Safety Review.
-- AC-045.5 Earlier safety reviews stay viewable (US44's history; tested).
-- AC-045.6 A change after safety approval needs a new safety review before confirming.
--
-- PO decisions (docs/test-cases/US45_test_cases.md):
-- 1. "Revise arrangements" moves a Safety Changes Requested event back to Planning ("the event
--    returns to the relevant earlier planning stage"), where every booking and equipment flow
--    already works; it is sent for review again with the existing "Send for safety review". The
--    unchecked Safety Changes Requested -> Awaiting Safety Review route is removed.
-- 2. The named arrangements are flagged with US41's arrangement review flags, sourced from the
--    Safety Officer's decision; while any review flag is open the readiness card shows
--    "Arrangements needing review", which holds back sending (and confirming).
-- 3. A new review flag (US41's, or a venue block or retirement) on an event Awaiting Safety Review
--    or In Preparation sends it back to Planning, and its Coordinator is told it needs a new review.
-- Everything here only matters once the safety review is switched on (0108).
--
-- Rebuilt from the latest of each shared function: is_valid_status_transition() and
-- event_readiness_lines() from 0108; enforce_event_status_transition() from 0117 (which carries
-- 0115's and 0096's changes and US26's check). Anything that replaces these again must carry 0118.
-- Apply after 0117. Safe to replay.
begin;

-- ---------------------------------------------------------------------------
-- AC-045.2: the Safety Officer's decision can be the source of an arrangement review
-- ---------------------------------------------------------------------------
alter table public.arrangement_review_flags
  add column if not exists safety_review_decision_id uuid references public.safety_review_decisions (id);
-- Widen, never narrow, as 0105 does: keep every source and reason other stories have added.
do $$ declare expression text; begin
  select pg_get_expr(conbin, conrelid) into expression from pg_constraint
   where conrelid = 'public.arrangement_review_flags'::regclass and conname = 'arrangement_review_source';
  if expression not like '%safety_review_decision_id%' then
    alter table public.arrangement_review_flags drop constraint arrangement_review_source;
    execute format('alter table public.arrangement_review_flags add constraint arrangement_review_source check (%s)',
      replace(expression, 'num_nonnulls(', 'num_nonnulls(safety_review_decision_id, '));
  end if;
  select pg_get_expr(conbin, conrelid) into expression from pg_constraint
   where conrelid = 'public.arrangement_review_flags'::regclass and conname = 'arrangement_review_flags_reason_code_check';
  if expression not like '%safety_review%' then
    alter table public.arrangement_review_flags drop constraint arrangement_review_flags_reason_code_check;
    execute format('alter table public.arrangement_review_flags add constraint arrangement_review_flags_reason_code_check check ((%s) or reason_code = %L)',
      expression, 'safety_review');
  end if;
end $$;
create unique index if not exists safety_review_flag_venue on public.arrangement_review_flags
  (safety_review_decision_id, venue_booking_id) where safety_review_decision_id is not null and venue_booking_id is not null;
create unique index if not exists safety_review_flag_equipment on public.arrangement_review_flags
  (safety_review_decision_id, equipment_booking_id) where safety_review_decision_id is not null and equipment_booking_id is not null;

-- ---------------------------------------------------------------------------
-- Status rules: 0108's list and 0117's trigger, with US45's routes
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_status_transition(old_status text, new_status text)
returns boolean
language sql
stable
as $$
  select case old_status
    when 'draft'      then new_status in ('submitted', 'cancelled')
    when 'submitted'  then new_status in ('under_review', 'cancelled', 'withdrawn')
    -- under_review can return to submitted: a coordinator asking the organiser for more
    -- detail is a normal outcome of review, not a rejection.
    when 'under_review' then new_status in ('approved', 'rejected', 'submitted',
                                            'cancelled', 'withdrawn')
    when 'approved'   then new_status in ('planning', 'cancelled')
    -- Switched off: Confirmed straight from Planning, as before. Switched on: review first.
    when 'planning'   then new_status in (case when public.safety_review_enabled()
                                               then 'awaiting_safety_review' else 'confirmed' end,
                                          'cancelled')
    -- US45: Awaiting or In Preparation go back to Planning when an arrangement changes (system only).
    when 'awaiting_safety_review' then new_status in ('in_preparation', 'safety_changes_requested', 'planning', 'cancelled')
    -- US45: the Coordinator revises in Planning and sends the event for review again from there.
    when 'safety_changes_requested' then new_status in ('planning', 'cancelled')
    when 'in_preparation' then new_status in ('confirmed', 'planning', 'cancelled')
    when 'confirmed'  then new_status in ('completed', 'cancelled')
    else false
  end;
$$;

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

  -- AC-026.1 (US26, 0117): an event is confirmed only once every essential arrangement on its
  -- readiness card is complete, from Planning (safety review switched off) or In Preparation
  -- (switched on).
  if new.status = 'confirmed' and not public.event_ready_to_confirm(new.id) then
    raise exception 'This event is not ready to be confirmed: every essential arrangement on its readiness card must be complete'
      using errcode = '55000';
  end if;

  -- US45 (0118): Awaiting Safety Review or In Preparation go back to Planning only when one of the
  -- event's arrangements changes (us45_send_back_to_planning() marks that case); nobody moves an
  -- event back by hand. The Coordinator revises a Safety Changes Requested event in Planning.
  if new.status = 'planning' and old.status in ('awaiting_safety_review', 'in_preparation') then
    if coalesce(current_setting('app.us45_send_back', true), '') <> 'on' then
      raise exception 'An event goes back to Planning only when one of its arrangements changes'
        using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status = 'safety_changes_requested' and new.status = 'planning' then
    if public.current_user_role() is distinct from 'coordinator' then
      raise exception 'Only the event''s Coordinator can revise its arrangements' using errcode = '42501';
    end if;
    return new;
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
    -- US37 AC-037.2 (from 0096): a returned request goes back under review when its owner
    -- answers it. Stated as a fact about the data rather than about the caller — the answer
    -- must already be recorded against this exact version of the request.
    -- respond_to_clarification writes that row and makes the move in the next statement;
    -- the browser cannot write it at all, and updated_at moving on means one recorded
    -- answer authorises exactly one transition.
    if old.status = 'submitted' and new.status = 'under_review'
       and exists (
         select 1 from public.event_clarification_responses r
          where r.event_id = old.id
            and r.responded_by = auth.uid()
            and r.answered_updated_at = old.updated_at
       ) then
      return new;
    end if;
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
-- AC-045.4: the readiness card (and so sending and confirming) waits for open reviews
-- ---------------------------------------------------------------------------
create or replace function public.event_readiness_lines(p_event_id uuid)
returns table (arrangement text, label text, complete boolean, detail text, sort_order integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_open_reviews     integer;
  e                  public.events;
  v_confirmed        integer;
  v_rejected         integer;
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

  -- Every live booking is required. Rejected requirements remain outstanding.
  -- Cancelled/expired attempts remain visible history but do not count as live requirements.
  select count(*) filter (where b.status = 'rejected'),
         count(*) filter (where b.status = 'confirmed'),
         count(*) filter (where b.status = 'pending_approval'),
         count(*) filter (where b.status = 'held' and b.hold_expires_at > now())
    into v_rejected, v_confirmed, v_waiting, v_held
  from public.venue_bookings b where b.event_id = e.id;

  arrangement := 'venue_booking';
  label := 'Venue booking';
  complete := v_confirmed > 0 and v_waiting = 0 and v_held = 0 and v_rejected = 0;
  detail := case
    when v_confirmed + v_waiting + v_held + v_rejected = 0 then 'No venue booked yet.'
    when complete then format('%s approved.', case when v_confirmed = 1 then '1 venue booking' else v_confirmed || ' venue bookings' end)
    else concat_ws(' ',
      case when v_rejected > 0 then format('%s rejected; venue requirements remain outstanding.', v_rejected) end,
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

  -- US45 (0118): arrangements still needing review (US41's flags, including the Safety Officer's,
  -- and venue blocks or retirements), once the safety review is switched on. Open flags hold back
  -- both sending for review and confirming.
  if public.safety_review_enabled() then
    select (select count(*) from public.arrangement_review_flags f where f.event_id = e.id and f.status = 'open')
         + (select count(*) from public.venue_booking_flags f where f.event_id = e.id and f.status = 'open')
      into v_open_reviews;
    if v_open_reviews > 0 then
      arrangement := 'arrangement_reviews';
      label := 'Arrangements needing review';
      complete := false;
      detail := format('%s %s still %s review.', v_open_reviews,
                       case when v_open_reviews = 1 then 'arrangement' else 'arrangements' end,
                       case when v_open_reviews = 1 then 'needs' else 'need' end);
      sort_order := 5;
      return next;
    end if;
  end if;

  -- US43: the safety review, the last step before the event can be confirmed (once switched on).
  if public.safety_review_enabled()
     and e.status in ('planning', 'awaiting_safety_review', 'safety_changes_requested', 'in_preparation',
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

-- ---------------------------------------------------------------------------
-- AC-045.2: revising flags the arrangements the Safety Officer named
-- ---------------------------------------------------------------------------
create or replace function public.flag_arrangements_for_safety_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  d public.safety_review_decisions;
  v_comment text;
begin
  select * into d from public.safety_review_decisions
   where event_id = new.id order by decided_at desc, id desc limit 1;
  if not found then
    return null;
  end if;
  v_comment := case when d.comment is not null then format(' Comment: %s', d.comment) else '' end;
  if 'venue' = any (d.revisit) then
    insert into public.arrangement_review_flags (event_id, venue_booking_id, reason_code, detail, safety_review_decision_id)
    select new.id, b.id, 'safety_review',
           'Safety review: the Safety Officer asked for this venue arrangement to be revisited.' || v_comment, d.id
      from public.venue_bookings b
     where b.event_id = new.id
       and (b.status in ('confirmed', 'pending_approval') or (b.status = 'held' and b.hold_expires_at > now()))
    on conflict do nothing;
  end if;
  if 'equipment' = any (d.revisit) then
    insert into public.arrangement_review_flags (event_id, equipment_booking_id, reason_code, detail, safety_review_decision_id)
    select new.id, eb.id, 'safety_review',
           'Safety review: the Safety Officer asked for this equipment arrangement to be revisited.' || v_comment, d.id
      from public.equipment_bookings eb
     where eb.event_id = new.id and eb.status not in ('cancelled', 'rejected')
    on conflict do nothing;
  end if;
  return null;
end $$;
revoke all on function public.flag_arrangements_for_safety_revision() from public, anon, authenticated;

drop trigger if exists events_flag_safety_revision on public.events;
create trigger events_flag_safety_revision
  after update of status on public.events
  for each row when (old.status = 'safety_changes_requested' and new.status = 'planning')
  execute function public.flag_arrangements_for_safety_revision();

-- ---------------------------------------------------------------------------
-- AC-045.6: a change during or after the safety review sends the event back to Planning
-- ---------------------------------------------------------------------------
create or replace function public.us45_send_back_to_planning(p_event uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if not public.safety_review_enabled() then
    return;
  end if;
  select * into e from public.events where id = p_event for update;
  if not found or e.status not in ('awaiting_safety_review', 'in_preparation') then
    return;
  end if;
  perform set_config('app.us45_send_back', 'on', true);
  update public.events set status = 'planning' where id = e.id;
  perform set_config('app.us45_send_back', '', true);
  if e.coordinator_id is not null then
    perform public.send_notification(e.coordinator_id, 'safety_review_decision', e.id,
      format('New safety review needed: %s', coalesce(e.reference, e.name)),
      format('%s%s: %s It is back in Planning and needs a new safety review before it can be confirmed.',
             coalesce(e.reference || ' ', ''), e.name, p_reason));
  end if;
end $$;
revoke all on function public.us45_send_back_to_planning(uuid, text) from public, anon, authenticated;

create or replace function public.send_back_on_arrangement_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.us45_send_back_to_planning(new.event_id, 'One of its arrangements needs review: ' || new.detail);
  return null;
end $$;
revoke all on function public.send_back_on_arrangement_review() from public, anon, authenticated;

drop trigger if exists arrangement_review_flags_send_back on public.arrangement_review_flags;
create trigger arrangement_review_flags_send_back
  after insert on public.arrangement_review_flags
  for each row when (new.status = 'open')
  execute function public.send_back_on_arrangement_review();

drop trigger if exists venue_booking_flags_send_back on public.venue_booking_flags;
create trigger venue_booking_flags_send_back
  after insert on public.venue_booking_flags
  for each row when (new.status = 'open')
  execute function public.send_back_on_arrangement_review();

commit;
