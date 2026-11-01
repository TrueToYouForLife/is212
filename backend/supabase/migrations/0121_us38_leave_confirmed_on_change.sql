-- US38 AC-038.5: an approved significant change takes a Confirmed event out of Confirmed.
--
-- 0119 notifies the Organiser whenever a Confirmed event stops being Confirmed, but nothing
-- moved one when a significant change was approved: US7 (0015/0055) only queued revalidation
-- work, and US45 (0118) covers events already in or past safety review. This moves a Confirmed
-- event back to Planning in the same transaction as the approval, so it can be re-planned (and,
-- with the safety review on, sent for review again, which is also US45 AC-045.6's wording).
-- 'Significant' is exactly what 0055 already decided: an event_change_revalidations row exists only
-- when an accepted field is one of the significant ones, so ordinary edits, rejections and
-- provisional approvals never reach this. Bookings and reservations are not touched; the
-- revalidation row and arrangement reviews tell the Coordinator what to recheck.
--
-- 0119 is applied: this replaces its two status functions with the same rules plus one route.
begin;

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
    -- AC-038.5: back to Planning only when an approved significant change needs it re-planned
    -- (the trigger below marks that case; nobody moves a confirmed event back by hand).
    when 'confirmed'  then new_status in ('completed', 'postponed', 'planning', 'cancelled')
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

  -- AC-038.5: leaving Confirmed for Planning is the system's response to an approved significant
  -- change (leave_confirmed_on_approved_change() sets the marker for that one statement).
  if old.status = 'confirmed' and new.status = 'planning' then
    if coalesce(current_setting('app.us38_leave_confirmed', true), '') <> 'on' then
      raise exception 'A confirmed event goes back to Planning only when an approved change needs it re-planned'
        using errcode = '42501';
    end if;
    return new;
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

create or replace function public.leave_confirmed_on_approved_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.events where id = new.event_id for update;
  if v_status is distinct from 'confirmed' then
    return null;
  end if;
  -- The marker is transaction-local and cleared straight after, so it covers this one update.
  perform set_config('app.us38_leave_confirmed', 'on', true);
  update public.events set status = 'planning' where id = new.event_id;
  perform set_config('app.us38_leave_confirmed', '', true);
  return null;
end $$;
revoke all on function public.leave_confirmed_on_approved_change() from public, anon, authenticated;

drop trigger if exists revalidation_leave_confirmed on public.event_change_revalidations;
create trigger revalidation_leave_confirmed
  after insert on public.event_change_revalidations
  for each row execute function public.leave_confirmed_on_approved_change();

commit;
