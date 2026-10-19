-- US37 (SCRUM-234, subtasks SCRUM-262/264/266): AC-037.1, AC-037.2, AC-037.4, AC-037.5 —
-- the Organiser answers a clarification request and resubmits, without starting over.
--
-- A returned request is status='submitted' with a non-blank review_note (0012's
-- review_submitted_event with p_decision='submitted'). The Organiser can see it, labelled
-- "Clarification required", and until now could do nothing with it: their only route was
-- US6, which is for changing an event that has already been approved.
--
-- Two existing controls stand in the way, both deliberately:
--
--   * guard_submitted_event_details (0008) refuses any detail change made from the browser
--     once the event has left draft.
--   * enforce_event_status_transition (0004) lets an owning Organiser move their own event
--     only to 'submitted' or 'cancelled', so they cannot put it back under review.
--
-- Neither is relaxed for the browser. 0008's guard is SECURITY INVOKER, so running the
-- detail change through a SECURITY DEFINER entry point is enough to satisfy it. 0004's
-- transition guard cannot be passed the same way: it is itself SECURITY DEFINER, so
-- current_user inside it is always the function owner and can say nothing about who asked.
-- auth.uid() is the Organiser either way.
--
-- So the transition is authorised by recorded data instead: an Organiser may put their own
-- request back under review exactly when an answer to that request, in its current state,
-- has already been written down. Only the entry point below can arrange that — the browser
-- has no insert grant on the response table — and because updated_at moves on as soon as
-- the status change lands, one recorded answer authorises exactly one transition.
--
-- Depends on 0024 for is_assigned_event_coordinator. AC-037.3 (notifying the Coordinator)
-- is the next slice and is not implemented here.

begin;

-- ---------------------------------------------------------------------------
-- What the Organiser is allowed to revise
-- ---------------------------------------------------------------------------
-- A whitelist, not "any column the caller names". These are exactly the fields the
-- Organiser filled in to make the request in the first place (eventService.ts and
-- eventDraftService.ts write this same set), so answering a clarification can revise their
-- own answers and nothing else: not status, not reference, not coordinator_id, not the
-- review bookkeeping.
--
-- Kept as a function rather than inlined so the test suite can assert the set directly.
-- Adding a name here is the decision to let an Organiser change that field mid-review.
create or replace function public.clarification_editable_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'name', 'purpose', 'event_type', 'description',
    'proposed_start', 'proposed_end', 'expected_attendance', 'programme',
    'layout_preference', 'accessibility_requirements', 'facility_requirements',
    'equipment_requirements', 'registration_required', 'special_arrangements'
  ]::text[];
$$;

-- ---------------------------------------------------------------------------
-- AC-037.5: the values before and after are both kept
-- ---------------------------------------------------------------------------
-- One row per answered round. before_values and after_values hold only the fields the
-- Organiser submitted, as submitted — a field sent with an unchanged value is still
-- recorded, because what they chose to touch is itself part of the answer.
--
-- review_note is copied in rather than referenced, because the event's own review_note is
-- cleared on resubmission: the question has been answered, so it belongs in the answered
-- record and not in the event's live state. That keeps "review_note is the outstanding
-- question" true as an invariant instead of leaving a stale question on the row.
create table if not exists public.event_clarification_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  round integer not null,
  responded_by uuid not null references public.profiles (id),
  review_note text not null,
  reply text not null,
  before_values jsonb not null,
  after_values jsonb not null,
  -- The event's updated_at that this answer was written against. It is what authorises the
  -- status change below, so it is also what stops one answer authorising two: the change
  -- moves updated_at on, and no later row can match this value again.
  answered_updated_at timestamptz not null,
  responded_at timestamptz not null default now(),
  unique (event_id, round),
  unique (event_id, answered_updated_at)
);

create index if not exists event_clarification_responses_event_idx
  on public.event_clarification_responses (event_id, round desc);

alter table public.event_clarification_responses enable row level security;

-- Read-only from the browser. The only writer is the function below, which runs as owner
-- and so is unaffected by the absence of an insert grant.
revoke all on public.event_clarification_responses from public, anon, authenticated;
grant select on public.event_clarification_responses to authenticated;

-- The Organiser who answered, and the Coordinator reviewing the answer. Nothing here is
-- internal: responded_by is the Organiser themselves, so unlike the US4 decision log this
-- needs no staff-only restriction.
drop policy if exists clarification_responses_read on public.event_clarification_responses;
create policy clarification_responses_read on public.event_clarification_responses
  for select to authenticated using (
    exists (
      select 1 from public.events e
       where e.id = event_id
         and ((public.current_user_role() = 'organiser' and e.organiser_id = auth.uid())
              or public.is_assigned_event_coordinator(e.id))
    )
  );

