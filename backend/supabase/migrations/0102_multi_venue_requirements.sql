-- US49 Slice 1 (0102 reserved): independent space requirements and multiple holds.
begin;
alter table public.venue_bookings add column if not exists space_layout text references public.layout_types(code);
alter table public.venue_bookings add column if not exists space_attendance integer;
alter table public.venue_bookings drop constraint if exists venue_booking_space_requirements;
alter table public.venue_bookings add constraint venue_booking_space_requirements check (
 (space_layout is null and space_attendance is null) or
 (space_layout is not null and space_attendance is not null and space_attendance > 0));
-- Historical rows remain unknown rather than inventing a requirement retrospectively.
drop index if exists public.venue_bookings_one_active_hold_per_event;

-- Adding nullable columns must not invalidate proposals already awaiting agreement.
-- Explicit space requirements are included for new bookings; legacy fingerprints stay identical.
create or replace function public.venue_replacement_source_version(p_booking uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(
 case when b.space_layout is null then to_jsonb(b)-'space_layout'-'space_attendance' else to_jsonb(b) end,
 to_jsonb(e),to_jsonb(v),to_jsonb(r),public.venue_replacement_reasons(b.id))::text)
 from public.venue_bookings b join public.events e on e.id=b.event_id
 join public.venues v on v.id=b.venue_id
 left join public.event_venue_requirements r on r.event_id=e.id where b.id=p_booking;
$$;

create or replace function public.check_booking_space(p_event uuid,p_venue uuid,p_layout text,p_attendance integer)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events; v public.venues; r public.event_venue_requirements; cap integer; code text;
begin
 select * into e from public.events where id=p_event;
 select * into v from public.venues where id=p_venue;
 select * into r from public.event_venue_requirements where event_id=p_event;
 select capacity into cap from public.venue_layouts where venue_id=p_venue and layout=p_layout;
 if p_attendance is null or p_attendance<1 or nullif(btrim(p_layout),'') is null
    or cap is null or cap<p_attendance then
  raise exception 'Choose an offered layout with enough capacity for this space' using errcode='22023';
 end if;
 for code in select distinct unnest(coalesce(e.accessibility_requirements,'{}')||coalesce(r.accessibility,'{}')) loop
  if not(code=any(coalesce(v.accessibility,'{}'))) then
   raise exception 'Venue lacks required accessibility: %',code using errcode='22023'; end if;
 end loop;
 for code in select distinct unnest(coalesce(e.facility_requirements,'{}')||coalesce(r.facilities,'{}')) loop
  if coalesce(v.facility->>code,'false') in ('false','0','null','') then
   raise exception 'Venue lacks required facility: %',code using errcode='22023'; end if;
 end loop;
end $$;
revoke all on function public.check_booking_space(uuid,uuid,text,integer) from public,anon,authenticated;

-- Snapshot fields are immutable to browser writes; checked RPCs own them.
create or replace function public.guard_booking_space_fields()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and (
   tg_op='INSERT' or
   (tg_op='UPDATE' and (new.space_layout is distinct from old.space_layout or new.space_attendance is distinct from old.space_attendance))) then
  raise exception 'Use the checked space booking operation' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists guard_booking_space_fields on public.venue_bookings;
create trigger guard_booking_space_fields before insert or update on public.venue_bookings
for each row execute function public.guard_booking_space_fields();


