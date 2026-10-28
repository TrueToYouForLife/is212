-- US33 Choose notification channels by type (SCRUM-230), slice 2b: US13 equipment requirement changes moved onto the
-- sending helper (0079). notify_equipment_requirement_change(), last defined in 0024, is recreated unchanged except
-- for how it sends its notice.
--
-- In-app only, as before (its email arrives with 0093). A Technical Support member who turns
-- this notice off in-app no longer gets it; with no choice made, everyone gets it, as before.
-- Owner of the function: Siew Yuanlong (US13).
-- Apply after 0079. Safe to replay.
begin;

create or replace function public.notify_equipment_requirement_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed public.event_equipment_requirements;
  v_action text;
begin
  if tg_op = 'INSERT' then
    changed := new; v_action := 'added';
  elsif tg_op = 'DELETE' then
    -- A cascade from a deleted event leaves nothing to notify about.
    if not exists (select 1 from public.events where id = old.event_id) then return null; end if;
    changed := old; v_action := 'removed';
  else
    if (new.type_id, new.quantity, new.technical_notes, new.essential)
       is not distinct from (old.type_id, old.quantity, old.technical_notes, old.essential) then
      return null;
    end if;
    changed := new; v_action := 'changed';
  end if;

  insert into public.equipment_requirement_notifications
    (requirement_id, event_id, recipient_id, action, type_name, quantity)
  select changed.id, changed.event_id, p.id, v_action, t.name, changed.quantity
  from public.profiles p
  join public.equipment_types t on t.id = changed.type_id
  where p.role = 'tech_support'
    -- US33: only Technical Support staff who have this in-app notice on.
    and (select c.in_app from public.notification_channels(p.id, 'equipment_requirement_change') c);
  return null;
end $$;

commit;
