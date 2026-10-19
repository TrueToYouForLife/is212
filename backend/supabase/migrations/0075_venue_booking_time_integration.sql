-- INCOMPLETE US47 migration: conversion, cell calculation and block checkpoint. DO NOT DEPLOY.
-- Move to migrations only with compatible booking functions and frontend readers.
begin;
lock table public.time_slots, public.venue_closures, public.venue_slot_claims
  in access exclusive mode;

-- Preserve actual catalogue intervals rather than guessing from mutable event dates.
create temp table us47_legacy_slots on commit drop as
 select * from public.time_slots where code in ('AM','PM','NIGHT');
do $$
begin
 if exists(select 1 from us47_legacy_slots
   where extract(epoch from starts_at)::integer % 900 <> 0
      or extract(epoch from ends_at)::integer % 900 <> 0
      or ends_at <= starts_at) then
  raise exception 'Legacy slot boundaries cannot be converted exactly';
 end if;
end $$;
create temp table us47_legacy_claims on commit drop as
 select c.* from public.venue_slot_claims c join us47_legacy_slots t on t.code=c.slot;

alter table public.time_slots drop constraint if exists time_slots_code_check;
-- Free the unique sort-order values while both catalogues temporarily coexist.
update public.time_slots set sort_order=sort_order+1000
 where code in ('AM','PM','NIGHT');
insert into public.time_slots(code,starts_at,ends_at,sort_order)
select 'T'||to_char(time '00:00'+make_interval(mins=>n*15),'HH24MI'),
 time '00:00'+make_interval(mins=>n*15),
 case when n=95 then time '24:00' else time '00:00'+make_interval(mins=>(n+1)*15) end,
 n+1
from generate_series(0,95) n
on conflict(code) do nothing;

-- Refuse an unexpected pre-existing catalogue instead of silently changing its meaning.
do $$
begin
 if exists(select 1 from generate_series(0,95) n
 left join public.time_slots t
 on t.code='T'||to_char(time '00:00'+make_interval(mins=>n*15),'HH24MI')
 where t.code is null or t.starts_at <> time '00:00'+make_interval(mins=>n*15)
 or t.ends_at <> case when n=95 then time '24:00' else time '00:00'+make_interval(mins=>(n+1)*15) end
 or t.sort_order <> n+1) then
  raise exception 'Unexpected 15-minute slot catalogue';
 end if;
end $$;

-- A conversion is not a release or a new booking. Normal DELETE/INSERT triggers
-- would otherwise re-block removed legacy cells or refuse confirmed bookings.
alter table public.venue_slot_claims disable trigger venue_slot_claims_reblock;
alter table public.venue_slot_claims disable trigger venue_claims_protect_confirmed;
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id,closure_id)
select c.venue_id,c.slot_date,t.code,c.kind,c.booking_id,c.closure_id
from us47_legacy_claims c join us47_legacy_slots old on old.code=c.slot
join public.time_slots t on t.code like 'T%'
 and t.starts_at>=old.starts_at and t.ends_at<=old.ends_at;
-- No ON CONFLICT: unexpected overlapping occupancy must abort the entire migration.
delete from public.venue_slot_claims where slot in (select code from us47_legacy_slots);
alter table public.venue_slot_claims enable trigger venue_slot_claims_reblock;
alter table public.venue_slot_claims enable trigger venue_claims_protect_confirmed;

-- Preserve definitions even when a booking owns cells beneath an active block,
-- and retain removed block records without recreating their occupancy.
update public.venue_closures c set slots=(
 select array_agg(x.code order by x.sort_order) from (
  select distinct t.code,t.sort_order
  from unnest(c.slots) s
  join public.time_slots t on t.code=s
    or exists(select 1 from us47_legacy_slots old where old.code=s
      and t.code like 'T%' and t.starts_at>=old.starts_at and t.ends_at<=old.ends_at)
  where t.code not in ('AM','PM','NIGHT')
 ) x
) where c.slots && array['AM','PM','NIGHT'];

delete from public.time_slots where code in ('AM','PM','NIGHT');
alter table public.time_slots add constraint time_slots_code_check
 check(code ~ '^T([01][0-9]|2[0-3])(00|15|30|45)$');
-- New whole-day blocks cover the new catalogue; legacy blocks keep their exact gaps.
do $$
declare codes text[];
begin
 select array_agg(code order by sort_order) into codes from public.time_slots;
 execute format('alter table public.venue_closures alter column slots set default %L::text[]',codes);
end $$;

