-- US33 (SCRUM-230) fix: restores US22's withdrawal outcome in record_event_review_decision().
-- 0080 recreated the function from 0009's version, before US22's 0066 had merged, so it dropped
-- 0066's one change: a withdrawal is recorded in the decision log as its own outcome
-- (AC-022.2.11). This is 0066's version with only 0080's change, the decision notice sent through
-- the US33 helper so it follows the Organiser's channel choices.
-- Owner of the function: Jeremiah (US4); withdrawal outcome: Nicole (US22).
-- Apply after 0080. Safe to replay.
begin;

create or replace function public.record_event_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_word  text;
  actor_name     text;
  new_decision_id uuid;
  event_label    text;
  notice_subject text;
  notice_body    text;
  outbox_id      uuid;
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
    event_label := coalesce(new.reference, 'your event request')
      || coalesce(' (' || nullif(btrim(new.name), '') || ')', '');
    notice_subject := 'Your event request ' || coalesce(new.reference, '') || ' was ' || decision_word;
    notice_body := 'Your event request ' || event_label || ' has been ' || decision_word
      || ' by an event coordinator.' || E'\n\n'
      || 'Reason: ' || coalesce(nullif(btrim(new.review_note), ''), 'No reason was given.')
      || E'\n\n' || 'You can view the current status of your request in ConnectSphere.';

    -- US33: the in-app copy and the email each follow the Organiser's choice. An account
    -- with no email still gets the in-app copy; the decision itself never fails over this.
    perform public.record_in_app_notice(new.organiser_id, 'event_request_decision', new.id, notice_subject, notice_body);
    outbox_id := public.queue_notification_email(new.organiser_id, 'event_request_decision', new.id, notice_subject, notice_body);
    if outbox_id is not null then
      update public.notification_outbox set decision_id = new_decision_id where id = outbox_id;
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.record_event_review_decision() from public, anon, authenticated;

commit;
