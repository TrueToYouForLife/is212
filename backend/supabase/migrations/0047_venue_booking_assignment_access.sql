-- US17 AC4 / SCRUM-160: venue management follows the current event assignment.
-- Original requester remains history. US11 owner agreement is required before merge.
-- Preserve 0036's legacy unassigned-event path: only when coordinator_id is null
-- does the original requester retain management rights. Never fall back after reassignment.
begin;

drop policy if exists bookings_update_own_coordinator on public.venue_bookings;
create policy bookings_update_own_coordinator on public.venue_bookings
  for update to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and status in ('held', 'pending_approval')
    and exists (select 1 from public.events e
      where e.id = venue_bookings.event_id
        and coalesce(e.coordinator_id, venue_bookings.requested_by) = auth.uid())
  )
  with check (
    public.current_user_role() = 'coordinator'
    and status in ('held', 'pending_approval', 'cancelled')
    and exists (select 1 from public.events e
      where e.id = venue_bookings.event_id
        and coalesce(e.coordinator_id, venue_bookings.requested_by) = auth.uid())
  );

-- Access no longer depends on requested_by. Do not let the newly authorised
-- coordinator rewrite that historical identity or move a booking to another event.
create or replace function public.guard_coordinator_booking_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and public.current_user_role() = 'coordinator'
    and (new.id is distinct from old.id
      or new.event_id is distinct from old.event_id
      or new.venue_id is distinct from old.venue_id
      or new.requested_by is distinct from old.requested_by) then
    raise exception 'Booking identity and original requester cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_coordinator_booking_identity() from public, anon, authenticated;
drop trigger if exists venue_bookings_guard_coordinator_identity on public.venue_bookings;
create trigger venue_bookings_guard_coordinator_identity
  before update on public.venue_bookings
  for each row execute function public.guard_coordinator_booking_identity();

-- Slot writes must transfer too, otherwise the old requester could still free
-- or add calendar cells after the booking row itself becomes inaccessible.
drop policy if exists claims_insert_coordinator on public.venue_slot_claims;
create policy claims_insert_coordinator on public.venue_slot_claims
  for insert to authenticated
  with check (
    public.current_user_role() = 'coordinator'
    and kind in ('event', 'buffer')
    and exists (select 1 from public.venue_bookings b
      join public.events e on e.id = b.event_id
      where b.id = venue_slot_claims.booking_id
        and b.venue_id = venue_slot_claims.venue_id
        and coalesce(e.coordinator_id, b.requested_by) = auth.uid())
  );

drop policy if exists claims_delete_coordinator on public.venue_slot_claims;
create policy claims_delete_coordinator on public.venue_slot_claims
  for delete to authenticated
  using (
    public.current_user_role() = 'coordinator'
    and exists (select 1 from public.venue_bookings b
      join public.events e on e.id = b.event_id
      where b.id = venue_slot_claims.booking_id
        and (coalesce(e.coordinator_id, b.requested_by) = auth.uid()
          or (b.status = 'held' and b.hold_expires_at < now())))
  );

-- Venue Staff review policies, calendar reads and shared expired-hold cleanup
-- remain unchanged. No existing booking, assignment or slot data is rewritten.
commit;
