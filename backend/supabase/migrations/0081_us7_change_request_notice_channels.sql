-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US7 change requests moved onto the
-- sending helper (0079). notify_change_request_submission(), last defined in 0016, is recreated unchanged except
-- for how it sends its notice.
--
-- Team decision (US33): each person decides, and the system-wide switches stay as an all-on
-- admin kill switch. US7's email switch was off, so it is turned on here: Coordinators now
-- get the change-request email unless they turn it off. This is the one behaviour change.
-- Owner of the function: Jaydon (US7).
-- Apply after 0079. Safe to replay.
begin;

-- The system-wide switch becomes an all-on kill switch: email on unless an admin turns it off.
update public.change_request_notification_settings set email_enabled = true
  where notification_type = 'change_request_submitted';

create or replace function public.notify_change_request_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  coordinator uuid;
  v_in_app boolean;
  v_email boolean;
  notification_id uuid;
  outbox_id uuid;
begin
  if new.status <> 'submitted' then return new; end if;
  if tg_op='UPDATE' then
    if old.status <> 'clarification_requested' then return new; end if;
  end if;
  select e.coordinator_id into coordinator from public.events e
    join public.profiles p on p.id=e.coordinator_id and p.role='coordinator'
    where e.id=new.event_id;
  -- Assignment is owned by US17. Never broadcast an unassigned request to all staff.
  if coordinator is null then return new; end if;
  -- US33: the Coordinator's own choice, within the system-wide switch.
  select c.in_app, c.email into v_in_app, v_email from public.notification_channels(coordinator, 'change_request') c;
  if not (v_in_app or v_email) then return new; end if;
  insert into public.change_request_notifications
    (change_request_id,event_id,recipient_id,request_version,in_app_enabled)
    values(new.id,new.event_id,coordinator,new.review_version,v_in_app)
    on conflict(change_request_id,request_version,recipient_id) do nothing
    returning id into notification_id;
  if notification_id is null then return new; end if;
  if v_email then
    -- Generic body does not disclose event details if assignment changes before delivery.
    outbox_id := public.queue_notification_email(coordinator, 'change_request', new.event_id,
      'An event change request is ready for review',
      'A change request was submitted or clarification answers were received for an event assigned to you. Sign in to ConnectSphere and open Requests to review the requests currently assigned to you.');
    if outbox_id is not null then
      update public.change_request_notifications set email_outbox_id=outbox_id where id=notification_id;
    end if;
  end if;
  return new;
end $$;

commit;
