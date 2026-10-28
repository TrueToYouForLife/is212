-- US37 (SCRUM-234) merge fix: the two functions this story and others both replace.
--
-- Apply after 0108. Safe to replay.
--
-- 0096 added one case to enforce_event_status_transition: a returned request goes back
-- under review when its owner answers, proved by a recorded answer rather than by who is
-- asking. 0108 (US43) then replaced the whole function to add the safety stages, and
-- because PostgreSQL has no way to add a case to a function, that replacement dropped
-- 0096's case. 0108 runs after 0096, so on any fresh database the Organiser's resubmission
-- is refused with 42501 and AC-037.2 fails outright.
--
-- Neither migration is at fault on its own — this is what "create or replace must carry
-- every earlier change forward" costs when two stories touch the same function in the same
-- sprint. This is 0108's body with 0096's case put back, and it must stay the LAST word on
-- this function: anything that replaces it again has to carry both.
--
-- stamp_event_review is here for the same reason. 0066 (US22) stamps a withdrawal with who
-- closed the request; 0096 added "only a Coordinator stamps a review decision" so that an
-- Organiser answering a clarification is not recorded as their own reviewer. Each is right
-- and neither carried the other, and the database runner replays 0066 after the migration
-- loop, which restored its version on top of 0096's. This is both rules in one body.
begin;

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

create or replace function public.stamp_event_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and (
       -- 0066 (US22): the Organiser closes their own request, and it is stamped with who
       -- did it.
       new.status = 'withdrawn'
       -- 0096 (US37): a review decision is the Coordinator's. The Organiser moves their own
       -- request into under_review when they answer a clarification, and must not be
       -- recorded as having reviewed it.
       or (new.status in ('under_review', 'approved', 'rejected')
           and public.current_user_role() = 'coordinator')
     ) then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

commit;
