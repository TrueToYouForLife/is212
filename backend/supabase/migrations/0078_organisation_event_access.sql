-- US31 slice 2 (SCRUM-228, SCRUM-256/258/260): AC-031.1 to AC-031.3 — colleagues in the
-- same client organisation can see an Organiser's events, nobody outside it can, and
-- seeing is all a colleague may do.
--
-- Slice 1 (0069) recorded which organisation each Organiser belongs to. This reads it.
-- 0069 must be applied first: without it client_org_id is the unused column 0001 declared.
--
-- Nothing here grants a write. AC-031.2's "cannot edit, request changes or withdraw" was
-- already true before this migration — every Organiser write path is scoped to
-- organiser_id = auth.uid() (events_update_own and events_insert_own in 0006,
-- organisers_insert_own_change_requests in 0007). Widening the read must not disturb that,
-- which is why the read is a projection rather than a policy change.

begin;

-- ---------------------------------------------------------------------------
-- Whose organisation is the caller in?
-- ---------------------------------------------------------------------------
-- One place encodes the rule "role first, then organisation", and everything else calls
-- it. That ordering is load-bearing: 0069's CHECK is deliberately one-directional, so a
-- Coordinator may still carry a client_org_id left over from a spell as an Organiser.
-- Reading the column without checking the role would quietly admit them to a client's
-- events. Role is the authority on what someone may see; this column only says which
-- client an Organiser belongs to.
create or replace function public.current_user_client_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.client_org_id
    from public.profiles p
   where p.id = auth.uid()
     and p.role = 'organiser';
$$;

revoke execute on function public.current_user_client_org() from public, anon;
grant execute on function public.current_user_client_org() to authenticated;

-- ---------------------------------------------------------------------------
-- The organisation's events
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER with a fixed column list, not a widened policy on events. Two reasons,
-- and the second is the one that matters:
--
--   1. 0005 revokes table-wide SELECT on events and grants an explicit column list to
--      `authenticated`. Column grants are per-table, so they cannot say "the owner sees
--      review_note, a colleague does not" — widening events_select_own would hand every
--      colleague the coordinator's review feedback and the event's special arrangements
--      along with the fields they actually need.
--   2. profiles_select_own (0001) lets an Organiser read only their own profile row, so
--      an RLS-based approach could not show a colleague's name without widening a second
--      table as well. Running as owner, this joins profiles without loosening anything.
--
-- The returned column list IS the access control, auditable in one place. Adding a column
-- here is the decision to share it; nothing leaks by default.
--
-- Drafts are excluded. 0005 calls them "private working copies, including when accessed by
-- URL", and that is as true between colleagues as between strangers — an Organiser's own
-- drafts are reached through /drafts, not through a shared organisation view.
--
-- is_mine distinguishes AC-031.1 from AC-031.2 for the UI: the caller may act on their own
-- events and only look at a colleague's. It is derived here rather than compared in the
-- browser so there is one definition of "mine".
create or replace function public.list_organisation_events()
returns table (
  id uuid, reference text, name text, status text,
  proposed_start timestamptz, proposed_end timestamptz,
  organiser_name text, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.reference, e.name, e.status,
         e.proposed_start, e.proposed_end,
         p.full_name,
         e.organiser_id = auth.uid()
    from public.events e
    join public.profiles p on p.id = e.organiser_id
   where public.current_user_client_org() is not null
     and p.client_org_id = public.current_user_client_org()
     and e.status <> 'draft'
   order by e.proposed_start desc nulls last, e.id;
$$;

revoke execute on function public.list_organisation_events() from public, anon;
grant execute on function public.list_organisation_events() to authenticated;

-- AC-031.3's "including through a direct link". Returning no row rather than raising is
-- deliberate: an error that distinguished "not yours" from "does not exist" would confirm
-- that another client's event exists, which is the thing the criterion forbids. Same
-- stance as get_open_event (0043/0058) takes for Attendees.
--
-- The owner of the event is matched on their organisation, not on their current role: an
-- Organiser who later becomes a Coordinator leaves their events with the client they ran
-- them for, and a colleague should still see them. Only the CALLER must be an Organiser.
create or replace function public.get_organisation_event(p_event_id uuid)
returns table (
  id uuid, reference text, name text, status text,
  purpose text, event_type text, expected_attendance integer,
  proposed_start timestamptz, proposed_end timestamptz,
  organiser_name text, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.reference, e.name, e.status,
         e.purpose, e.event_type, e.expected_attendance,
         e.proposed_start, e.proposed_end,
         p.full_name,
         e.organiser_id = auth.uid()
    from public.events e
    join public.profiles p on p.id = e.organiser_id
   where e.id = p_event_id
     and public.current_user_client_org() is not null
     and p.client_org_id = public.current_user_client_org()
     and e.status <> 'draft';
$$;

revoke execute on function public.get_organisation_event(uuid) from public, anon;
grant execute on function public.get_organisation_event(uuid) to authenticated;

commit;
