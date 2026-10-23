-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US10 venue booking decisions moved onto the
-- sending helper (0079). notify_venue_booking_decision(), last defined in 0051, is recreated unchanged except
-- for how it sends its notice.
--
-- In-app only, as before (its email arrives with 0093). A Coordinator who turns this notice off
-- in-app no longer gets it; with no choice made, it is sent, as before. The decision itself is
-- unaffected.
-- Owner of the function: Justas (US10).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.notify_venue_booking_decision()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; event_reference text;
begin
 -- Administrative repairs and historical final rows do not generate new decisions.
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then return new; end if;
 select coalesce(e.coordinator_id,new.requested_by),e.reference into recipient,event_reference
 from public.events e where e.id=new.event_id for share;
 if not exists(select 1 from public.profiles where id=recipient and role='coordinator') then return new; end if;
 -- US33: only if the Coordinator has this in-app notice on.
 if not (select c.in_app from public.notification_channels(recipient,'venue_booking_decision') c) then return new; end if;
 insert into public.venue_booking_decision_notifications
  (booking_id,event_id,recipient_id,venue_name,event_reference,decision,reason,alternative,reviewed_by,reviewed_at)
 select new.id,new.event_id,recipient,v.name,event_reference,new.status,new.review_note,
  new.review_alternative,new.reviewed_by,new.reviewed_at from public.venues v where v.id=new.venue_id
 on conflict (booking_id) do nothing;
 return new;
end $$;

commit;
