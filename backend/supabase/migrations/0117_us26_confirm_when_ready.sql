-- US26 Confirm an event (SCRUM-71).
-- AC-026.1 Event Coordinators can confirm an event when every arrangement essential for that
--          event is complete.
-- AC-026.2 Confirmed events show a "Confirmed" status to relevant users (already in place; tested).
-- AC-026.3 Confirmed events stop other users booking the same venue at the same time (already in
--          place through the venue's approved booking; tested).
-- The check is in the status rules, so every change to Confirmed goes through it, not only the
-- Confirm button. "Essential" is the readiness card's rule (US5, 0107's venue rule, shared through
-- 0108's event_readiness_lines()): every line complete except registration setup, which only
-- opens once the event is confirmed. With the safety review switched on, the card's Safety review
-- line is complete only once the Safety Officer has approved (US44). Changes made with no
-- signed-in user (the SQL editor, fixtures) are not checked, as for every status rule.
--
-- enforce_event_status_transition() is 0115's body exactly (0108's safety stages with 0096's
-- clarification case put back), with only US26's check added. That makes this the last word on
-- the function: anything that replaces it again has to carry 0108, 0096 and this check.
-- (Built first as 0113 before 0115 merged; renumbered so it applies after 0115 everywhere.)
-- Apply after 0115. Safe to replay.
begin;

-- Ready to confirm: every readiness line is complete, except registration setup.
create or replace function public.event_ready_to_confirm(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_readiness_lines(p_event))
     and not exists (select 1 from public.event_readiness_lines(p_event) l
                     where l.arrangement <> 'registration_setup' and not l.complete);
$$;
revoke all on function public.event_ready_to_confirm(uuid) from public, anon, authenticated;

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

commit;
