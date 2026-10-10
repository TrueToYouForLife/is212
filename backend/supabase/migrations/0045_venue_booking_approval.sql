-- US10 Slice 3: reserved 0045. Atomic approval; no shared database deployment.
begin;
create or replace function public.venue_booking_review_version(p_booking_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(b),e.proposed_start,e.proposed_end,e.status,
   e.name,e.reference,e.expected_attendance,e.layout_preference,
   e.accessibility_requirements,e.special_arrangements,e.coordinator_id,to_jsonb(r))::text)
 from public.venue_bookings b join public.events e on e.id=b.event_id
 left join public.event_venue_requirements r on r.event_id=e.id where b.id=p_booking_id
$$;
revoke execute on function public.venue_booking_review_version(uuid) from public,anon,authenticated;

-- Requirement edits share the event lock with approval, including first-time inserts.
create or replace function public.lock_venue_requirement_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.event_id is distinct from old.event_id then
   raise exception 'Move requirements by deleting and inserting' using errcode='22023';
 end if;
 perform 1 from public.events where id=case when TG_OP='DELETE' then old.event_id else new.event_id end for update;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke execute on function public.lock_venue_requirement_event() from public,anon,authenticated;
drop trigger if exists event_venue_requirements_lock_event on public.event_venue_requirements;
create trigger event_venue_requirements_lock_event before insert or update or delete
 on public.event_venue_requirements for each row execute function public.lock_venue_requirement_event();

-- Browsers must use the approval RPC; rejection keeps its existing guarded UPDATE.
-- A restrictive policy cannot be bypassed by another permissive coordinator policy.
drop policy if exists bookings_confirm_through_rpc on public.venue_bookings;
create policy bookings_confirm_through_rpc on public.venue_bookings as restrictive
 for update to authenticated using (true) with check (status <> 'confirmed');

-- A delayed claim DELETE/INSERT must recheck the booking after taking its row lock.
create or replace function public.protect_confirmed_venue_claims()
returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; current_status text;
begin
 target := case when TG_OP='DELETE' then old.booking_id else new.booking_id end;
 if target is not null and auth.uid() is not null then
   select status into current_status from public.venue_bookings where id=target for update;
   if current_status='confirmed' then
     raise exception 'Approved venue slots are protected' using errcode='23514';
   end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke execute on function public.protect_confirmed_venue_claims() from public,anon,authenticated;
drop trigger if exists venue_claims_protect_confirmed on public.venue_slot_claims;
create trigger venue_claims_protect_confirmed before insert or delete
 on public.venue_slot_claims for each row execute function public.protect_confirmed_venue_claims();

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
 if b.status<>'pending_approval' then raise exception 'Booking is not pending' using errcode='22023'; end if;
 if venue_status<>'active' or e.status not in ('approved','planning') then
   raise exception 'Event or venue is not bookable' using errcode='22023';
 end if;
 if not exists(select 1 from public.venue_review_cells(e.proposed_start,e.proposed_end)) then
   raise exception 'Complete bookable timing is required' using errcode='22023';
 end if;
 if exists(select 1 from public.venue_review_cells(e.proposed_start,e.proposed_end) c
   join public.venue_closures v on v.venue_id=b.venue_id and v.removed_at is null
   and c.slot_date between v.starts_on and v.ends_on and c.slot=any(v.slots)) then
   raise exception 'Venue is blocked' using errcode='23514';
 end if;
 -- Never discard unrelated or unexpected claims to make approval appear successful.
 if exists(select 1 from public.venue_slot_claims s where s.booking_id=b.id and not exists(
   select 1 from public.venue_review_cells(e.proposed_start,e.proposed_end) c
   where c.slot_date=s.slot_date and c.slot=s.slot and c.kind=s.kind)) then
   raise exception 'Requested slots changed; reload and resubmit' using errcode='40001';
 end if;
 -- Unique ledger key arbitrates races with holds, including claims arriving after reads.
 insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_review_cells(e.proposed_start,e.proposed_end) c
 where not exists(select 1 from public.venue_slot_claims s where s.booking_id=b.id
   and s.slot_date=c.slot_date and s.slot=c.slot and s.kind=c.kind);
 update public.venue_bookings set status='confirmed',reviewed_by=auth.uid(),reviewed_at=clock_timestamp()
 where id=b.id and status='pending_approval';
 if not found then raise exception 'Decision already made' using errcode='40001'; end if;
 return b.id;
