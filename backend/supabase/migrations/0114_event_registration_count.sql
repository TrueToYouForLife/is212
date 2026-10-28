-- US54 (SCRUM-246) follow-up: AC-054.4 — a colleague in the same client organisation
-- learns how many people have registered, and not who they are.
--
-- Apply after 0094. Safe to replay.
--
-- 0094 gave all three audiences the same access: the Organiser who owns the event, the
-- Coordinator assigned to it, and an Organiser in the same client organisation could each
-- read the full roll call, names and email addresses included. The organisation view then
-- showed a colleague only a count, which made the privacy a property of the screen rather
-- than of the database — anyone who could call the RPC could still read the names, whatever
-- the card chose to render.
--
-- Team decision (27 October): a colleague may know the number, not the people. So the one
-- predicate becomes two, one per level of detail, and the colleague clause moves to the
-- narrower of them.
--
-- This also makes event_registration_count exist at all. registrationCountService.ts has
-- been calling it since the organisation view was built; it was never written, so every
-- colleague saw "Registration count unavailable" and nothing said why.

begin;

-- ---------------------------------------------------------------------------
-- Who may read the roll call itself
-- ---------------------------------------------------------------------------
-- Narrowed: the colleague clause is gone. The Organiser running the event needs the names
-- to run it, and the Coordinator reviewing it needs them to review it; a colleague planning
-- around a sister event needs neither.
--
-- list_event_registrations is deliberately NOT restated here. It already calls this
-- function, so narrowing the predicate narrows the list — which is the whole point of 0094
-- having put the rule in one place, and means there is no second copy to drift.
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
     where e.id = p_event_id
       and (
         -- AC-054.1: the Organiser responsible for the event.
         e.organiser_id = auth.uid()
         -- AC-054.3: the Coordinator currently assigned to it. Reuses 0024's helper so
         -- reassignment moves this access with it, as it does everywhere else.
         or public.is_assigned_event_coordinator(p_event_id)
       )
  );
$$;

revoke all on function public.can_view_event_registrations(uuid) from public, anon;
grant execute on function public.can_view_event_registrations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Who may know the number
-- ---------------------------------------------------------------------------
-- Everyone who may read the list, plus a colleague in the same client organisation. Stated
-- as "can view, or is a colleague" rather than by listing all three again, so the two can
-- never disagree about the first two audiences.
--
-- The colleague clause reuses current_user_client_org() from 0078 rather than reading
-- profiles.client_org_id directly. That function resolves role before organisation, which
-- matters because 0069's CHECK is one-directional: a Coordinator can still carry a
-- client_org_id from a spell as an Organiser, and reading the column raw would let them in
-- through the colleague door rather than the assigned-coordinator one.
create or replace function public.can_count_event_registrations(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_event_registrations(p_event_id)
      or exists (
           select 1
             from public.events e
             join public.profiles owner on owner.id = e.organiser_id
            where e.id = p_event_id
              and public.current_user_client_org() is not null
              and owner.client_org_id = public.current_user_client_org()
         );
$$;

revoke all on function public.can_count_event_registrations(uuid) from public, anon;
grant execute on function public.can_count_event_registrations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The number
-- ---------------------------------------------------------------------------
-- Active registrations only. A withdrawal is not a place taken, and AC-054.2 already
-- settled that the count excludes them; the owner's list is where a withdrawal stays
-- visible and marked.
--
-- Anyone else gets 0, not an error, which is indistinguishable from an event nobody has
-- registered for. That is the same deliberate ambiguity 0094 chose for the list: a stranger
-- must not be able to use the difference between "refused" and "empty" to learn that an
-- event exists.
create or replace function public.event_registration_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.event_registrations r
   where r.event_id = p_event_id
     and r.status = 'registered'
     and public.can_count_event_registrations(p_event_id);
$$;

revoke all on function public.event_registration_count(uuid) from public, anon;
grant execute on function public.event_registration_count(uuid) to authenticated;

commit;
