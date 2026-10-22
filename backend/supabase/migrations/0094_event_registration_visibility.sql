-- US54 (SCRUM-246, SCRUM-251/252): AC-054.1 to AC-054.4 — the Organiser running an event,
-- the Coordinator assigned to it and the Organiser's colleagues can see who has registered.
--
-- 0043 gave event_registrations one policy, event_registrations_select_own, which scopes an
-- Attendee to their own rows. Nobody else has ever been able to read the table. This adds
-- that read path, and only a read path: the table has SELECT granted and nothing else, so
-- AC-054.4's "but not change" needs no new rule.
--
-- Depends on 0078 for current_user_client_org(). Apply US31 first; without it the
-- colleague clause silently matches nobody.

begin;

-- ---------------------------------------------------------------------------
-- Who may see an event's registrations
-- ---------------------------------------------------------------------------
-- Three audiences, one predicate, so the list and any later addition cannot drift apart:
-- the Organiser responsible for the event (AC-054.1), the Coordinator assigned to it
-- (AC-054.3), and an Organiser in the same client organisation (AC-054.4).
--
-- The colleague clause reuses current_user_client_org() from 0078 rather than reading
-- profiles.client_org_id directly. That function resolves role before organisation, which
-- matters because 0069's CHECK is one-directional: a Coordinator can still carry a
-- client_org_id from a spell as an Organiser, and reading the column raw would let them in
-- through the colleague door rather than the assigned-coordinator one.
create or replace function public.can_view_event_registrations(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.events e
      join public.profiles owner on owner.id = e.organiser_id
     where e.id = p_event_id
       and (
         -- AC-054.1: the Organiser responsible for the event.
         e.organiser_id = auth.uid()
         -- AC-054.3: the Coordinator currently assigned to it. Reuses 0024's helper so
         -- reassignment moves this access with it, as it does everywhere else.
         or public.is_assigned_event_coordinator(p_event_id)
         -- AC-054.4: an Organiser in the same client organisation.
         or (public.current_user_client_org() is not null
             and owner.client_org_id = public.current_user_client_org())
       )
  );
$$;

revoke all on function public.can_view_event_registrations(uuid) from public, anon;
grant execute on function public.can_view_event_registrations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The registrations themselves
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is not a preference here, it is the only option: AC-054.1 asks for the
-- attendee's email, which lives in auth.users, and no browser role can read that table at
-- all. A widened policy on event_registrations could expose the row but never the address.
--
-- What the row does NOT carry is as deliberate as what it does. phone,
-- dietary_requirements, accessibility_needs and prerequisites_confirmed are answers the
-- Attendee gave to take part, not roll-call information, and no acceptance criterion asks
-- for them. Adding a column here is the decision to share it with everyone the predicate
-- above admits, colleagues included.
--
-- Withdrawn registrations are returned rather than filtered: AC-054.2 wants them marked,
-- not hidden, so the caller can see that someone pulled out instead of wondering whether
-- they ever signed up. Counting is the reader's job, which is why status comes back.
create or replace function public.list_event_registrations(p_event_id uuid)
returns table (
  id uuid, attendee_name text, attendee_email text,
  status text, registered_at timestamptz, withdrawn_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.full_name, u.email,
         r.status, r.registered_at, r.withdrawn_at
    from public.event_registrations r
    join public.profiles p on p.id = r.attendee_id
    join auth.users u on u.id = r.attendee_id
   where r.event_id = p_event_id
     and public.can_view_event_registrations(p_event_id)
   -- Active first, then most recent, so the people who are coming lead the list.
   order by (r.status = 'registered') desc, r.registered_at desc, r.id;
$$;

revoke all on function public.list_event_registrations(uuid) from public, anon;
grant execute on function public.list_event_registrations(uuid) to authenticated;

commit;
