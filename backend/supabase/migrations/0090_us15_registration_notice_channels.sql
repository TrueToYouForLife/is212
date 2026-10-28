-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US15 registrations moved onto the
-- sending helper (0079). queue_registration_confirmation(), last defined in 0043, is recreated unchanged except
-- for how it sends its notice.
--
-- Same email as before, now also kept in-app separately. Each follows the Attendee's choice for
-- "Your registrations"; with no choice made, both are sent, as before.
-- Owner of the function: Siew Yuanlong (US15).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.queue_registration_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_start timestamptz;
  venue text;
begin
  select e.name, e.proposed_start, public.event_venue_label(e.id)
    into event_name, event_start, venue
  from public.events e
  where e.id = new.event_id;

  -- US33: the in-app copy and the email each follow the Attendee's choice. With no address,
  -- no email is queued; the registration itself still stands.
  perform public.send_notification(
    new.attendee_id,
    'registration_update',
    new.event_id,
    'You are registered for ' || coalesce(event_name, 'your event'),
    'You are registered for ' || coalesce(event_name, 'your event') || '.' || E'\n\n'
      -- Singapore time explicitly: the server's time zone is not the Attendee's.
      || 'When: ' || to_char(event_start at time zone 'Asia/Singapore', 'FMDD Mon YYYY, HH24:MI')
      || ' (Singapore time)' || E'\n'
      || 'Where: ' || coalesce(venue, 'Venue to be confirmed') || E'\n\n'
      || 'You can see all your registrations under My registrations in ConnectSphere.'
  );

  return new;
end;
$$;

commit;