end $$;
revoke execute on function public.approve_venue_booking(uuid,text) from public,anon;
grant execute on function public.approve_venue_booking(uuid,text) to authenticated;

create or replace function public.get_venue_booking_review(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can read booking review details' using errcode='42501';
  end if;
  with cells as materialized (
    select s.* from public.venue_bookings target
    join public.events event on event.id=target.event_id
    cross join lateral public.venue_review_cells(event.proposed_start,event.proposed_end) s
    where target.id=p_booking_id
  )
  select jsonb_build_object(
    'reviewVersion',public.venue_booking_review_version(b.id),
    'id',b.id,'venueName',v.name,'status',b.status,
    'reviewNote',b.review_note,'reviewAlternative',b.review_alternative,
    'reviewedBy',b.reviewed_by,'reviewedAt',b.reviewed_at,
    'conflictCheckAvailable',cell_list.value is not null,
    'requestedCells',coalesce(cell_list.value,'[]'::jsonb),
    'conflicts',coalesce(conflict_list.value,'[]'::jsonb),
    'details',jsonb_build_object(
      'eventName',e.name,'reference',e.reference,
      'startsAt',e.proposed_start,'endsAt',e.proposed_end,
      'attendance',e.expected_attendance,'layoutPreference',e.layout_preference,
      'accessibilityNotes',e.accessibility_requirements,'specialArrangements',e.special_arrangements,
      'requirementsRecorded',r.event_id is not null,'layout',r.layout,
      'accessibility',coalesce(r.accessibility,'{}'::text[]),
      'facilities',coalesce(r.facilities,'{}'::text[]))) into result
  from public.venue_bookings b
  join public.venues v on v.id=b.venue_id
  join public.events e on e.id=b.event_id
  left join public.event_venue_requirements r on r.event_id=e.id
  cross join lateral (
    select jsonb_agg(jsonb_build_object('date',c.slot_date,'slot',c.slot,'kind',c.kind)
      order by c.slot_date,t.sort_order) as value
    from cells c join public.time_slots t on t.code=c.slot
  ) cell_list
  cross join lateral (
    select jsonb_agg(jsonb_build_object('date',x.slot_date,'slot',x.slot,'kind',x.kind,
      'source',x.source,'description',x.description) order by x.slot_date,t.sort_order,x.source,x.description) as value
    from (
      select c.*, 'confirmed_booking'::text as source,coalesce(other_event.reference,'Confirmed booking') as description
      from cells c join public.venue_slot_claims occupied
        on occupied.venue_id=b.venue_id and occupied.slot_date=c.slot_date and occupied.slot=c.slot
      join public.venue_bookings other on other.id=occupied.booking_id and other.status='confirmed' and other.id<>b.id
      join public.events other_event on other_event.id=other.event_id
      union all
      select c.*, 'blocked_period'::text,closure.reason
      from cells c join public.venue_closures closure on closure.venue_id=b.venue_id
        and closure.removed_at is null and c.slot_date between closure.starts_on and closure.ends_on
        and c.slot=any(closure.slots)
    ) x join public.time_slots t on t.code=x.slot
  ) conflict_list
  where b.id=p_booking_id;
  if result is null then
    raise exception 'Booking unavailable' using errcode='P0002';
  end if;
  return result;
end;
$$;
revoke execute on function public.get_venue_booking_review(uuid) from public, anon;
grant execute on function public.get_venue_booking_review(uuid) to authenticated;
commit;