create or replace function public.hold_venue_space(
 p_event_id uuid, p_venue_id uuid, p_layout text, p_attendance integer, p_hold_days integer default 3
) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; v_status text; booking uuid;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
  raise exception 'Only an assigned Coordinator may place a hold' using errcode='42501';
 end if;
 if p_hold_days is null or p_hold_days <= 0 then
  raise exception 'Hold duration must be positive' using errcode='22023';
 end if;
 -- Match approval/block locking: venue first, then event. The event lock also
 -- serialises attempts to hold different venues for the same event.
 select status into v_status from public.venues where id=p_venue_id for update;
 if not found or v_status is distinct from 'active' then
  raise exception 'Venue is not bookable' using errcode='22023';
 end if;
 select * into e from public.events where id=p_event_id for update;
 if not found or e.coordinator_id is distinct from auth.uid() then
  raise exception 'Only the assigned Coordinator may place a hold' using errcode='42501';
 end if;
 if e.status not in ('approved','planning') then
  raise exception 'Event is not bookable' using errcode='22023';
 end if;
 perform public.check_booking_space(p_event_id,p_venue_id,p_layout,p_attendance);
 -- Validate timing before changing any expired reservations.
 perform 1 from public.venue_review_cells(p_venue_id,e.proposed_start,e.proposed_end);
 delete from public.venue_slot_claims c using public.venue_bookings b
 where c.booking_id=b.id and b.venue_id=p_venue_id
  and b.status='held' and b.hold_expires_at<=now();
 update public.venue_bookings set status='expired'
 where venue_id=p_venue_id and status='held' and hold_expires_at<=now();
 -- Check closure definitions too: an overlapping booking may currently own
 -- the cells, but its release must not make the blocked period bookable.
 if exists(select 1 from public.venue_review_cells(p_venue_id,e.proposed_start,e.proposed_end) c
  join public.venue_closures v on v.venue_id=p_venue_id and v.removed_at is null
   and public.venue_closure_covers(v.id,c.slot_date,c.slot)) then
  raise exception 'Requested period overlaps a venue block' using errcode='23505';
 end if;
 insert into public.venue_bookings(event_id,venue_id,requested_by,status,hold_expires_at,space_layout,space_attendance)
 values(p_event_id,p_venue_id,auth.uid(),'held',now()+p_hold_days*interval '24 hours',p_layout,p_attendance)
 returning id into booking;
 insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select p_venue_id,c.slot_date,c.slot,c.kind,booking
 from public.venue_review_cells(p_venue_id,e.proposed_start,e.proposed_end) c;
 -- The ledger primary key refuses concurrent overlaps; any error rolls back
 -- the booking and all its cells together, including expiry cleanup above.
 return booking;
end $$;
revoke all on function public.hold_venue_space(uuid,uuid,text,integer,integer) from public,anon;
grant execute on function public.hold_venue_space(uuid,uuid,text,integer,integer) to authenticated;

-- Older clients also use the checked path, using their event's existing requirements.
create or replace function public.hold_venue(p_event_id uuid,p_venue_id uuid,p_hold_days integer default 3)
returns uuid language plpgsql security definer set search_path='' as $$
declare chosen_layout text; people integer;
begin
 select coalesce(r.layout,public.layout_code(e.layout_preference),v.layout),e.expected_attendance
 into chosen_layout,people from public.events e cross join public.venues v
 left join public.event_venue_requirements r on r.event_id=e.id
 where e.id=p_event_id and v.id=p_venue_id;
 return public.hold_venue_space(p_event_id,p_venue_id,chosen_layout,people,p_hold_days);
end $$;
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
 if b.space_layout is not null then
  perform public.check_booking_space(b.event_id,b.venue_id,b.space_layout,b.space_attendance);
 end if;
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
   and public.venue_closure_covers(v.id,c.slot_date,c.slot)) then
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
      'attendance',coalesce(b.space_attendance,e.expected_attendance),'layoutPreference',coalesce(b.space_layout,e.layout_preference),
      -- The organiser's own requirements, now catalogue codes rather than free text.
      'accessibilityRequirements',coalesce(e.accessibility_requirements,'{}'::text[]),
      'facilityRequirements',coalesce(e.facility_requirements,'{}'::text[]),
      'specialArrangements',e.special_arrangements,
      -- The coordinator's overlay (0023), unchanged.
      'requirementsRecorded',(r.event_id is not null or b.space_layout is not null),'layout',coalesce(b.space_layout,r.layout),
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
        and closure.removed_at is null and public.venue_closure_covers(closure.id,c.slot_date,c.slot)
    ) x join public.time_slots t on t.code=x.slot
  ) conflict_list
  where b.id=p_booking_id;
  if result is null then
    raise exception 'Booking unavailable' using errcode='P0002';
  end if;
  return result;
end;
$$;

-- Exact closure membership in update_venue_buffer_settings.
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
     and public.venue_closure_covers(cl.id,own.slot_date,own.slot)
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
  insert into public.venue_bookings(event_id,venue_id,requested_by,status,space_layout,space_attendance)
   values(e.id,q.target_venue_id,e.coordinator_id,'cancelled',b.space_layout,b.space_attendance) returning id into new_booking;
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

