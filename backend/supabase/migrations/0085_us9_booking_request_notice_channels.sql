-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US9 venue booking requests moved onto the
-- sending helper (0079). notify_venue_staff_of_booking_request(), last defined in 0035, is recreated unchanged except
-- for how it sends its notice.
--
-- In-app only, as before (its email arrives with 0093). A Venue Staff member who turns this
-- notice off in-app no longer gets it; with no choice made, everyone gets it, as before. The
-- booking request itself, and Venue Staff's list of requests to review, are unaffected.
-- Owner of the function: Nicole (US9).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.notify_venue_staff_of_booking_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only the held -> pending_approval transition is a new request to review.
  if new.status <> 'pending_approval' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending_approval' then return new; end if;

  insert into public.venue_booking_notifications (venue_booking_id, venue_id, recipient_id)
  select new.id, new.venue_id, p.id
    from public.profiles p
   where p.role = 'venue_staff'
     -- US33: only Venue Staff who have this in-app notice on.
     and (select c.in_app from public.notification_channels(p.id, 'venue_booking_request') c)
  on conflict (venue_booking_id, recipient_id) do nothing;

  return new;
end;
$$;

commit;