-- ---------------------------------------------------------------------------
-- AC-037.2: only a reviewed operation may put a request back under review
-- ---------------------------------------------------------------------------
-- The organiser branch gains one case, stated as a fact about the data rather than about
-- the caller: the answer must already be recorded against this exact version of the
-- request. respond_to_clarification writes that row and then makes the move in the next
-- statement; the browser cannot write it at all.
--
-- This deliberately does not re-check that the request was returned or that the reply is
-- non-blank. Those live in the function, which can report them usefully; a trigger that
-- restated half of them would only give the two somewhere to disagree.
--
-- Restated from 0006's body, NOT 0004's. 0006 tightened the organiser branch to require
-- actor_role = 'organiser' as well as ownership, so that someone moved off the organiser
-- role keeps no control over the events they used to own. Postgres has no way to add a
-- case to a function, so a replacement has to carry every earlier change forward; basing
-- this on 0004 reverted that one. AC-037.4.16 now fails if it is reverted again.
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

  actor_role := public.current_user_role();

  if actor_role = 'coordinator' then
    -- A coordinator reviews, but does not file requests on an organiser's behalf.
    if new.status = 'submitted' and old.status = 'draft' then
      raise exception 'Only the organiser may submit their own request'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if actor_role = 'organiser' and old.organiser_id = auth.uid() then
    -- US37 AC-037.2: a returned request goes back under review when its owner answers.
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
-- The question belongs to the reviewer
-- ---------------------------------------------------------------------------
-- Found while testing AC-037.4: review_note is one of the columns 0008 lets through,
-- because 0012's review_submitted_event is SECURITY INVOKER and writes it as the
-- Coordinator. Combined with events_update_own (0006), that let an Organiser clear or
-- rewrite the question they were asked straight from the browser — not a route to changing
-- the request, but a route to erasing what was asked of them.
--
-- A pre-existing gap rather than one this slice opens, but US37 is where it starts to
-- matter: the whole story is about answering that question, and AC-037.4 is only as strong
-- as "the request is returned" is trustworthy.
--
-- SECURITY INVOKER, like 0008's guard and for the same reason: current_user is the caller,
-- so this admits the review RPC (authenticated, role coordinator) and the response function
-- below (runs as owner), and refuses everyone else.
create or replace function public.guard_event_review_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.review_note is distinct from old.review_note
     and public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Only the reviewing coordinator may change the review note'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists events_guard_review_note on public.events;
create trigger events_guard_review_note before update on public.events
  for each row execute function public.guard_event_review_note();

-- ---------------------------------------------------------------------------
-- Reviewer identity must stay the reviewer's
-- ---------------------------------------------------------------------------
-- 0004 stamps reviewed_by on every move into under_review, approved or rejected. Until now
-- only a Coordinator could make one of those moves, so the actor was always the reviewer.
-- AC-037.2 has the Organiser move their own request into under_review, which would have
-- recorded them as having reviewed it.
--
-- The role condition is a no-op for every existing path — review_submitted_event already
-- refuses a non-coordinator, and the direct update path needs the coordinator policy — so
-- this corrects a latent fault rather than changing US4 behaviour.
create or replace function public.stamp_event_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('under_review', 'approved', 'rejected')
     and auth.uid() is not null
     and public.current_user_role() = 'coordinator' then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- AC-037.1, AC-037.2, AC-037.4, AC-037.5: answering the clarification request