-- Existing review producers honour explicit per-booking requirements.
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
       and x.removed_at is null and public.venue_closure_covers(x.id,c.slot_date,c.slot))
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
    requested_layout:=coalesce(b.space_layout,requested_layout);
    select vl.capacity into capacity from public.venue_layouts vl
     where vl.venue_id=b.venue_id and vl.layout=requested_layout;
    if capacity is null then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_layout_review',
      format('%s: capacity for the requested layout (%s) could not be verified. Review the layout and attendance manually.',b.venue_name,coalesce(requested_layout,'unspecified')),p_update);
    elsif coalesce(b.space_attendance,e.expected_attendance)>capacity then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_capacity',
      format('%s: updated attendance is %s; capacity for layout %s is %s.',b.venue_name,coalesce(b.space_attendance,e.expected_attendance),requested_layout,capacity),p_update);
    elsif b.space_layout is null and 'layoutPreference'=any(p_fields) then
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
create or replace function public.review_bookings_for_venue_change(p_change uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c          public.venue_changes;
  v          public.venues;
  b          record;
  v_layout   text;
  v_capacity integer;
  v_removed  text[];
  v_missing  text[];
  v_slots    text;
begin
  select * into c from public.venue_changes where id = p_change;
  if c.action not in ('updated', 'layout_updated', 'layout_removed') then return; end if;
  select * into v from public.venues where id = c.venue_id;

  for b in
    select vb.id as booking_id, e.id as event_id, coalesce(vb.space_attendance,e.expected_attendance) as expected_attendance, vb.space_layout,
           coalesce(e.accessibility_requirements, '{}') as accessibility_required,
           coalesce(e.facility_requirements, '{}') as facilities_required
    from public.venue_bookings vb join public.events e on e.id = vb.event_id
    where vb.venue_id = c.venue_id
      and (vb.status in ('pending_approval', 'confirmed') or (vb.status = 'held' and vb.hold_expires_at > now()))
      and e.proposed_end > now()
  loop
    if c.action = 'layout_removed' then
      v_layout := coalesce(b.space_layout,public.event_requested_layout(b.event_id));
      if v_layout = c.details ->> 'layout' then
        perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_layout_review',
          format('%s no longer offers the %s layout this event requested. Check the arrangement or find another venue; the booking is unchanged.',
                 v.name, v_layout));
      end if;

    elsif c.action = 'layout_updated' then
      v_layout := coalesce(b.space_layout,public.event_requested_layout(b.event_id));
      v_capacity := (c.details -> 'capacity' ->> 'to')::integer;
      if v_layout = c.details ->> 'layout'
         and v_capacity < (c.details -> 'capacity' ->> 'from')::integer
         and b.expected_attendance > v_capacity then
        perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_capacity',
          format('%s: capacity for the %s layout is now %s; this event expects %s. The booking is unchanged.',
                 v.name, v_layout, v_capacity, b.expected_attendance));
      end if;

    elsif c.details -> 'status' ->> 'to' = 'retired' then
      perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_retired',
        format('%s has been retired by Venue Staff%s. Find another venue for this event; the booking is unchanged.',
               v.name, coalesce(' (' || v.retirement_note || ')', '')));

    else
      if c.details ? 'accessibility' then
        select coalesce(array_agg(x order by x), '{}') into v_removed
        from (select jsonb_array_elements_text(public.venue_change_list(c.details -> 'accessibility' -> 'from')) x
              except select jsonb_array_elements_text(public.venue_change_list(c.details -> 'accessibility' -> 'to'))) d;
        v_missing := array(select unnest(b.accessibility_required) intersect select unnest(v_removed) order by 1);
        if cardinality(v_missing) > 0 then
          perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_accessibility_review',
            format('%s no longer lists %s, which this event requires. Check the arrangement; the booking is unchanged.',
                   v.name, array_to_string(v_missing, ', ')));
        end if;
      end if;

      if c.details ? 'facility' then
        select coalesce(array_agg(k order by k), '{}') into v_removed
        from (select key k from jsonb_each(public.venue_change_object(c.details -> 'facility' -> 'from')) where value = 'true'::jsonb
              except select key from jsonb_each(public.venue_change_object(c.details -> 'facility' -> 'to')) where value = 'true'::jsonb) d;
        v_missing := array(select unnest(b.facilities_required) intersect select unnest(v_removed) order by 1);
        if cardinality(v_missing) > 0 then
          perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_facility_review',
            format('%s no longer has %s, which this event requires. Check the arrangement; the booking is unchanged.',
                   v.name, array_to_string(v_missing, ', ')));
        end if;
      end if;

      -- A slot is now outside the hours if it falls outside the new hours but was inside
      -- the old ones (no hours recorded counts as always open).
      if (c.details ? 'opens_at' or c.details ? 'closes_at') and v.opens_at is not null then
        select string_agg(distinct s.slot_date || ' ' || s.slot, ', ' order by s.slot_date || ' ' || s.slot) into v_slots
        from public.venue_slot_claims s join public.time_slots t on t.code = s.slot
        where s.booking_id = b.booking_id
          and (t.starts_at < v.opens_at or t.ends_at > v.closes_at)
          and coalesce((c.details -> 'opens_at' ->> 'from')::time, time '00:00') <= t.starts_at
          and coalesce((c.details -> 'closes_at' ->> 'from')::time, time '24:00') >= t.ends_at;
        if v_slots is not null then
          perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_hours_review',
            format('%s now opens %s to %s, which no longer covers this booking''s %s. Check the arrangement; the booking is unchanged.',
                   v.name, to_char(v.opens_at, 'HH24:MI'), to_char(v.closes_at, 'HH24:MI'), v_slots));
        end if;
      end if;
    end if;
  end loop;
