-- US52 (SCRUM-245): the assigned Coordinator turns attendee registration on or off.
-- "Registration enabled" is the existing events.registration_required (US15 D2): the
-- Organiser's request sets its starting value (AC-052.2), and register_for_event and
-- list_open_events already read it, so AC-052.3/.4 need no change to them. This adds the
-- one missing write path.
begin;

-- The only way to change the flag after submission. A direct UPDATE is refused for the
-- browser by guard_submitted_event_details (0008), so this SECURITY DEFINER function is
-- the single, checked route. It sets search_path = '' like every definer function here.
create or replace function public.set_event_registration(p_event_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Only the assigned coordinator can change registration' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Choose whether registration is enabled' using errcode = '22023';
  end if;

  -- Lock the row. register_for_event reads it FOR SHARE, so a registration cannot slip in
  -- between this switch being read as "on" and committed as "off".
  select e.status into current_status
  from public.events e
  where e.id = p_event_id and e.coordinator_id = auth.uid()
  for update;

  -- One error for "no such event" and "not your event" so ids cannot be probed.
  if not found then
    raise exception 'Only the assigned coordinator can change registration' using errcode = '42501';
  end if;

  -- Confirmed only (team decision, 17 Oct 2026): attendees cannot register before then, and
  -- the switch is meaningless once the event is cancelled or completed.
  if current_status <> 'confirmed' then
    raise exception 'Registration can only be changed for a Confirmed event' using errcode = '22000';
  end if;

  update public.events set registration_required = p_enabled where id = p_event_id;
end;
$$;

revoke execute on function public.set_event_registration(uuid, boolean) from public, anon;
grant execute on function public.set_event_registration(uuid, boolean) to authenticated;

commit;
