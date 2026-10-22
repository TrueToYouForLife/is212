-- US47: Venue Staff settings, preserved occupancy, conflict reviews and notices.
-- Requires 0075. Deploy with the buffer-settings frontend after PR approval.
begin;
-- Read-only occupancy projection: saved reservations remain the source of booked
-- event times, even if an organiser later changes the event while it awaits review.
-- New buffers extend from those saved event cells; gaps inside the event are preserved.
create or replace view public.venue_effective_slot_claims with (security_invoker=true) as
with live as (
 select b.* from public.venue_bookings b
 where b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now())
), bounds as (
 select b.id,b.venue_id,min(c.slot_date+t.starts_at) starts,max(c.slot_date+t.ends_at) ends
 from live b join public.venue_slot_claims c on c.booking_id=b.id and c.kind='event'
 join public.time_slots t on t.code=c.slot group by b.id,b.venue_id
), extra as (
 select b.venue_id,d::date slot_date,t.code slot,'buffer'::text kind,b.id booking_id,null::uuid closure_id
 from bounds b join public.venues v on v.id=b.venue_id
 cross join lateral generate_series((b.starts-make_interval(mins=>v.setup_minutes))::date::timestamp,
  (b.ends+make_interval(mins=>v.turnaround_minutes))::date::timestamp,interval '1 day') d
 cross join public.time_slots t
 where ((d::date+t.starts_at < b.starts and d::date+t.ends_at > b.starts-make_interval(mins=>v.setup_minutes))
     or (d::date+t.starts_at < b.ends+make_interval(mins=>v.turnaround_minutes) and d::date+t.ends_at>b.ends))
 and not exists(select 1 from public.venue_slot_claims saved where saved.booking_id=b.id
  and saved.slot_date=d::date and saved.slot=t.code)
), occupancy as (
 select c.venue_id,c.slot_date,c.slot,c.kind,c.booking_id,c.closure_id
 from public.venue_slot_claims c
 where exists(select 1 from live b where b.id=c.booking_id)
 or exists(select 1 from public.venue_closures cl where cl.id=c.closure_id and cl.removed_at is null)
 union all select * from extra
)
select o.*,case when b.id is not null then jsonb_build_object('status',b.status,'event_id',b.event_id,
 'events',jsonb_build_object('reference',e.reference)) end venue_bookings,
 case when cl.id is not null then jsonb_build_object('reason',cl.reason) end venue_closures
from occupancy o left join live b on b.id=o.booking_id
left join public.events e on e.id=b.event_id
left join public.venue_closures cl on cl.id=o.closure_id;
revoke all on public.venue_effective_slot_claims from public,anon;
grant select on public.venue_effective_slot_claims to authenticated;

-- All booking claim writers, including holds and approvals, share this check.
-- Venue-first locking serialises a settings save with claims on that venue.
create or replace function public.guard_venue_effective_occupancy()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.booking_id is null then return new; end if;
 perform 1 from public.venues where id=new.venue_id for update;
 if exists(select 1 from public.venue_effective_slot_claims c
   where c.venue_id=new.venue_id and c.slot_date=new.slot_date and c.slot=new.slot
    and c.booking_id is distinct from new.booking_id) then
  raise exception 'Requested period overlaps an existing reservation or its buffers' using errcode='23505';
 end if;
 return new;
end $$;
revoke all on function public.guard_venue_effective_occupancy() from public,anon,authenticated;
drop trigger if exists venue_claims_effective_occupancy on public.venue_slot_claims;
create trigger venue_claims_effective_occupancy before insert or update on public.venue_slot_claims
 for each row execute function public.guard_venue_effective_occupancy();

insert into public.notification_types(code,label,description,roles,delivered_in_app,delivered_by_email,sort_order)
values ('venue_buffer_review','Venue buffer changes needing review',
 'Existing bookings that conflict after venue setup or turnaround changes.',
 array['coordinator','venue_staff'],true,true,85)
on conflict(code) do nothing;

