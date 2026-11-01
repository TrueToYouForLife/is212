-- US38 (SCRUM-291, AC-038.1 and AC-038.2): reconcile the status list with the 14 statuses.
--
-- 13 existed. 'Returned for Clarification' is deliberately not a stored status: it is
-- submitted + a review note (0012), shown to organisers as "Clarification required", and
-- US4/US7/US22/US37 all depend on that shape. 'postponed' is the 14th and is new here.
--
-- Postponed (team proposal, #70): the Coordinator pauses a planned event from Planning,
-- In Preparation or Confirmed. It leaves by being re-planned (back to Planning, where it goes
-- through safety review again) or cancelled. Postponing changes no booking, reservation or
-- allocation, so nothing is released behind anyone's back.
--
-- Everything below is 0118's rule with only the 'postponed' parts added.
alter table public.events drop constraint if exists events_status_valid;
alter table public.events add constraint events_status_valid check (
  status in ('draft', 'submitted', 'under_review', 'approved', 'planning',
             'awaiting_safety_review', 'safety_changes_requested', 'in_preparation',
             'confirmed', 'postponed', 'completed', 'cancelled', 'rejected', 'withdrawn')
);

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
                                          'postponed', 'cancelled')
    -- US45: Awaiting or In Preparation go back to Planning when an arrangement changes (system only).
    when 'awaiting_safety_review' then new_status in ('in_preparation', 'safety_changes_requested', 'planning', 'cancelled')
    -- US45: the Coordinator revises in Planning and sends the event for review again from there.
    when 'safety_changes_requested' then new_status in ('planning', 'cancelled')
    when 'in_preparation' then new_status in ('confirmed', 'planning', 'postponed', 'cancelled')
    when 'confirmed'  then new_status in ('completed', 'postponed', 'cancelled')
    -- US38: re-planned (through safety review again, when it is on) or called off.
    when 'postponed'  then new_status in ('planning', 'cancelled')
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

  -- US38: pausing an event and re-planning it are the Coordinator's. Cancelling a postponed
  -- event is not special-cased: it falls through to the same checks as any other cancellation.
  if new.status = 'postponed' or (old.status = 'postponed' and new.status = 'planning') then
    if public.current_user_role() is distinct from 'coordinator' then
      raise exception 'Only the event''s Coordinator can postpone or re-plan an event'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- AC-038.6: a Coordinator completes an event only once its end has passed. The automatic route
  -- (AC-038.7) has no JWT and returned at the top, so this binds people, not the scheduled job.
  if new.status = 'completed' and (new.proposed_end is null or new.proposed_end > now()) then
    raise exception 'An event cannot be completed before its end date has passed'
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
-- AC-038.7: a confirmed event nobody completed becomes Completed 7 days after it ends
-- ---------------------------------------------------------------------------
-- Runs with no JWT (pg_cron), which the status trigger treats as the system rather than a
-- person, so the audit trail (US34) records the change with no invented actor. Never callable
-- from the app. The 7 days run from proposed_end, the event's own end, not from the date the
-- Coordinator last looked at it.
create or replace function public.complete_overdue_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.events
     set status = 'completed'
   where status = 'confirmed'
     and proposed_end is not null
     and proposed_end + interval '7 days' <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.complete_overdue_events() from public, anon, authenticated;

-- Same shape as 0062: only where pg_cron exists (the disposable test database has neither it nor
-- pg_net), so tests call the function directly.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('complete-overdue-events', '17 * * * *', 'select public.complete_overdue_events();');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-038.5: the Organiser is told when a Confirmed event stops being Confirmed
-- ---------------------------------------------------------------------------
-- Completing an event is the expected end of Confirmed, not a change, so it is not announced.
-- The in-app copy and the email each follow the Organiser's own choice (US33).
insert into public.notification_types (code, label, description, roles, delivered_in_app, delivered_by_email, sort_order) values
  ('event_status_change', 'Your event is no longer confirmed', 'When a confirmed event is postponed, cancelled or sent back for planning.', '{organiser}', true, true, 120)
on conflict (code) do nothing;

create or replace function public.notify_organiser_event_left_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label   text;
  v_subject text;
  v_body    text;
begin
  v_label := coalesce(new.reference, 'your event')
    || coalesce(' (' || nullif(btrim(new.name), '') || ')', '');
  v_subject := 'Your event ' || coalesce(new.reference, '') || ' is no longer confirmed';
  v_body := 'Your event ' || v_label || ' is no longer confirmed. Its status is now '
    || replace(new.status, '_', ' ') || '.' || chr(10) || chr(10)
    || 'You can view the current status of your event in ConnectSphere.';
  perform public.send_notification(new.organiser_id, 'event_status_change', new.id, v_subject, v_body);
  return null;
end $$;

drop trigger if exists events_left_confirmed_notice on public.events;
create trigger events_left_confirmed_notice
  after update of status on public.events
  for each row
  when (old.status = 'confirmed' and new.status not in ('confirmed', 'completed'))
  execute function public.notify_organiser_event_left_confirmed();
