-- US17 AC4: management follows the current assignment, not the original requester.
-- Retain the legacy coordinator actions and Technical Support/manager reads.
begin;

drop policy if exists eq_bookings_select on public.equipment_bookings;
create policy eq_bookings_select on public.equipment_bookings
  for select to authenticated using (
    public.current_user_role() in ('tech_support', 'operations_manager')
    or public.is_assigned_event_coordinator(event_id)
  );

drop policy if exists eq_bookings_insert_coordinator on public.equipment_bookings;
create policy eq_bookings_insert_coordinator on public.equipment_bookings
  for insert to authenticated with check (
    public.is_assigned_event_coordinator(event_id)
    and requested_by = auth.uid() and status = 'submitted'
  );

drop policy if exists eq_bookings_cancel_coordinator on public.equipment_bookings;
create policy eq_bookings_cancel_coordinator on public.equipment_bookings
  for update to authenticated
  using (public.is_assigned_event_coordinator(event_id)
    and status in ('submitted', 'awaiting_coordinator'))
  with check (public.is_assigned_event_coordinator(event_id) and status = 'cancelled');

drop policy if exists eq_lines_select on public.equipment_booking_lines;
create policy eq_lines_select on public.equipment_booking_lines
  for select to authenticated using (
    public.current_user_role() in ('tech_support', 'operations_manager')
    or exists (select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id
        and public.is_assigned_event_coordinator(b.event_id))
  );

drop policy if exists eq_lines_insert_coordinator on public.equipment_booking_lines;
create policy eq_lines_insert_coordinator on public.equipment_booking_lines
  for insert to authenticated with check (
    public.current_user_role() = 'coordinator'
    and origin = 'requested' and status = 'pending'
    and quantity_reserved = 0 and assessed_by is null
    and exists (select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id
        and public.is_assigned_event_coordinator(b.event_id) and b.status = 'submitted')
  );

drop policy if exists eq_lines_respond_coordinator on public.equipment_booking_lines;
create policy eq_lines_respond_coordinator on public.equipment_booking_lines
  for update to authenticated
  using (public.current_user_role() = 'coordinator'
    and origin = 'suggested' and status = 'proposed'
    and exists (select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id
        and public.is_assigned_event_coordinator(b.event_id)))
  with check (origin = 'suggested' and status in ('pending', 'declined')
    and exists (select 1 from public.equipment_bookings b
      where b.id = equipment_booking_lines.booking_id
        and public.is_assigned_event_coordinator(b.event_id)));

-- Handover grants status actions, not permission to rewrite the original actor,
-- move records to another event/booking, or change staff reservation assessments.
create or replace function public.guard_coordinator_equipment_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Existing SECURITY DEFINER requirement/reservation functions perform their
  -- own checks and must retain their internal bookkeeping updates.
  if current_user = 'authenticated' and public.current_user_role() = 'coordinator'
     and (to_jsonb(new) - 'status' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Coordinators may only change the equipment decision status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_coordinator_equipment_update() from public, anon, authenticated;
drop trigger if exists equipment_bookings_guard_coordinator_update on public.equipment_bookings;
create trigger equipment_bookings_guard_coordinator_update
  before update on public.equipment_bookings
  for each row execute function public.guard_coordinator_equipment_update();
drop trigger if exists equipment_lines_guard_coordinator_update on public.equipment_booking_lines;
create trigger equipment_lines_guard_coordinator_update
  before update on public.equipment_booking_lines
  for each row execute function public.guard_coordinator_equipment_update();

commit;
