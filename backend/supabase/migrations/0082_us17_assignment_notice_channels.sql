-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US17 coordinator assignments moved onto the
-- sending helper (0079). notify_coordinator_assignment(), last defined in 0046, is recreated unchanged except
-- for how it sends its notice.
--
-- Same notices as before. Each recipient (the assigned Coordinator and the Organiser) gets the
-- in-app notice and email their own choice allows, within the system-wide switch, which stays
-- on. With no choice made, both are sent, as before.
-- Owner of the function: Jaydon (US17).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.notify_coordinator_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  organiser uuid;
  recipient uuid;
  v_in_app boolean;
  v_email boolean;
  notice_id uuid;
  outbox_id uuid;
  notice_subject text;
  notice_body text;
begin
  -- The history is written only for real Lead changes. Do not backfill old
  -- assignments or emit notifications for administrator repairs/unassignment.
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator_lead'
    or new.new_coordinator_id is null then return new; end if;
  select organiser_id into organiser from public.events where id = new.event_id;

  for recipient in select distinct id from unnest(array[new.new_coordinator_id, organiser]) as recipients(id)
    where id is not null loop
    -- US33: each recipient's own choice, within the system-wide switch.
    select c.in_app, c.email into v_in_app, v_email from public.notification_channels(recipient, 'coordinator_assignment') c;
    if not (v_in_app or v_email) then continue; end if;
    if recipient = new.new_coordinator_id then
      notice_subject := 'An event has been assigned to you';
      notice_body := 'You have been assigned responsibility for an event. Sign in to ConnectSphere and open Requests to view events currently assigned to you.';
    else
      notice_subject := 'Your event coordinator assignment has changed';
      notice_body := 'A coordinator has been assigned or reassigned to your event. Sign in to ConnectSphere and open your event request to view its current details.';
    end if;
    -- Generic messages avoid disclosing event details in mail delivered after
    -- another reassignment. App links must still use current event permissions.
    insert into public.coordinator_assignment_notifications
      (assignment_history_id, event_id, recipient_id, subject, body, in_app_enabled)
    values (new.id, new.event_id, recipient, notice_subject, notice_body, v_in_app)
    on conflict (assignment_history_id, recipient_id) do nothing returning id into notice_id;
    if notice_id is null then continue; end if;
    if v_email then
      outbox_id := public.queue_notification_email(recipient, 'coordinator_assignment', new.event_id, notice_subject, notice_body);
      if outbox_id is not null then
        update public.coordinator_assignment_notifications set email_outbox_id = outbox_id where id = notice_id;
      end if;
    end if;
  end loop;
  return new;
end $$;

commit;