create or replace function public.get_venue_buffer_settings(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.venues;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
  raise exception 'Only Venue Staff can configure setup and turnaround' using errcode='42501';
 end if;
 select * into v from public.venues where id=p_venue_id;
 if not found then raise exception 'Venue not found' using errcode='P0002'; end if;
 return jsonb_build_object('setupMinutes',v.setup_minutes,'turnaroundMinutes',v.turnaround_minutes,
   'version',md5(to_jsonb(v)::text));
end $$;
revoke all on function public.get_venue_buffer_settings(uuid) from public,anon;
grant execute on function public.get_venue_buffer_settings(uuid) to authenticated;

-- Direct browser writes stay blocked by 0074's guard. This authorised operation
-- locks the venue, like hold/approval, and commits settings, reviews and notices together.
create or replace function public.update_venue_buffer_settings(
 p_venue_id uuid,p_version text,p_setup_minutes integer,p_turnaround_minutes integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v public.venues;
 change_id uuid;
 b record;
 staff record;
 v_detail text;
 affected integer := 0;
 conflict_found boolean;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
  raise exception 'Only Venue Staff can configure setup and turnaround' using errcode='42501';
 end if;
 if p_setup_minutes is null or p_turnaround_minutes is null or p_setup_minutes<0 or p_turnaround_minutes<0
    or p_setup_minutes%15<>0 or p_turnaround_minutes%15<>0 then
  raise exception 'Durations must be non-negative multiples of 15 minutes' using errcode='22023';
 end if;
 select * into v from public.venues where id=p_venue_id for update;
 if not found then raise exception 'Venue not found' using errcode='P0002'; end if;
 if v.status <> 'active' then raise exception 'Only active venues can be configured' using errcode='22023'; end if;
 if p_version is distinct from md5(to_jsonb(v)::text) then
  raise exception 'This venue changed. Reload before saving.' using errcode='40001';
 end if;
 if v.setup_minutes=p_setup_minutes and v.turnaround_minutes=p_turnaround_minutes then
  return public.get_venue_buffer_settings(p_venue_id)||jsonb_build_object('reviewCount',0);
 end if;
 update public.venues set setup_minutes=p_setup_minutes,turnaround_minutes=p_turnaround_minutes where id=p_venue_id;
 insert into public.venue_changes(venue_id,action,changed_by,details)
 values(p_venue_id,'updated',auth.uid(),jsonb_build_object(
  'setup_minutes',jsonb_build_object('from',v.setup_minutes,'to',p_setup_minutes),
  'turnaround_minutes',jsonb_build_object('from',v.turnaround_minutes,'to',p_turnaround_minutes))) returning id into change_id;

 for b in
  select vb.id booking_id,e.id event_id,e.coordinator_id,e.proposed_start,e.proposed_end
  from public.venue_bookings vb join public.events e on e.id=vb.event_id
  where vb.venue_id=p_venue_id
    and (vb.status in ('confirmed','pending_approval') or (vb.status='held' and vb.hold_expires_at>now()))
    and e.proposed_end>now()
 loop
  if b.proposed_start is null or not isfinite(b.proposed_start) or not isfinite(b.proposed_end)
     or b.proposed_end<=b.proposed_start then
   conflict_found := true;
  else
   -- Check the new occupied cells against saved claims and closure definitions.
   -- Also compare both bookings using the NEW settings: their extended buffers
   -- can collide in a previously empty gap without touching either saved claim.
   select exists(
    select 1 from public.venue_effective_slot_claims own
    join public.venue_effective_slot_claims other on other.venue_id=own.venue_id
     and other.slot_date=own.slot_date and other.slot=own.slot
     and other.booking_id is distinct from own.booking_id
    where own.booking_id=b.booking_id
   ) or exists(
    select 1 from public.venue_effective_slot_claims own
    join public.venue_closures cl on cl.venue_id=own.venue_id and cl.removed_at is null
     and own.slot_date between cl.starts_on and cl.ends_on and own.slot=any(cl.slots)
    where own.booking_id=b.booking_id
   ) into conflict_found;
  end if;
  if conflict_found then
   v_detail := format('%s setup is now %s minutes and turnaround %s minutes. The required occupied period conflicts or cannot be verified. Review this booking; its existing reservation has been preserved.',v.name,p_setup_minutes,p_turnaround_minutes);
   -- Refresh an open venue-change flag, but create fresh channel-aware notices
   -- on each distinct settings save so a previously read notice cannot hide it.
   update public.arrangement_review_flags f set detail=v_detail,venue_change_id=change_id
    where f.venue_booking_id=b.booking_id and f.reason_code='venue_time_conflict'
      and f.venue_change_id is not null and f.status='open';
   if not found then
    insert into public.arrangement_review_flags(venue_change_id,event_id,venue_booking_id,reason_code,detail)
    values(change_id,b.event_id,b.booking_id,'venue_time_conflict',v_detail);
   end if;
   if exists(select 1 from public.profiles where id=b.coordinator_id and role='coordinator') then
    perform public.send_notification(b.coordinator_id,'venue_buffer_review',b.event_id,'Venue buffer change needs review',v_detail);
   end if;
   for staff in select id from public.profiles where role='venue_staff' loop
    perform public.send_notification(staff.id,'venue_buffer_review',b.event_id,'Venue buffer change needs review',v_detail);
   end loop;
   affected := affected+1;
  end if;
 end loop;
 return public.get_venue_buffer_settings(p_venue_id)||jsonb_build_object('reviewCount',affected);
end $$;
revoke all on function public.update_venue_buffer_settings(uuid,text,integer,integer) from public,anon;
grant execute on function public.update_venue_buffer_settings(uuid,text,integer,integer) to authenticated;
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
  -- Materialise validated inputs before invoking the strict booking calculator.
  -- Incomplete timing must not prevent staff from reading the other details.
  with timed_request as materialized (
    select target.venue_id,event.proposed_start,event.proposed_end
    from public.venue_bookings target
    join public.events event on event.id=target.event_id
    where target.id=p_booking_id
      and event.proposed_start is not null and event.proposed_end is not null
      and isfinite(event.proposed_start) and isfinite(event.proposed_end)
      and event.proposed_end>event.proposed_start
  ), cells as materialized (
    select s.* from timed_request r
    cross join lateral public.venue_review_cells(r.venue_id,r.proposed_start,r.proposed_end) s
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
      -- The organiser's own requirements, now catalogue codes rather than free text.
      'accessibilityRequirements',coalesce(e.accessibility_requirements,'{}'::text[]),
      'facilityRequirements',coalesce(e.facility_requirements,'{}'::text[]),
      'specialArrangements',e.special_arrangements,
      -- The coordinator's overlay (0023), unchanged.
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
      from cells c join public.venue_effective_slot_claims occupied
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


-- Preserve existing block and revalidation rules; only conflict reads use the projection.
create or replace function public.block_venue(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slots      text[];
  v_closure    uuid;
  v_venue_name text;
begin
  v_slots := public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Serialise blocks on one venue, so two staff members cannot both pass the overlap check
  -- below and then both save. (A race cannot be shown in the single-session test runner.)
  select name into v_venue_name from public.venues where id = p_venue_id for update;

  -- The cell insert below skips held cells, so the ledger key no longer refuses a
  -- same-slot overlap with another block. This check does. Removed blocks don't count.
  if exists (
    select 1 from public.venue_closures vc
    where vc.venue_id = p_venue_id
      and vc.removed_at is null
      and vc.starts_on <= p_ends_on and vc.ends_on >= p_starts_on
      and vc.slots && v_slots
  ) then
    raise exception 'Part of this period is already blocked. Remove or change that block first.'
      using errcode = '23505';
  end if;

  -- Lapsed holds are otherwise released only when someone next books (0018). Release this
  -- venue's now, so a dead hold is neither flagged nor left on a cell the block should own.
  delete from public.venue_slot_claims c
  using public.venue_bookings b
  where c.booking_id = b.id and b.venue_id = p_venue_id
    and b.status = 'held' and b.hold_expires_at < now();
  update public.venue_bookings
  set status = 'expired'
  where venue_id = p_venue_id and status = 'held' and hold_expires_at < now();

  -- Who blocked comes from the session, never from the browser.
  insert into public.venue_closures
    (venue_id, starts_on, ends_on, slots, reason, created_by, created_by_name)
  values
    (p_venue_id, p_starts_on, p_ends_on, v_slots, btrim(p_reason), auth.uid(),
     (select full_name from public.profiles where id = auth.uid()))
  returning id into v_closure;

  -- Free cells become blocked. A cell a booking already holds stays with that booking.
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  select p_venue_id, d::date, s, 'maintenance', v_closure
  from generate_series(p_starts_on, p_ends_on, interval '1 day') d
  cross join unnest(v_slots) s
  on conflict (venue_id, slot_date, slot) do nothing;

  -- One flag per live booking inside the block, listing only its cells that the block covers.
  -- The assigned coordinator owns the event; the requester is the fallback for an event
  -- still in the unassigned queue (Week 7 change 5).
  insert into public.venue_booking_flags
    (booking_id, event_id, venue_id, closure_id, cause, detail, affected_cells,
     recipient_id, created_by)
  select b.id, b.event_id, p_venue_id, v_closure, 'venue_blocked',
         'Venue blocked: ' || btrim(p_reason),
         jsonb_agg(jsonb_build_object('date', c.slot_date, 'slot', c.slot, 'kind', c.kind)
                   order by c.slot_date, c.slot),
         coalesce(e.coordinator_id, b.requested_by), auth.uid()
  from public.venue_effective_slot_claims c
  join public.venue_bookings b on b.id = c.booking_id
  join public.events e on e.id = b.event_id
  where c.venue_id = p_venue_id
    and c.kind in ('event', 'buffer')
    and c.slot_date between p_starts_on and p_ends_on
    and c.slot = any (v_slots)
    and b.status in ('held', 'pending_approval', 'confirmed')
  group by b.id, b.event_id, e.coordinator_id, b.requested_by;

  -- One email per flag, queued in the same outbox as 0009's review emails.
  insert into public.notification_outbox (event_id, recipient_email, subject, body)
  select f.event_id,
         u.email,
         'Venue booking needs review: ' || v_venue_name,
         format(
           E'Venue Staff have blocked %s from %s to %s (%s).\nReason: %s\n\n'
           'Your booking for event %s (%s) overlaps this period. It has not been cancelled. '
           'Please review it in ConnectSphere and arrange an alternative if needed.',
           v_venue_name, p_starts_on, p_ends_on, array_to_string(v_slots, ', '), btrim(p_reason),
           coalesce(e.reference, 'without a reference'), coalesce(e.name, 'untitled'))
  from public.venue_booking_flags f
  join auth.users u on u.id = f.recipient_id
  join public.events e on e.id = f.event_id
  where f.closure_id = v_closure
    and u.email is not null and btrim(u.email) <> '';

  return v_closure;
end;
$$;
revoke execute on function public.block_venue(uuid, date, date, text[], text) from public, anon;
grant execute on function public.block_venue(uuid, date, date, text[], text) to authenticated;

create or replace function public.revalidate_event_arrangements(p_event uuid,p_fields text[],p_venue boolean,p_equipment boolean,p_request uuid,p_update uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events; b record; capacity integer; requested_layout text;
 timing boolean; first_day date; last_day date; conflict_found boolean;
begin
 select * into strict e from public.events where id=p_event;
 timing:=p_fields && array['proposedStart','proposedEnd'];
 first_day:=(e.proposed_start at time zone 'Asia/Singapore')::date;
 last_day:=(e.proposed_end at time zone 'Asia/Singapore')::date;
 if p_venue then
  for b in select vb.*,v.name as venue_name from public.venue_bookings vb
   join public.venues v on v.id=vb.venue_id where vb.event_id=e.id
   and (vb.status in ('pending_approval','confirmed') or
     (vb.status='held' and vb.hold_expires_at>now())) loop
   if timing then
    select exists(select 1 from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end) c
     where exists(select 1 from public.venue_closures x where x.venue_id=b.venue_id
       and x.removed_at is null and c.slot_date between x.starts_on and x.ends_on and c.slot=any(x.slots))
     or exists(select 1 from public.venue_effective_slot_claims s
       left join public.venue_bookings other on other.id=s.booking_id
       where s.venue_id=b.venue_id and s.slot_date=c.slot_date and s.slot=c.slot
       and s.booking_id is distinct from b.id
       and (s.kind='maintenance' or other.status in ('pending_approval','confirmed')
         or (other.status='held' and other.hold_expires_at>now())))) into conflict_found;
    if conflict_found then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_time_conflict',
      format('%s: the updated event timing, including setup/turnaround, conflicts with an active booking, hold or venue block.',b.venue_name),p_update);
    end if;
    -- A free new interval is not an existing reservation for that interval.
    if not exists(select 1 from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end)) or exists(
      (select slot_date,slot,kind from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end)
       except select slot_date,slot,kind from public.venue_slot_claims where booking_id=b.id)
      union all
      (select slot_date,slot,kind from public.venue_slot_claims where booking_id=b.id
       except select slot_date,slot,kind from public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end))) then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_timing_changed',
      format('%s: the existing reserved slots do not match the updated event timing. Review or replace this booking; no slots were moved.',b.venue_name),p_update);
    end if;
   end if;
   if p_fields && array['expectedAttendance','layoutPreference'] then
    -- An approved layout supersedes older structured requirements, including on later
    -- attendance changes. A subsequent coordinator save confirms their structured layout.
    if 'layoutPreference'=any(p_fields) then requested_layout:=public.layout_code(e.layout_preference);
    else
     select case
       when r.updated_at > coalesce((select max(q.created_at)
         from (select created_at from public.event_change_revalidations where event_id=e.id and 'layoutPreference'=any(approved_fields)
           union all select changed_at from public.event_planning_updates where event_id=e.id and changes ? 'layoutPreference') q), '-infinity'::timestamptz)
       then coalesce(r.layout,public.layout_code(e.layout_preference))
       else public.layout_code(e.layout_preference)
      end into requested_layout
      from (select 1) seed left join public.event_venue_requirements r on r.event_id=e.id;
    end if;
    select vl.capacity into capacity from public.venue_layouts vl
     where vl.venue_id=b.venue_id and vl.layout=requested_layout;
    if capacity is null then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_layout_review',
      format('%s: capacity for the requested layout (%s) could not be verified. Review the layout and attendance manually.',b.venue_name,coalesce(requested_layout,'unspecified')),p_update);
    elsif e.expected_attendance>capacity then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_capacity',
      format('%s: updated attendance is %s; capacity for layout %s is %s.',b.venue_name,e.expected_attendance,requested_layout,capacity),p_update);
    elsif 'layoutPreference'=any(p_fields) then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_layout_review',
      format('%s: requested layout changed to %s. Capacity is sufficient; confirm the existing venue arrangement uses this layout.',b.venue_name,requested_layout),p_update);
    end if;
   end if;
   if 'facilityRequirements'=any(p_fields) then
    perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_facility_review',
     format('%s: venue facility requirements changed. Check the existing arrangement against the updated facilities.',b.venue_name),p_update);
   end if;
   if 'accessibilityRequirements'=any(p_fields) then
    perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_accessibility_review',
     format('%s: accessibility requirements changed to "%s". Check that this venue arrangement meets them; no incompatibility has been assumed.',b.venue_name,coalesce(nullif(array_to_string(e.accessibility_requirements, ', '),''),'none specified')),p_update);
   end if;
  end loop;
 end if;
 if p_equipment then
  for b in select eb.* from public.equipment_bookings eb where eb.event_id=e.id
   and eb.status not in ('rejected','cancelled','completed')
   and exists(select 1 from public.equipment_booking_lines l join public.equipment_allocations a on a.line_id=l.id
     where l.booking_id=eb.id and a.status in ('reserved','checked_out')) loop
   if timing then
    -- Preserve the previously agreed return-day extension when evaluating new dates.
    select exists(select 1 from public.equipment_booking_lines l
      join public.equipment_allocations a on a.line_id=l.id
      where l.booking_id=b.id and a.status in ('reserved','checked_out')
      and not exists(select 1 from public.equipment_free_units(l.type_id,e.id,first_day,last_day+greatest(a.blocked_to-b.use_to,0),l.id) u
        where u.item_id=a.item_id)) into conflict_found;
    if conflict_found then
     perform public.record_arrangement_review(p_request,e.id,null,b.id,'equipment_time_conflict',
      'Reserved equipment cannot satisfy the updated timing: a reserved unit is unavailable or non-operational during the required collection/use/return window.',p_update);
    end if;
    if b.use_from is distinct from first_day or b.use_to is distinct from last_day then
     perform public.record_arrangement_review(p_request,e.id,null,b.id,'equipment_timing_changed',
      format('Equipment was reserved for %s to %s; event dates are now %s to %s. Review the reservation and return window; no allocation was moved.',b.use_from,b.use_to,first_day,last_day),p_update);
    end if;
   end if;
   if 'equipmentRequirements'=any(p_fields) then
    perform public.record_arrangement_review(p_request,e.id,null,b.id,'equipment_requirements_review',
     format('Equipment requirements changed to "%s". Compare this reservation with the revised requirements; no shortage has been assumed.',coalesce(nullif(array_to_string(e.equipment_requirements, ', '),''),'none specified')),p_update);
   end if;
  end loop;
 end if;

end $$;
revoke all on function public.revalidate_event_arrangements(uuid,text[],boolean,boolean,uuid,uuid) from public,anon,authenticated;

commit;
