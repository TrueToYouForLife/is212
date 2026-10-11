-- US10 Slice 2, AC2: bounded Venue Staff read; no general event SELECT grant.
begin;
-- Same half-open Singapore windows and neighbouring buffer cells as slots.ts.
-- Internal helper: callers cannot use this to bypass the staff-only read operation.
create or replace function public.venue_review_cells(p_start timestamptz,p_end timestamptz)
returns table(slot_date date,slot text,kind text)
language sql stable set search_path = '' as $$
 with windows as (
  select d::date as slot_date,t.code as slot,
   row_number() over(order by d,t.sort_order) as seq,
   (d::date+t.starts_at) at time zone 'Asia/Singapore' as starts_at,
   (d::date+t.ends_at) at time zone 'Asia/Singapore' as ends_at
  from generate_series((p_start at time zone 'Asia/Singapore')::date-1,
    (p_end at time zone 'Asia/Singapore')::date+1,interval '1 day') d
  cross join public.time_slots t
 ), bounds as (
  select min(seq) as lo,max(seq) as hi from windows
  where starts_at<p_end and ends_at>p_start and p_end>p_start
 )
 select w.slot_date,w.slot,case when w.seq between b.lo and b.hi then 'event' else 'buffer' end
 from windows w cross join bounds b where w.seq between b.lo-1 and b.hi+1 order by w.seq
$$;
revoke execute on function public.venue_review_cells(timestamptz,timestamptz) from public,anon,authenticated;

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
