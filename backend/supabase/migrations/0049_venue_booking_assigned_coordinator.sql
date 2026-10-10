-- US17 AC1 / SCRUM-250: coordinators cannot hold a venue for an unassigned event.
-- Apply after 0048. Safe to replay.
--
-- 0036 recreated bookings_insert_coordinator with `e.coordinator_id = auth.uid() or
-- e.coordinator_id is null`, so any coordinator could place a new hold for an event still
-- in the Lead's queue. 0047 rekeyed the update and slot-claim policies on the current
-- assignment but left this insert policy as it was.
--
-- Only new holds change. 0047's legacy path is untouched: a booking that already exists for
-- an unassigned event stays manageable by the coordinator who placed it.
begin;

-- Two permissive INSERT policies are OR-ed, so 0036's version has to be replaced, not
-- supplemented. is_assigned_event_coordinator() (0024) also checks the coordinator role.
drop policy if exists bookings_insert_coordinator on public.venue_bookings;
create policy bookings_insert_coordinator on public.venue_bookings
  for insert to authenticated
  with check (
    public.is_assigned_event_coordinator(event_id)
    and requested_by = auth.uid()
    and status = 'held'
    and exists (
      select 1 from public.events e
      where e.id = venue_bookings.event_id
        and e.status in ('approved', 'planning')
    )
  );

commit;
