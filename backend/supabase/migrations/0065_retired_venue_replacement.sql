-- US20 AC3. Reserved 0065. Retired is the existing venue status, not a new schedule.
-- A proposal reserves no new slots; the original reservation survives until approval.
begin;
create table if not exists public.venue_replacement_requests (
 id uuid primary key default gen_random_uuid(),
 original_booking_id uuid not null references public.venue_bookings(id),
 target_venue_id uuid not null references public.venues(id),
 source_version text not null,
 proposed_by uuid not null references public.profiles(id),
 proposed_by_name text not null,
 proposed_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(btrim(reason))>0),
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 replacement_booking_id uuid unique references public.venue_bookings(id),
 decided_by uuid references public.profiles(id),
 decided_by_name text,
 decided_at timestamptz,
 decision_note text,
 check((status='approved')=(replacement_booking_id is not null)),
 check((status='pending' and decided_by is null and decided_at is null and decision_note is null)
  or (status<>'pending' and decided_by is not null and decided_by_name is not null
   and decided_at is not null and nullif(btrim(decision_note),'') is not null))
);
create unique index if not exists venue_replacement_pending_original
 on public.venue_replacement_requests(original_booking_id) where status='pending';
alter table public.venue_replacement_requests enable row level security;
revoke all on public.venue_replacement_requests from public,anon,authenticated;
grant select on public.venue_replacement_requests to authenticated;
drop policy if exists venue_replacement_read on public.venue_replacement_requests;
create policy venue_replacement_read on public.venue_replacement_requests for select to authenticated using(
 public.current_user_role()='venue_staff' or
 (public.current_user_role()='coordinator' and exists(select 1 from public.venue_bookings b
 join public.events e on e.id=b.event_id where b.id=original_booking_id and e.coordinator_id=auth.uid())));

create or replace function public.venue_replacement_source_version(p_booking uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(b),to_jsonb(e),to_jsonb(v),to_jsonb(r))::text)
 from public.venue_bookings b join public.events e on e.id=b.event_id
 join public.venues v on v.id=b.venue_id
 left join public.event_venue_requirements r on r.event_id=e.id where b.id=p_booking;
$$;
revoke all on function public.venue_replacement_source_version(uuid) from public,anon,authenticated;
create or replace function public.venue_replacement_version(p_request uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(q),public.venue_replacement_source_version(q.original_booking_id),
 to_jsonb(v),(select jsonb_agg(to_jsonb(l) order by l.layout) from public.venue_layouts l where l.venue_id=v.id))::text)
 from public.venue_replacement_requests q join public.venues v on v.id=q.target_venue_id where q.id=p_request;
$$;
revoke all on function public.venue_replacement_version(uuid) from public,anon,authenticated;

create or replace function public.get_venue_replacements()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text:=public.current_user_role(); result jsonb;
begin
 if auth.uid() is null or actor_role not in ('coordinator','venue_staff') or actor_role is null then
  raise exception 'Coordinator or Venue Staff required' using errcode='42501';
 end if;
 select jsonb_build_object(
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'eventName',coalesce(e.name,e.purpose,e.reference),
   'venueName',v.name,'version',public.venue_replacement_source_version(b.id),'details',public.event_planning_values(e)) order by b.created_at,b.id)
  from public.venue_bookings b join public.events e on e.id=b.event_id join public.venues v on v.id=b.venue_id
  where actor_role='coordinator' and e.coordinator_id=auth.uid() and e.status in ('approved','planning')
   and v.status='retired' and (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
   and not exists(select 1 from public.venue_replacement_requests q where q.original_booking_id=b.id and q.status='pending')),'[]'::jsonb),
 'venues',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'capacity',v.capacity,'location',v.location)
   order by v.name,v.id) from public.venues v where v.status='active'),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'originalBookingId',b.id,'eventName',coalesce(e.name,e.purpose,e.reference),
   'originalVenue',v.name,'targetVenue',target.name,'targetVenueId',target.id,'reason',q.reason,'status',q.status,
   'proposedBy',q.proposed_by_name,'proposedAt',q.proposed_at,'decidedBy',q.decided_by_name,'decidedAt',q.decided_at,
   'decisionNote',q.decision_note,'replacementBookingId',q.replacement_booking_id,
   'version',public.venue_replacement_version(q.id),'sourceChanged',q.source_version is distinct from public.venue_replacement_source_version(b.id),
   'details',public.event_planning_values(e),'targetCapacity',target.capacity,'targetLayout',target.layout,
   'targetAccessibility',target.accessibility,'targetFacilities',target.facility)
   order by q.proposed_at desc,q.id)
  from public.venue_replacement_requests q join public.venue_bookings b on b.id=q.original_booking_id
  join public.events e on e.id=b.event_id join public.venues v on v.id=b.venue_id
  join public.venues target on target.id=q.target_venue_id
  where actor_role='venue_staff' or e.coordinator_id=auth.uid()),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_venue_replacements() from public,anon;
grant execute on function public.get_venue_replacements() to authenticated;

