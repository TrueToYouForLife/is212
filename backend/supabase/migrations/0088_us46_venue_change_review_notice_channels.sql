-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US46 venue-change reviews moved onto the
-- sending helper (0079). record_venue_change_review(), last defined in 0067, is recreated unchanged except
-- for how it sends its notice.
--
-- In-app only, as before (its email arrives with 0093). The review flag is always recorded; only
-- the notice follows the Coordinator's in-app choice. With no choice made, it is sent, as before.
-- Owner of the function: Jeremiah (US46).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.record_venue_change_review(
  p_change uuid, p_event uuid, p_booking uuid, p_code text, p_detail text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_flag uuid;
  v_recipient uuid;
begin
  update public.arrangement_review_flags f
  set detail = p_detail, venue_change_id = p_change
  where f.venue_booking_id = p_booking and f.reason_code = p_code
    and f.venue_change_id is not null and f.status = 'open';
  if found then return; end if;

  insert into public.arrangement_review_flags (venue_change_id, event_id, venue_booking_id, reason_code, detail)
  values (p_change, p_event, p_booking, p_code, p_detail)
  on conflict do nothing
  returning id into v_flag;
  if v_flag is null then return; end if;

  select e.coordinator_id into v_recipient
  from public.events e join public.profiles p on p.id = e.coordinator_id and p.role = 'coordinator'
  where e.id = p_event;
  -- US33: the flag is always recorded; the notice only if the Coordinator has it on in-app.
  if v_recipient is not null
     and (select c.in_app from public.notification_channels(v_recipient, 'arrangement_review') c) then
    insert into public.arrangement_review_notifications (flag_id, event_id, recipient_id, detail)
    values (v_flag, p_event, v_recipient, p_detail);
  end if;
end $$;

commit;
