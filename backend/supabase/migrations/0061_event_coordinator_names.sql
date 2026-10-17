-- 0061_event_coordinator_names.sql — show which Coordinator an event is assigned to, by name.
--
-- The Requests list only knew a coordinator_id, so it could say "assigned to you" but never who
-- else had an event. Names live in profiles, which only Coordinators may read, so an Organiser or
-- an Operations Manager could not look them up. This returns just the name of the assigned
-- Coordinator, and only to the people who may already see that event, instead of widening who can
-- read profiles (which would also hand out every profile's other columns). No table changes.
-- Safe to re-run.
begin;

-- Coordinators, Coordinator Leads and Operations Managers see every event they are shown in the
-- Requests list; an Organiser sees only their own. Anyone else, and a visitor, gets no rows. The
-- list is capped so one call cannot be used to scan the whole table.
create or replace function public.event_coordinator_names(p_event_ids uuid[])
returns table (event_id uuid, coordinator_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.full_name
  from public.events e
  join public.profiles p on p.id = e.coordinator_id
  where e.id = any (p_event_ids)
    and cardinality(p_event_ids) <= 500
    and (
      public.current_user_role() in ('coordinator', 'coordinator_lead', 'operations_manager')
      or (public.current_user_role() = 'organiser' and e.organiser_id = auth.uid())
    );
$$;

revoke execute on function public.event_coordinator_names(uuid[]) from public, anon;
grant execute on function public.event_coordinator_names(uuid[]) to authenticated;

commit;