-- Venue-aware overload. Older callers remain unchanged until the next checkpoint.
-- Any touched quarter-hour cell is occupied; exact event instants are not rewritten.
create or replace function public.venue_review_cells(
 p_venue_id uuid, p_start timestamptz, p_end timestamptz
)
returns table(slot_date date,slot text,kind text)
language plpgsql stable set search_path = '' as $$
declare v_setup integer; v_turnaround integer; occupied tstzrange;
begin
 select v.setup_minutes,v.turnaround_minutes into v_setup,v_turnaround
 from public.venues v where v.id=p_venue_id;
 if not found then raise exception 'Venue unavailable' using errcode='22023'; end if;
 occupied := public.venue_occupied_period(p_start,p_end,v_setup,v_turnaround);
 return query
 with windows as (
  select d::date as cell_date,t.code,
   (d::date+t.starts_at) at time zone 'Asia/Singapore' starts,
   (d::date+t.ends_at) at time zone 'Asia/Singapore' ends
  from generate_series((lower(occupied) at time zone 'Asia/Singapore')::date::timestamp,
    (upper(occupied) at time zone 'Asia/Singapore')::date::timestamp,interval '1 day') d
  cross join public.time_slots t
 )
 select w.cell_date,w.code,case when w.starts<p_end and w.ends>p_start then 'event' else 'buffer' end
 from windows w where w.starts<upper(occupied) and w.ends>lower(occupied)
 order by w.cell_date,w.code;
end;
$$;
revoke all on function public.venue_review_cells(uuid,timestamptz,timestamptz)
 from public,anon,authenticated;

-- Preview and block creation already share this validator. Read the catalogue
-- instead of accepting the removed AM/PM/NIGHT codes or hardcoding 96 values.
create or replace function public.venue_block_request_slots(
 p_venue_id uuid,p_starts_on date,p_ends_on date,p_slots text[]
)
returns text[] language plpgsql stable security definer set search_path='' as $$
declare v_status text;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then
  raise exception 'Only Venue Staff can block a venue' using errcode='42501';
 end if;
 select status into v_status from public.venues where id=p_venue_id;
 if not found then raise exception 'That venue could not be found' using errcode='P0002'; end if;
 if v_status='retired' then raise exception 'A retired venue cannot be blocked' using errcode='22023'; end if;
 if p_starts_on is null or p_ends_on is null or not isfinite(p_starts_on)
  or not isfinite(p_ends_on) or p_ends_on<p_starts_on or p_ends_on-p_starts_on>365 then
  raise exception 'Choose a finite block period of one to 366 days' using errcode='22023';
 end if;
 if p_slots is null or cardinality(p_slots)=0 or exists(
  select 1 from unnest(p_slots) s where s is null or not exists(
   select 1 from public.time_slots t where t.code=s)) then
  raise exception 'Choose valid 15-minute slots to block' using errcode='22023';
 end if;
 return array(select t.code from public.time_slots t where t.code=any(p_slots) order by t.sort_order);
end;
$$;
revoke all on function public.venue_block_request_slots(uuid,date,date,text[]) from public,anon,authenticated;

-- Keep existing block ownership, flags and notifications; sort new slot codes chronologically.
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
  from public.venue_slot_claims c
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


-- The browser will use this atomic operation once the corresponding UI is ready.
-- Keep the existing three-day default; this migration does not redefine US11 expiry.
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
   and c.slot_date between v.starts_on and v.ends_on and c.slot=any(v.slots)) then
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
revoke execute on function public.hold_venue(uuid,uuid,integer) from public,anon;
grant execute on function public.hold_venue(uuid,uuid,integer) to authenticated;

-- Preserve structured requirements from 0056 and approval safeguards from 0045.
-- Venue edits invalidate the version presented to Venue Staff.
create or replace function public.venue_booking_review_version(p_booking_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(b),e.proposed_start,e.proposed_end,e.status,
   e.name,e.reference,e.expected_attendance,e.layout_preference,
   e.accessibility_requirements,e.facility_requirements,
   e.special_arrangements,e.coordinator_id,to_jsonb(r),to_jsonb(v))::text)
 from public.venue_bookings b join public.events e on e.id=b.event_id
 join public.venues v on v.id=b.venue_id
 left join public.event_venue_requirements r on r.event_id=e.id where b.id=p_booking_id
$$;
revoke execute on function public.venue_booking_review_version(uuid) from public,anon,authenticated;

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
 if venue_status<>'active' or e.status not in ('approved','planning') then
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


-- Preserve 0063 review reasons, sources and equipment rules; use each booking venue.
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
     or exists(select 1 from public.venue_slot_claims s
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

-- Existing opening/closing boundaries remain valid; new edits may use any quarter hour.
alter table public.venues drop constraint if exists venues_operating_hours_valid;
alter table public.venues add constraint venues_operating_hours_valid check (
 (opens_at is null and closes_at is null) or
 (opens_at is not null and closes_at is not null and closes_at > opens_at
  and mod(extract(epoch from opens_at)::numeric,900)=0
  and mod(extract(epoch from closes_at)::numeric,900)=0)
);
commit;
