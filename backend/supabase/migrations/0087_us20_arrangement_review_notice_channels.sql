-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US20 / US41 arrangement reviews moved onto the
-- sending helper (0079). record_arrangement_review(7 arguments), last defined in 0063, is recreated unchanged except
-- for how it sends its notice.
--
-- In-app only, as before (its email arrives with 0093). The review flag is always recorded; only
-- the notice follows the Coordinator's in-app choice. With no choice made, it is sent, as before.
-- Owner of the function: Justas (US20; first written in Jaydon's US41).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.record_arrangement_review(
 p_request uuid,p_event uuid,p_venue_booking uuid,p_equipment_booking uuid,p_code text,p_detail text,p_update uuid)
returns void language plpgsql security definer set search_path='' as $$
declare flag uuid; recipient uuid;
begin
 insert into public.arrangement_review_flags(change_request_id,event_id,venue_booking_id,
  equipment_booking_id,reason_code,detail,planning_update_id)
 values(p_request,p_event,p_venue_booking,p_equipment_booking,p_code,p_detail,p_update)
 on conflict do nothing returning id into flag;
 if flag is null then return; end if;
 select e.coordinator_id into recipient from public.events e join public.profiles p
 on p.id=e.coordinator_id and p.role='coordinator' where e.id=p_event;
 -- US33: the flag is always recorded; the notice only if the Coordinator has it on in-app.
 if recipient is not null
    and (select c.in_app from public.notification_channels(recipient,'arrangement_review') c) then
  insert into public.arrangement_review_notifications(flag_id,event_id,recipient_id,detail)
  values(flag,p_event,recipient,p_detail);
 end if;
end $$;

commit;