end $$;

-- Replacement reviews display the same requirements the approval checks.
create or replace function public.get_venue_replacements()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text:=public.current_user_role(); result jsonb;
begin
 if auth.uid() is null or actor_role not in ('coordinator','venue_staff') or actor_role is null then
  raise exception 'Coordinator or Venue Staff required' using errcode='42501';
 end if;
 select jsonb_build_object(
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'eventName',coalesce(e.name,e.purpose,e.reference),
   'venueName',v.name,'eventId',e.id,'needsReplacement',true,'reasons',public.venue_replacement_reasons(b.id),'version',public.venue_replacement_source_version(b.id),'details',public.event_planning_values(e)||jsonb_build_object('expectedAttendance',coalesce(b.space_attendance,e.expected_attendance),'layoutPreference',coalesce(b.space_layout,e.layout_preference))) order by b.created_at,b.id)
  from public.venue_bookings b join public.events e on e.id=b.event_id join public.venues v on v.id=b.venue_id
  where actor_role='coordinator' and e.coordinator_id=auth.uid() and e.status in ('approved','planning','confirmed') and e.proposed_start>now()
   and public.venue_replacement_reasons(b.id)<>'[]'::jsonb and (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
   and not exists(select 1 from public.venue_replacement_requests q where q.original_booking_id=b.id and q.status='pending')),'[]'::jsonb),
 'affectedBookings',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'eventId',e.id,
   'eventName',coalesce(e.name,e.purpose,e.reference),'venueName',v.name,'needsReplacement',true,
   'reasons',public.venue_replacement_reasons(b.id),'version',public.venue_replacement_source_version(b.id),
   'details',public.event_planning_values(e)||jsonb_build_object('expectedAttendance',coalesce(b.space_attendance,e.expected_attendance),'layoutPreference',coalesce(b.space_layout,e.layout_preference))) order by b.created_at,b.id)
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
   'details',public.event_planning_values(e)||jsonb_build_object('expectedAttendance',coalesce(b.space_attendance,e.expected_attendance),'layoutPreference',coalesce(b.space_layout,e.layout_preference)),'targetCapacity',target.capacity,'targetLayout',target.layout,
   'targetAccessibility',target.accessibility,'targetFacilities',target.facility)
   order by q.proposed_at desc,q.id)
  from public.venue_replacement_requests q join public.venue_bookings b on b.id=q.original_booking_id
  join public.events e on e.id=b.event_id join public.venues v on v.id=b.venue_id
  join public.venues target on target.id=q.target_venue_id
  where actor_role='venue_staff' or e.coordinator_id=auth.uid()),'[]'::jsonb)) into result;
 return result;
end $$;
commit;
