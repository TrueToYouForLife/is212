-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US16 waiting list moved onto the
-- sending helper (0079). queue_waitlist_notification(), last defined in 0058, is recreated unchanged except
-- for how it sends its notice.
--
-- Same emails as before, now also kept in-app separately. Each follows the Attendee's choice for
-- "Waiting list updates"; with no choice made, both are sent, as before.
-- Owner of the function: Siew Yuanlong (US16).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.queue_waitlist_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_name text;
  event_start timestamptz;
  subject text;
  body text;
  deadline text;
begin
  if tg_op = 'INSERT' then
    subject := 'You are on the waiting list for ';
  elsif old.status = 'waiting' and new.status = 'offered' then
    subject := 'A place is available for ';
  elsif old.status = 'offered' and new.status = 'expired' then
    subject := 'Your offer has expired for ';
  else
    return new;
  end if;

  select e.name, e.proposed_start into event_name, event_start
  from public.events e where e.id = new.event_id;
  subject := subject || coalesce(event_name, 'your event');

  if new.status = 'waiting' then
    body := 'You are on the waiting list for ' || coalesce(event_name, 'your event') || '.' || E'\n\n'
      || 'If a place becomes available we will email you. You will then have 3 days to accept it.';
  elsif new.status = 'offered' then
    -- Singapore time explicitly: the server's time zone is not the Attendee's.
    deadline := to_char(new.offer_expires_at at time zone 'Asia/Singapore', 'FMDD Mon YYYY, HH24:MI');
    body := 'A place is available for ' || coalesce(event_name, 'your event') || '.' || E'\n\n'
      || 'Accept it under My registrations before ' || deadline || ' (Singapore time), '
      || 'or it will pass to the next person on the waiting list.';
  else
    body := 'The place offered to you for ' || coalesce(event_name, 'your event')
      || ' was not accepted in time and has passed to the next person on the waiting list.' || E'\n\n'
      || 'You can join the waiting list again if the event is still full.';
  end if;

  -- US33: the in-app copy and the email each follow the Attendee's choice.
  perform public.send_notification(new.attendee_id, 'waitlist_update', new.event_id, subject, body);
  return new;
end;
$$;

commit;
