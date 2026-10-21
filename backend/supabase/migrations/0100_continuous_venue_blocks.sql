-- Continuous venue blocks. Claimed 0100; requires 0075, 0098 and 0099.
-- Existing closures keep their selected slots on each date; never backfill a new
-- continuous interval over legacy gaps or rewrite existing bookings/claims.
begin;
alter table public.venue_closures
 add column if not exists starts_at timestamptz,
 add column if not exists ends_at timestamptz;
alter table public.venue_closures drop constraint if exists venue_closures_period_valid;
alter table public.venue_closures add constraint venue_closures_period_valid check (
 (starts_at is null and ends_at is null) or
 (starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at)
  and ends_at>starts_at and extract(epoch from starts_at)::numeric % 900=0
  and extract(epoch from ends_at)::numeric % 900=0
  and starts_on=(starts_at at time zone 'Asia/Singapore')::date
  and ends_on=((ends_at-interval '15 minutes') at time zone 'Asia/Singapore')::date)
);

-- One exact cell predicate for every closure consumer, including legacy definitions.
create or replace function public.venue_closure_covers(p_closure uuid,p_date date,p_slot text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.venue_closures c join public.time_slots t on t.code=p_slot
 where c.id=p_closure and c.removed_at is null and p_date between c.starts_on and c.ends_on
 and case when c.starts_at is null then p_slot=any(c.slots)
 else (p_date+t.starts_at) at time zone 'Asia/Singapore' >= c.starts_at
  and (p_date+t.starts_at) at time zone 'Asia/Singapore' < c.ends_at end);
$$;
revoke all on function public.venue_closure_covers(uuid,date,text) from public,anon,authenticated;

create or replace function public.venue_block_window_cells(
 p_first date,p_last date,p_slots text[],p_start timestamptz,p_end timestamptz)
returns table(slot_date date,slot text) language sql stable set search_path='' as $$
 select d::date,t.code from generate_series(p_first::timestamp,p_last::timestamp,interval '1 day') d
 cross join public.time_slots t
 where case when p_start is null then t.code=any(p_slots)
 else (d::date+t.starts_at) at time zone 'Asia/Singapore' >= p_start
  and (d::date+t.starts_at) at time zone 'Asia/Singapore' < p_end end;
$$;
revoke all on function public.venue_block_window_cells(date,date,text[],timestamptz,timestamptz) from public,anon,authenticated;

create or replace function public.validate_venue_block_period(p_venue uuid,p_start timestamptz,p_end timestamptz)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
  raise exception 'Only Venue Staff can block a venue' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start then
  raise exception 'Choose a finite end date/time after the start date/time' using errcode='22023'; end if;
 if extract(epoch from p_start)::numeric % 900<>0 or extract(epoch from p_end)::numeric % 900<>0 then
  raise exception 'Block times must be in 15-minute increments' using errcode='22023'; end if;
 -- Reuse existing role, venue and bounded-calendar checks before generating cells.
 perform public.venue_block_request_slots(p_venue,(p_start at time zone 'Asia/Singapore')::date,
  ((p_end-interval '15 minutes') at time zone 'Asia/Singapore')::date,array['T0000']);
