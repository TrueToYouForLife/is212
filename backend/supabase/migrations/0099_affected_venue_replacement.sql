-- US48: replacement requests for blocked or retired venues. Claimed 0099.
-- Requires 0075 and 0098. Existing proposals/history remain; old source versions
-- may require withdrawal/rejection and a fresh proposal after deployment.
begin;

alter table public.venue_booking_flags
 add column if not exists resolved_by uuid references public.profiles(id),
 add column if not exists replacement_booking_id uuid references public.venue_bookings(id);
alter table public.arrangement_review_flags
 add column if not exists replacement_booking_id uuid references public.venue_bookings(id);

-- Both review stores remain authoritative. Do not migrate or duplicate their history.
create or replace function public.venue_replacement_reasons(p_booking uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(reason order by store,id),'[]'::jsonb) from (
  select 'booking' store,f.id,jsonb_build_object('id',f.id,'store','booking','code',f.cause,'detail',f.detail) reason
  from public.venue_booking_flags f where f.booking_id=p_booking and f.status='open'
   and f.cause in ('venue_blocked','venue_retired')
  union all
  select 'arrangement',f.id,jsonb_build_object('id',f.id,'store','arrangement','code',f.reason_code,'detail',f.detail)
  from public.arrangement_review_flags f where f.venue_booking_id=p_booking and f.status='open'
   and f.reason_code='venue_retired'
  union all
  -- Older retired venues may predate retirement reviews or have a manually closed review.
  select 'venue',v.id,jsonb_build_object('id',v.id,'store','venue','code','venue_retired',
   'detail',coalesce(nullif(btrim(v.retirement_note),''),'Venue retired; alternative arrangements required.'))
  from public.venue_bookings b join public.venues v on v.id=b.venue_id
  where b.id=p_booking and v.status='retired' and not exists(
   select 1 from public.arrangement_review_flags f where f.venue_booking_id=b.id
    and f.status='open' and f.reason_code='venue_retired')
 ) reasons;
$$;
revoke all on function public.venue_replacement_reasons(uuid) from public,anon,authenticated;

