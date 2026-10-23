-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US23 withdrawals moved onto the
-- sending helper (0079). queue_withdrawal_confirmation(), last defined in 0050, is recreated unchanged except
-- for how it sends its notice.
--
-- Same email as before, now also kept in-app separately. Each follows the Attendee's choice for
-- "Your registrations"; with no choice made, both are sent, as before.
-- Owner of the function: Siew Yuanlong (US23).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.queue_withdrawal_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_start timestamptz;
begin
  select e.name, e.proposed_start into event_name, event_start
  from public.events e
  where e.id = new.event_id;

  -- US33: the in-app copy and the email each follow the Attendee's choice. With no address,
  -- no email is queued; the withdrawal itself still stands.
  perform public.send_notification(
    new.attendee_id,
    'registration_update',
    new.event_id,
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

commit;
