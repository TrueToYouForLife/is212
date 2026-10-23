-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US14 equipment reservation results moved onto the
-- sending helper (0079). queue_equipment_outcome_notice(), last defined in 0025, is recreated unchanged except
-- for how it sends its notice.
--
-- Same notice as before. The Coordinator's in-app notice and email follow their own choice,
-- within the system-wide switch, which stays on. With no choice made, both are sent, as before.
-- Owner of the function: Siew Yuanlong (US14).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.queue_equipment_outcome_notice(
  p_requirement public.event_equipment_requirements, p_event public.events, p_action text,
  p_reserved integer, p_alternative_type_id uuid, p_alternative_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_in_app boolean;
  v_email boolean;
  type_name text;
  alternative_name text;
  outbox_id uuid;
begin
  if p_event.coordinator_id is null then return; end if;
  -- US33: the Coordinator's own choice, within the system-wide switch.
  select c.in_app, c.email into v_in_app, v_email
  from public.notification_channels(p_event.coordinator_id, 'equipment_reservation_outcome') c;
  if not (v_in_app or v_email) then return; end if;
  select t.name into type_name from public.equipment_types t where t.id = p_requirement.type_id;
  select t.name into alternative_name from public.equipment_types t where t.id = p_alternative_type_id;

  if v_email then
    outbox_id := public.queue_notification_email(p_event.coordinator_id, 'equipment_reservation_outcome', p_event.id,
      'Equipment update for ' || coalesce(p_event.reference, 'your event'),
      format('%s for %s: %s of %s reserved.%s Sign in to ConnectSphere to see the details.',
        type_name, coalesce(p_event.reference, 'your event'), p_reserved, p_requirement.quantity,
        case when alternative_name is not null then ' Suggested alternative: ' || alternative_name || '.' else '' end));
  end if;

  -- The row is kept even with in-app off, so the email it queued stays traceable.
  insert into public.equipment_requirement_notifications (requirement_id, event_id, recipient_id, action,
    type_name, quantity, quantity_reserved, alternative_type_name, alternative_note, in_app_enabled, email_outbox_id)
  values (p_requirement.id, p_event.id, p_event.coordinator_id, p_action, type_name, p_requirement.quantity,
    p_reserved, alternative_name, nullif(btrim(p_alternative_note), ''), v_in_app, outbox_id);
end $$;

commit;
