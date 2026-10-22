-- US22: an Event Coordinator withdraws a submitted request that is under review, so a
-- request that will not go ahead is closed without being rejected. Safe to replay.
--
-- AC-022.1 Event Coordinators can withdraw a request under review submitted by the Organiser.
-- AC-022.2 Withdrawn events are marked "Withdrawn" and stay distinguishable from draft,
--          submitted, approved and rejected events.
--
-- Why a new status rather than reusing 'cancelled': cancelling a confirmed event and
-- closing a request nobody has decided on are different facts about what happened. The
-- organiser's own status display has to tell them apart, and the review decision log has
-- to record which one a reviewer chose. AC-022.2 asks for exactly that distinguishability.
--
-- Who may do it is not restated here. Two existing guards already settle it:
--   * enforce_event_status_transition (0006) lets a coordinator make any valid transition
--     and restricts an organiser to 'submitted' or 'cancelled', so an organiser cannot
--     withdraw their own request — which is what AC-022.1 says.
--   * guard_assigned_coordinator_event_update (0039) refuses any coordinator who is not
--     events.coordinator_id, so only the assigned coordinator can withdraw.
-- Adding the transition below is therefore the whole of the authorisation change.

begin;

-- ---------------------------------------------------------------------------
-- AC-022.2 — 'withdrawn' is a status of its own
-- ---------------------------------------------------------------------------
-- Every existing row already satisfies the wider rule, so this re-adds cleanly without
-- a NOT VALID step.
alter table public.events drop constraint if exists events_status_valid;
alter table public.events add constraint events_status_valid check (
  status in ('draft', 'submitted', 'under_review', 'approved',
             'planning', 'confirmed', 'completed', 'cancelled', 'rejected', 'withdrawn')
);

-- ---------------------------------------------------------------------------
-- AC-022.1 — reachable only from the two states that mean "under review"
-- ---------------------------------------------------------------------------
-- Both count: 'submitted' displays to the organiser as "In review" (organiserStatusLabel),
-- and 'under_review' is the explicit state a coordinator moves it to. A request in either
-- one is awaiting a decision, which is what makes withdrawal the right close.
--
-- 'withdrawn' is terminal, like completed, cancelled and rejected. Reviving a withdrawn
-- request is a new request, which keeps the audit trail honest — the same reasoning
-- 0004 records for the other terminal states.
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
    when 'planning'   then new_status in ('confirmed', 'cancelled')
    when 'confirmed'  then new_status in ('completed', 'cancelled')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Who withdrew, and when
-- ---------------------------------------------------------------------------
-- Withdrawal is a reviewer's decision about a request, so it is stamped like the others.
-- Without this a withdrawn request would show no reviewer and no time, and AC-022.2's
-- "distinguishable" would hold on the board but not in the record.
create or replace function public.stamp_event_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('under_review', 'approved', 'rejected', 'withdrawn')
     and auth.uid() is not null then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The decision log (US4 AC-004.5)
-- ---------------------------------------------------------------------------
-- 'withdrawn' joins approved/rejected/returned as a recorded decision, which needs the
-- decision CHECK widened as well as the trigger changed.
--
-- The sibling constraint event_review_decisions_reason_required already says every
-- decision except 'approved' carries a reason, so a withdrawal must have one. That is
-- the schema's rule, not a new one invented here, and it is why the service refuses a
-- withdrawal with a blank note rather than letting the insert fail.
alter table public.event_review_decisions
  drop constraint if exists event_review_decisions_decision_valid;
alter table public.event_review_decisions
  add constraint event_review_decisions_decision_valid
  check (decision in ('approved', 'rejected', 'returned', 'withdrawn'));

-- The trigger is otherwise unchanged from 0009; it is restated in full because that is
-- how this codebase replaces a function, and partial edits to a body are not replayable.
create or replace function public.record_event_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_word  text;
  actor_name     text;
  organiser_email text;
  new_decision_id uuid;
  event_label    text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  decision_word := case
    when new.status = 'approved' then 'approved'
    when new.status = 'rejected' then 'rejected'
    when new.status = 'withdrawn' then 'withdrawn'
    when old.status = 'under_review' and new.status = 'submitted' then 'returned'
    else null
  end;

  -- Starting a review, lifecycle moves and administrator fixes (no JWT) are not review
  -- decisions. An admin correction in the SQL editor has no actor to attribute.
  if decision_word is null or auth.uid() is null then
    return null;
  end if;

  select full_name into actor_name from public.profiles where id = auth.uid();

  insert into public.event_review_decisions
    (event_id, from_status, decision, reason, decided_by, decided_by_name)
  values
    (new.id, old.status, decision_word, nullif(btrim(new.review_note), ''),
     auth.uid(), coalesce(actor_name, 'Unknown reviewer'))
  returning id into new_decision_id;

  -- AC-004.4 names the approved/rejected outcomes. A return is logged above but not
  -- emailed; widening this is one line if the team decides organisers should be told.
  if decision_word in ('approved', 'rejected') then
    select email into organiser_email from auth.users where id = new.organiser_id;

    -- An account with no email (a phone sign-up) cannot be notified; the decision itself
    -- must not fail because of that.
    if organiser_email is not null then
      event_label := coalesce(new.reference, 'your event request')
        || coalesce(' (' || nullif(btrim(new.name), '') || ')', '');

      insert into public.notification_outbox
        (event_id, decision_id, recipient_email, subject, body)
      values (
        new.id,
        new_decision_id,
        organiser_email,
        'Your event request ' || coalesce(new.reference, '') || ' was ' || decision_word,
        'Your event request ' || event_label || ' has been ' || decision_word
          || ' by an event coordinator.' || E'\n\n'
          || 'Reason: ' || coalesce(nullif(btrim(new.review_note), ''), 'No reason was given.')
          || E'\n\n' || 'You can view the current status of your request in ConnectSphere.'
      );
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.record_event_review_decision() from public, anon, authenticated;

commit;