create or replace function public.venue_replacement_source_version(p_booking uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(b),to_jsonb(e),to_jsonb(v),to_jsonb(r),public.venue_replacement_reasons(b.id))::text)
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
   'venueName',v.name,'eventId',e.id,'needsReplacement',true,'reasons',public.venue_replacement_reasons(b.id),'version',public.venue_replacement_source_version(b.id),'details',public.event_planning_values(e)) order by b.created_at,b.id)
  from public.venue_bookings b join public.events e on e.id=b.event_id join public.venues v on v.id=b.venue_id
  where actor_role='coordinator' and e.coordinator_id=auth.uid() and e.status in ('approved','planning','confirmed') and e.proposed_start>now()
   and public.venue_replacement_reasons(b.id)<>'[]'::jsonb and (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
   and not exists(select 1 from public.venue_replacement_requests q where q.original_booking_id=b.id and q.status='pending')),'[]'::jsonb),
 'affectedBookings',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'eventId',e.id,
   'eventName',coalesce(e.name,e.purpose,e.reference),'venueName',v.name,'needsReplacement',true,
   'reasons',public.venue_replacement_reasons(b.id),'version',public.venue_replacement_source_version(b.id),
   'details',public.event_planning_values(e)) order by b.created_at,b.id)
  from public.venue_bookings b join public.events e on e.id=b.event_id join public.venues v on v.id=b.venue_id
  where (actor_role='venue_staff' or e.coordinator_id=auth.uid())
   and e.status in ('approved','planning','confirmed') and e.proposed_start>now()
   and (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
   and public.venue_replacement_reasons(b.id)<>'[]'::jsonb),'[]'::jsonb),
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
 if (e.status not in ('approved','planning','confirmed') or e.proposed_start is null or e.proposed_start<=now()) or not (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
 or public.venue_replacement_reasons(b.id)='[]'::jsonb
 or p_target=b.venue_id or not exists(select 1 from public.venues where id=p_target and status='active') then
  raise exception 'Choose an active replacement for an affected upcoming booking' using errcode='22023'; end if;
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
  if (e.status not in ('approved','planning','confirmed') or e.proposed_start is null or e.proposed_start<=now()) or not (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
  or public.venue_replacement_reasons(b.id)='[]'::jsonb
  or not exists(select 1 from public.profiles where id=e.coordinator_id and role='coordinator') then
   raise exception 'Original booking is no longer eligible' using errcode='22023'; end if;
  -- Insert an inactive target first so its real FK can be recorded without freeing
  -- the original's one-pending-hold index. No target claims exist until normal approval.
  insert into public.venue_bookings(event_id,venue_id,requested_by,status)
   values(e.id,q.target_venue_id,e.coordinator_id,'cancelled') returning id into new_booking;
  -- This checked, browser-unwritable link identifies replacement cancellation to the
  -- shared flag trigger and the narrowly scoped Confirmed-event approval exception.
  -- Every write below rolls back if normal approval or review resolution fails.
  update public.venue_replacement_requests set status='approved',replacement_booking_id=new_booking,
   decided_by=auth.uid(),decided_by_name=(select coalesce(nullif(full_name,''),'Reviewer') from public.profiles where id=auth.uid()),
   decided_at=clock_timestamp(),decision_note=btrim(p_note) where id=q.id;
  update public.venue_bookings set status='cancelled' where id=b.id;
  update public.venue_bookings set status='pending_approval' where id=new_booking;
  perform public.approve_venue_booking(new_booking,public.venue_booking_review_version(new_booking));
  delete from public.venue_slot_claims where booking_id=b.id;
  update public.venue_booking_flags set status='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),
   replacement_booking_id=new_booking,resolution='Replaced by booking '||new_booking::text||': '||btrim(p_note)
   where booking_id=b.id and status='open' and cause in ('venue_blocked','venue_retired');
  update public.arrangement_review_flags set status='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),
   replacement_booking_id=new_booking,resolution_method='corrected',
   resolution='Replaced by booking '||new_booking::text||': '||btrim(p_note)
   where venue_booking_id=b.id and status='open' and reason_code='venue_retired';
 end if;
 if p_decision<>'approved' then
 update public.venue_replacement_requests set status=p_decision,replacement_booking_id=new_booking,
  decided_by=auth.uid(),decided_by_name=(select coalesce(nullif(full_name,''),'Reviewer') from public.profiles where id=auth.uid()),
  decided_at=clock_timestamp(),decision_note=btrim(p_note) where id=q.id;
 end if;
 return q.id;
end $$;
revoke all on function public.decide_venue_replacement(uuid,text,text,text) from public,anon;
grant execute on function public.decide_venue_replacement(uuid,text,text,text) to authenticated;

-- Preserve normal cancellation cleanup outside a successful replacement.
create or replace function public.resolve_flags_when_booking_ends()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('cancelled', 'rejected', 'expired')
     and old.status is distinct from new.status
     and not exists(select 1 from public.venue_replacement_requests q
       where q.original_booking_id=new.id and q.status='approved') then
    update public.venue_booking_flags
    set status = 'resolved', resolved_at = now(), resolution = 'Booking ' || new.status
    where booking_id = new.id and status = 'open';
  end if;
  return new;
end;
$$;
revoke execute on function public.resolve_flags_when_booking_ends()
  from public, anon, authenticated;


-- Keep the current quarter-hour approval checks; only linked replacements gain eligibility.
create or replace function public.approve_venue_booking(p_booking_id uuid,p_expected_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.venue_bookings; e public.events; venue_status text; initial_version text;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
   raise exception 'Only Venue Staff can approve bookings' using errcode='42501';
 end if;
 select * into b from public.venue_bookings where id=p_booking_id;
 if not found then raise exception 'Booking unavailable' using errcode='P0002'; end if;
 initial_version := public.venue_booking_review_version(b.id);
 -- Same first lock as block_venue; then lock timing and the pending decision.
 select status into venue_status from public.venues where id=b.venue_id for update;
 select * into e from public.events where id=b.event_id for update;
 perform 1 from public.venue_bookings where id=b.id for update;
 if p_expected_version is null or p_expected_version is distinct from initial_version
   or initial_version is distinct from public.venue_booking_review_version(b.id) then
   raise exception 'Request changed; reload before approving' using errcode='40001';
 end if;
 select * into b from public.venue_bookings where id=p_booking_id;
 if b.status<>'pending_approval' then raise exception 'Booking is not pending' using errcode='22023'; end if;
 if venue_status<>'active' or (e.status not in ('approved','planning') and not (
   e.status='confirmed' and e.proposed_start>now() and exists(
    select 1 from public.venue_replacement_requests q
    join public.venue_bookings original on original.id=q.original_booking_id
    where q.replacement_booking_id=b.id and q.status='approved' and q.decided_by=auth.uid()
     and q.target_venue_id=b.venue_id and original.event_id=e.id and original.status='cancelled'
   ))) then
   raise exception 'Event or venue is not bookable' using errcode='22023';
 end if;
 if not exists(select 1 from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end)) then
   raise exception 'Complete bookable timing is required' using errcode='22023';
 end if;
 if exists(select 1 from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end) c
   join public.venue_closures v on v.venue_id=b.venue_id and v.removed_at is null
   and c.slot_date between v.starts_on and v.ends_on and c.slot=any(v.slots)) then
   raise exception 'Venue is blocked' using errcode='23514';
 end if;
 -- Never discard unrelated or unexpected claims to make approval appear successful.
 if exists(select 1 from public.venue_slot_claims s where s.booking_id=b.id and not exists(
   select 1 from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end) c
   where c.slot_date=s.slot_date and c.slot=s.slot and c.kind=s.kind)) then
   raise exception 'Requested slots changed; reload and resubmit' using errcode='40001';
 end if;
 -- Unique ledger key arbitrates races with holds, including claims arriving after reads.
 insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end) c
 where not exists(select 1 from public.venue_slot_claims s where s.booking_id=b.id
   and s.slot_date=c.slot_date and s.slot=c.slot and s.kind=c.kind);
 update public.venue_bookings set status='confirmed',reviewed_by=auth.uid(),reviewed_at=clock_timestamp()
 where id=b.id and status='pending_approval';
 if not found then raise exception 'Decision already made' using errcode='40001'; end if;
 return b.id;
end $$;
revoke execute on function public.approve_venue_booking(uuid,text) from public,anon;
grant execute on function public.approve_venue_booking(uuid,text) to authenticated;


commit;