create or replace function public.propose_venue_replacement(p_booking uuid,p_target uuid,p_version text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.venue_bookings; e public.events; new_id uuid;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
  raise exception 'Assigned coordinator required' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Reason required' using errcode='22023'; end if;
 select * into b from public.venue_bookings where id=p_booking;
 if not found then raise exception 'Booking unavailable' using errcode='42501'; end if;
 -- Same venue -> event -> booking order as approval; lock both venues in UUID order.
 perform 1 from public.venues where id in (b.venue_id,p_target) order by id for update;
 select * into e from public.events where id=b.event_id for update;
 select * into b from public.venue_bookings where id=p_booking for update;
 if e.coordinator_id is distinct from auth.uid() then raise exception 'Assigned coordinator required' using errcode='42501'; end if;
 if p_version is distinct from public.venue_replacement_source_version(b.id) then
  raise exception 'Booking or event changed; reload' using errcode='40001'; end if;
 if e.status not in ('approved','planning') or not (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
 or not exists(select 1 from public.venues where id=b.venue_id and status='retired')
 or p_target=b.venue_id or not exists(select 1 from public.venues where id=p_target and status='active') then
  raise exception 'Choose an active replacement for a retired venue during planning' using errcode='22023'; end if;
 insert into public.venue_replacement_requests(original_booking_id,target_venue_id,source_version,proposed_by,proposed_by_name,reason)
 select b.id,p_target,p_version,auth.uid(),coalesce(nullif(full_name,''),'Coordinator'),btrim(p_reason)
 from public.profiles where id=auth.uid() returning id into new_id;
 return new_id;
end $$;
revoke all on function public.propose_venue_replacement(uuid,uuid,text,text) from public,anon;
grant execute on function public.propose_venue_replacement(uuid,uuid,text,text) to authenticated;

create or replace function public.decide_venue_replacement(p_request uuid,p_version text,p_decision text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.venue_replacement_requests; b public.venue_bookings; e public.events;
 actor_role text:=public.current_user_role(); new_booking uuid;
begin
 if auth.uid() is null or actor_role is null or actor_role not in ('coordinator','venue_staff') then
  raise exception 'Authorised reviewer required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','withdrawn') or nullif(btrim(p_note),'') is null then
  raise exception 'Decision and note required' using errcode='22023'; end if;
 if (p_decision='withdrawn' and actor_role<>'coordinator') or (p_decision<>'withdrawn' and actor_role<>'venue_staff') then
  raise exception 'Only Venue Staff approve/reject; coordinators withdraw' using errcode='42501'; end if;
 select * into q from public.venue_replacement_requests where id=p_request;
 if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
 select * into b from public.venue_bookings where id=q.original_booking_id;
 perform 1 from public.venues where id in (b.venue_id,q.target_venue_id) order by id for update;
 select * into e from public.events where id=b.event_id for update;
 select * into b from public.venue_bookings where id=b.id for update;
 select * into q from public.venue_replacement_requests where id=p_request for update;
 if actor_role='coordinator' and e.coordinator_id is distinct from auth.uid() then
  raise exception 'Assigned coordinator required' using errcode='42501'; end if;
 if q.status<>'pending' or p_version is distinct from public.venue_replacement_version(q.id) then
  raise exception 'Request changed; reload' using errcode='40001'; end if;
 if p_decision='approved' then
  if q.source_version is distinct from public.venue_replacement_source_version(b.id) then
   raise exception 'Source changed; withdraw or reject and submit a fresh proposal' using errcode='40001'; end if;
  if e.status not in ('approved','planning') or not (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
  or not exists(select 1 from public.venues where id=b.venue_id and status='retired')
  or not exists(select 1 from public.profiles where id=e.coordinator_id and role='coordinator') then
   raise exception 'Original booking is no longer eligible' using errcode='22023'; end if;
  -- Cancel inside the transaction to free the one-pending-hold index, but preserve
  -- the old claims until the new approval succeeds. Any error restores everything.
  update public.venue_bookings set status='cancelled' where id=b.id;
  insert into public.venue_bookings(event_id,venue_id,requested_by,status)
   values(e.id,q.target_venue_id,e.coordinator_id,'pending_approval') returning id into new_booking;
  -- Existing US10 operation owns target-active, timing, block/claim and stale checks.
  perform public.approve_venue_booking(new_booking,public.venue_booking_review_version(new_booking));
  delete from public.venue_slot_claims where booking_id=b.id;
 end if;
 update public.venue_replacement_requests set status=p_decision,replacement_booking_id=new_booking,
  decided_by=auth.uid(),decided_by_name=(select coalesce(nullif(full_name,''),'Reviewer') from public.profiles where id=auth.uid()),
  decided_at=clock_timestamp(),decision_note=btrim(p_note) where id=q.id;
 return q.id;
end $$;
revoke all on function public.decide_venue_replacement(uuid,text,text,text) from public,anon;
grant execute on function public.decide_venue_replacement(uuid,text,text,text) to authenticated;
commit;