-- ---------------------------------------------------------------------------
-- p_updates is a jsonb object of the fields being revised, which may be empty: a reply on
-- its own is a legitimate answer ("the hall is already booked, nothing to change"), and
-- forcing an edit would make Organisers invent one.
--
-- p_expected_updated_at is the event's updated_at as the Organiser was shown it. The status
-- check below already catches a Coordinator who has approved or rejected in the meantime;
-- this catches the subtler case where they returned it a second time with a different
-- question, so the Organiser would otherwise be answering a question that is no longer
-- being asked. Same reasoning as the review_version US7 passes through its reply path.
create or replace function public.respond_to_clarification(
  p_event_id uuid,
  p_updates jsonb,
  p_reply text,
  p_expected_updated_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_before jsonb;
  event_after jsonb;
  applied public.events;
  unknown_field text;
  reply_text text;
  next_round integer;
  question text;
  response_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'organiser' then
    raise exception 'Only an event organiser may answer a clarification request'
      using errcode = '42501';
  end if;

  reply_text := nullif(btrim(p_reply), '');
  if reply_text is null then
    raise exception 'Write a reply to the coordinator''s question' using errcode = '22023';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'The revised fields must be given as an object' using errcode = '22023';
  end if;

  -- Named rather than counted, so the caller is told which field was refused.
  select k into unknown_field
    from jsonb_object_keys(p_updates) as k
   where not (k = any (public.clarification_editable_fields()))
   limit 1;
  if unknown_field is not null then
    raise exception '% cannot be changed when answering a clarification request',
      unknown_field using errcode = '22000';
  end if;

  -- for update: two tabs answering the same question must not both apply.
  select to_jsonb(e) into event_before
    from public.events e
   where e.id = p_event_id and e.organiser_id = auth.uid()
     for update;
  if event_before is null then
    raise exception 'Request unavailable' using errcode = '22000';
  end if;

  -- AC-037.4. "Under review and not returned" is exactly status='submitted' with no
  -- question on it, and it fails here rather than in a policy so the Organiser is told why.
  question := nullif(btrim(event_before ->> 'review_note'), '');
  if event_before ->> 'status' <> 'submitted' or question is null then
    raise exception 'This request is not awaiting your clarification'
      using errcode = '22000';
  end if;

  if p_expected_updated_at is null
     or (event_before ->> 'updated_at')::timestamptz <> p_expected_updated_at then
    raise exception 'Request changed; reload before replying' using errcode = '22000';
  end if;

  -- The revised row, built by merging the submitted fields over the current one. Two
  -- independent guards keep this honest: the whitelist check above, and the explicit SET
  -- list below, which can only assign whitelisted columns however p_updates is shaped.
  applied := jsonb_populate_record(null::public.events, event_before || p_updates);

  select coalesce(max(round), 0) + 1 into next_round
    from public.event_clarification_responses where event_id = p_event_id;

  -- Written before the update, not after: 0004's transition guard looks for this row to
  -- decide whether the Organiser may move their own request back under review. after_values
  -- is filled in once the update has landed, because the record has to show what was
  -- stored rather than what was intended.
  insert into public.event_clarification_responses (
    event_id, round, responded_by, review_note, reply,
    before_values, after_values, answered_updated_at
  ) values (
    p_event_id, next_round, auth.uid(), question, reply_text,
    -- AC-037.5. Restricted to the submitted keys: a full snapshot of every field on every
    -- round would bury the answer in columns nobody was asked about.
    coalesce((select jsonb_object_agg(k, event_before -> k)
                from jsonb_object_keys(p_updates) as k), '{}'::jsonb),
    '{}'::jsonb,
    p_expected_updated_at
  ) returning id into response_id;

  update public.events set
    name                       = applied.name,
    purpose                    = applied.purpose,
    event_type                 = applied.event_type,
    description                = applied.description,
    proposed_start             = applied.proposed_start,
    proposed_end               = applied.proposed_end,
    expected_attendance        = applied.expected_attendance,
    programme                  = applied.programme,
    layout_preference          = applied.layout_preference,
    accessibility_requirements = applied.accessibility_requirements,
    facility_requirements      = applied.facility_requirements,
    equipment_requirements     = applied.equipment_requirements,
    registration_required      = applied.registration_required,
    special_arrangements       = applied.special_arrangements,
    -- AC-037.2. The reference is never touched, so it is the same request throughout.
    status                     = 'under_review',
    review_note                = null
   where id = p_event_id;

  -- Read back rather than trusting `applied`: the existing CHECK constraints, the
  -- catalogue-code foreign keys from 0054 and the updated_at trigger all have a say in
  -- what the row actually became, and the record must show what was stored.
  select to_jsonb(e) into event_after from public.events e where e.id = p_event_id;

  update public.event_clarification_responses
     set after_values = coalesce((select jsonb_object_agg(k, event_after -> k)
                                    from jsonb_object_keys(p_updates) as k), '{}'::jsonb)
   where id = response_id;

  return response_id;
end;
$$;

revoke all on function public.clarification_editable_fields() from public, anon;
grant execute on function public.clarification_editable_fields() to authenticated;
revoke all on function public.respond_to_clarification(uuid, jsonb, text, timestamptz)
  from public, anon;
grant execute on function public.respond_to_clarification(uuid, jsonb, text, timestamptz)
  to authenticated;

commit;
