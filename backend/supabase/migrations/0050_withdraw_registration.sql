-- 0050_withdraw_registration.sql — US23 (SCRUM-68): an Attendee withdraws their own registration.
--
-- Builds on 0043: event_registrations already allows status = 'withdrawn' with a matching
-- withdrawn_at, and its one-active-registration index is partial, so a withdrawn row never blocks
-- the same person registering again. This adds the only way to reach that state, and the email.
-- Browsers still have no insert, update or delete on the table; nothing here changes that.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Withdrawing (AC-023.1, AC-023.5)
-- ---------------------------------------------------------------------------
-- The registration is always the caller's: the caller is auth.uid() and the lookup is by both id
-- and attendee, so someone else's id and an id that does not exist are the same answer (P0002).
-- Distinct codes let the app say something specific:
--   42501 not an Attendee · P0002 no such registration (or not yours) ·
--   55000 already withdrawn · 22000 the event has started or is not Confirmed.
create or replace function public.withdraw_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  event_status text;
  event_start timestamptz;
begin
  -- The role check comes first, so other roles learn nothing about whether an id exists.
  if auth.uid() is null or public.current_user_role() is distinct from 'attendee' then
    raise exception 'Only attendees can withdraw a registration' using errcode = '42501';
  end if;

  -- FOR UPDATE on the registration: a second withdrawal (two tabs, a double click) waits here,
  -- then sees 'withdrawn' and is refused, so only one succeeds and only one email is queued.
  -- FOR SHARE on the event: it cannot be cancelled or moved between this check and the update.
  select r.status, e.status, e.proposed_start
    into current_status, event_status, event_start
  from public.event_registrations r
  join public.events e on e.id = r.event_id
  where r.id = p_registration_id and r.attendee_id = auth.uid()
  for update of r for share of e;

  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;

  if current_status = 'withdrawn' then
    raise exception 'This registration has already been withdrawn' using errcode = '55000';
  end if;

  -- The current start, not the original one: an event that was postponed or rescheduled to a
  -- later time can still be withdrawn from (AC-023.1). Half-open: starting exactly now is started.
  if event_status <> 'confirmed' or event_start <= now() then
    raise exception 'This event has started or is no longer open' using errcode = '22000';
  end if;

  -- The row is kept, not deleted: the Organiser's and Coordinator's list (US54) shows it marked
  -- as withdrawn (AC-023.4). The status guard repeats the check above as a single statement.
  update public.event_registrations
     set status = 'withdrawn', withdrawn_at = now()
   where id = p_registration_id and status = 'registered';
end;
$$;

revoke execute on function public.withdraw_registration(uuid) from public, anon;
grant execute on function public.withdraw_registration(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Confirmation email (AC-023.2)
-- ---------------------------------------------------------------------------
-- Same mechanism as 0043: a row in notification_outbox, sent by the existing
-- send-review-notifications Edge Function. A trigger rather than code in withdraw_registration,
-- so any future way of withdrawing also sends it, and in the same transaction: if the email
-- cannot be queued, the withdrawal is rolled back too.
create or replace function public.queue_withdrawal_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient text;
  event_name text;
  event_start timestamptz;
begin
  select u.email into recipient from auth.users u where u.id = new.attendee_id;
  -- No address, nothing to send; the withdrawal itself still stands.
  if recipient is null then
    return new;
  end if;

  select e.name, e.proposed_start into event_name, event_start
  from public.events e
  where e.id = new.event_id;

  insert into public.notification_outbox (event_id, recipient_email, subject, body)
  values (
    new.event_id,
    recipient,
    'You have withdrawn from ' || coalesce(event_name, 'your event'),
    'Your registration for ' || coalesce(event_name, 'your event') || ' has been withdrawn.' || E'\n\n'
      -- Singapore time explicitly: the server's time zone is not the Attendee's.
      || 'The event starts: '
      || to_char(event_start at time zone 'Asia/Singapore', 'FMDD Mon YYYY, HH24:MI')
      || ' (Singapore time)' || E'\n\n'
      || 'If your plans change, you can register again while registration is open.'
  );

  return new;
end;
$$;

revoke execute on function public.queue_withdrawal_confirmation() from public, anon, authenticated;

-- Only the registered -> withdrawn change: other updates to a registration send nothing.
drop trigger if exists event_registrations_queue_withdrawal on public.event_registrations;
create trigger event_registrations_queue_withdrawal
  after update on public.event_registrations
  for each row
  when (old.status = 'registered' and new.status = 'withdrawn')
  execute function public.queue_withdrawal_confirmation();
