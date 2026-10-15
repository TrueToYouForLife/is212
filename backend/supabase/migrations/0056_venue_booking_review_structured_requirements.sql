-- US2/US6 structured event requirements, part 3 (follows 0055). Safe to replay.
--
-- 0044's get_venue_booking_review hands Venue Staff the organiser's requirements as
-- 'layoutPreference' plus 'accessibilityNotes'. Both read event columns that are now a
-- code and a code list, so "Notes" is the wrong word and the value is no longer a string.
-- This replaces the function so the event's own requirements come back as catalogue
-- codes, and adds the facility list 0054 introduced.
--
-- The coordinator's structured overlay from 0023 (keys 'requirementsRecorded', 'layout',
-- 'accessibility', 'facilities') is returned exactly as before: whether that overlay is
-- still needed now that the organiser's own fields are structured is US18's call, not
-- this migration's.
--
-- Everything else is carried over character for character from 0045's definition, which
-- is the current one — the Venue Staff check, the 'reviewVersion' key approval compares
-- against, the cells/conflicts lateral joins, the 'blocked_period' branch, the ordering
-- and the P0002 on a missing booking. Only the three keys above differ. 0044 defines an
-- earlier version of this function: basing a replacement on that one silently drops
-- 'reviewVersion' and every approval then fails with "Request changed".
begin;

-- The version a Venue Staff member approves against must change when anything they were
-- shown changes. 0045 hashes the organiser's layout and accessibility for that reason, so
-- the facility list 0054 added belongs in the hash too: otherwise a facility requirement
-- could be added after the screen was loaded and the approval would still go through.
create or replace function public.venue_booking_review_version(p_booking_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(b),e.proposed_start,e.proposed_end,e.status,
   e.name,e.reference,e.expected_attendance,e.layout_preference,
   e.accessibility_requirements,e.facility_requirements,
   e.special_arrangements,e.coordinator_id,to_jsonb(r))::text)
 from public.venue_bookings b join public.events e on e.id=b.event_id
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
commit;