end $$;
revoke all on function public.validate_venue_block_period(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function public.save_venue_block_window(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text,
  p_starts_at timestamptz,p_ends_at timestamptz
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

  if p_starts_at is not null or p_ends_at is not null then
    perform public.validate_venue_block_period(p_venue_id,p_starts_at,p_ends_at);
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Serialise blocks on one venue, so two staff members cannot both pass the overlap check
  -- below and then both save. (A race cannot be shown in the single-session test runner.)
  select name into v_venue_name from public.venues where id = p_venue_id for update;

  -- Recheck venue eligibility after acquiring the shared venue lock.
  perform public.venue_block_request_slots(p_venue_id,p_starts_on,p_ends_on,p_slots);

  -- Venue lock serialises both legacy and continuous block creation. Compare
  -- actual cells, not the Cartesian product of dates and all stored slots.
  if exists(select 1 from public.venue_closures vc
   cross join public.venue_block_window_cells(p_starts_on,p_ends_on,v_slots,p_starts_at,p_ends_at) wanted
   where vc.venue_id=p_venue_id and vc.removed_at is null
    and vc.starts_on<=p_ends_on and vc.ends_on>=p_starts_on
    and public.venue_closure_covers(vc.id,wanted.slot_date,wanted.slot)) then
    raise exception 'Part of this period is already blocked. Remove or change that block first.' using errcode='23505';
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
    (venue_id, starts_on, ends_on, slots, reason, created_by, created_by_name, starts_at, ends_at)
  values
    (p_venue_id, p_starts_on, p_ends_on, v_slots, btrim(p_reason), auth.uid(),
     (select full_name from public.profiles where id = auth.uid()),p_starts_at,p_ends_at)
  returning id into v_closure;

  -- Free cells become blocked. A cell a booking already holds stays with that booking.
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  select p_venue_id, wanted.slot_date, wanted.slot, 'maintenance', v_closure
  from public.venue_block_window_cells(p_starts_on,p_ends_on,v_slots,p_starts_at,p_ends_at) wanted
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
    and public.venue_closure_covers(v_closure,c.slot_date,c.slot)
    and b.status in ('held', 'pending_approval', 'confirmed')
  group by b.id, b.event_id, e.coordinator_id, b.requested_by;

  -- One email per flag, queued in the same outbox as 0009's review emails.
  insert into public.notification_outbox (event_id, recipient_email, subject, body)
  select f.event_id,
         u.email,
         'Venue booking needs review: ' || v_venue_name,
         format(
           E'Venue Staff have blocked %s during %s.\nReason: %s\n\n'
           'Your booking for event %s (%s) overlaps this period. It has not been cancelled. '
           'Please review it in ConnectSphere and arrange an alternative if needed.',
           v_venue_name,case when p_starts_at is null then format('%s to %s (%s daily)',p_starts_on,p_ends_on,array_to_string(v_slots,', '))
            else format('%s to %s (Singapore time)',p_starts_at at time zone 'Asia/Singapore',p_ends_at at time zone 'Asia/Singapore') end,btrim(p_reason),
           coalesce(e.reference, 'without a reference'), coalesce(e.name, 'untitled'))
  from public.venue_booking_flags f
  join auth.users u on u.id = f.recipient_id
  join public.events e on e.id = f.event_id
  where f.closure_id = v_closure
    and u.email is not null and btrim(u.email) <> '';

  return v_closure;
end;
$$;
revoke all on function public.save_venue_block_window(uuid,date,date,text[],text,timestamptz,timestamptz) from public,anon,authenticated;

-- Preserve existing integrations; the new form calls the explicit period RPC.
create or replace function public.block_venue(p_venue_id uuid,p_starts_on date,p_ends_on date,p_slots text[],p_reason text)
returns uuid language sql security definer set search_path='' as $$
 select public.save_venue_block_window(p_venue_id,p_starts_on,p_ends_on,p_slots,p_reason,null,null);
$$;
revoke all on function public.block_venue(uuid,date,date,text[],text) from public,anon;
grant execute on function public.block_venue(uuid,date,date,text[],text) to authenticated;

create or replace function public.block_venue_period(p_venue_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform public.validate_venue_block_period(p_venue_id,p_starts_at,p_ends_at);
 return public.save_venue_block_window(p_venue_id,(p_starts_at at time zone 'Asia/Singapore')::date,
  ((p_ends_at-interval '15 minutes') at time zone 'Asia/Singapore')::date,
  array(select code from public.time_slots order by sort_order),p_reason,p_starts_at,p_ends_at);
end $$;
revoke all on function public.block_venue_period(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.block_venue_period(uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function public.preview_venue_block_window(
 p_venue_id uuid,p_first date,p_last date,p_slots text[],p_start timestamptz,p_end timestamptz)
returns table(overlap_type text,booking_id uuid,booking_status text,event_reference text,event_name text,
 slot_date date,slot text,claim_kind text,block_reason text)
language sql stable security definer set search_path='' as $$
 with wanted as (select * from public.venue_block_window_cells(p_first,p_last,p_slots,p_start,p_end))
 select 'booking'::text,b.id,b.status::text,e.reference::text,e.name::text,c.slot_date,c.slot::text,c.kind::text,null::text
 from wanted w join public.venue_effective_slot_claims c on c.venue_id=p_venue_id and c.slot_date=w.slot_date and c.slot=w.slot
 join public.venue_bookings b on b.id=c.booking_id join public.events e on e.id=b.event_id
 where c.kind in ('event','buffer') and (b.status in ('confirmed','pending_approval') or (b.status='held' and b.hold_expires_at>now()))
 union all
 select 'existing_block',null::uuid,null::text,null::text,null::text,w.slot_date,w.slot,'maintenance',c.reason
 from wanted w join public.venue_closures c on c.venue_id=p_venue_id and c.removed_at is null
  and public.venue_closure_covers(c.id,w.slot_date,w.slot)
 order by 6,7;
$$;
revoke all on function public.preview_venue_block_window(uuid,date,date,text[],timestamptz,timestamptz) from public,anon,authenticated;

create or replace function public.preview_venue_block(p_venue_id uuid,p_starts_on date,p_ends_on date,p_slots text[])
returns table(overlap_type text,booking_id uuid,booking_status text,event_reference text,event_name text,
 slot_date date,slot text,claim_kind text,block_reason text)
language plpgsql stable security definer set search_path='' as $$
declare codes text[];
begin
 codes:=public.venue_block_request_slots(p_venue_id,p_starts_on,p_ends_on,p_slots);
 return query select * from public.preview_venue_block_window(p_venue_id,p_starts_on,p_ends_on,codes,null,null);
end $$;
revoke all on function public.preview_venue_block(uuid,date,date,text[]) from public,anon;
grant execute on function public.preview_venue_block(uuid,date,date,text[]) to authenticated;

create or replace function public.preview_venue_block_period(p_venue_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(overlap_type text,booking_id uuid,booking_status text,event_reference text,event_name text,
 slot_date date,slot text,claim_kind text,block_reason text)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.validate_venue_block_period(p_venue_id,p_starts_at,p_ends_at);
 return query select * from public.preview_venue_block_window(p_venue_id,(p_starts_at at time zone 'Asia/Singapore')::date,
  ((p_ends_at-interval '15 minutes') at time zone 'Asia/Singapore')::date,null,p_starts_at,p_ends_at);
end $$;
revoke all on function public.preview_venue_block_period(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.preview_venue_block_period(uuid,timestamptz,timestamptz) to authenticated;

-- Exact closure membership in hold_venue.
create or replace function public.hold_venue(
 p_event_id uuid, p_venue_id uuid, p_hold_days integer default 3
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
 insert into public.venue_bookings(event_id,venue_id,requested_by,status,hold_expires_at)
 values(p_event_id,p_venue_id,auth.uid(),'held',now()+p_hold_days*interval '24 hours')
 returning id into booking;
 insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select p_venue_id,c.slot_date,c.slot,c.kind,booking
 from public.venue_review_cells(p_venue_id,e.proposed_start,e.proposed_end) c;
 -- The ledger primary key refuses concurrent overlaps; any error rolls back
 -- the booking and all its cells together, including expiry cleanup above.
 return booking;
end $$;

-- Exact closure membership in approve_venue_booking.
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

-- Exact closure membership in get_venue_booking_review.
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

-- Exact closure membership in revalidate_event_arrangements.
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

-- Exact closure membership in reblock_released_cell.
create or replace function public.reblock_released_cell()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_covering uuid;
begin
  if old.kind = 'maintenance' then
    return old;
  end if;

  select vc.id into v_covering
  from public.venue_closures vc
  where vc.venue_id = old.venue_id
    and vc.removed_at is null
    and public.venue_closure_covers(vc.id,old.slot_date,old.slot)
  limit 1;

  if v_covering is not null then
    insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
    values (old.venue_id, old.slot_date, old.slot, 'maintenance', v_covering)
    on conflict (venue_id, slot_date, slot) do nothing;
  end if;
  return old;
end;
$$;

commit;
