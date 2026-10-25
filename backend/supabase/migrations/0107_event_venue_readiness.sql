-- US49 Slice 2: AC4-6. Preserve independent decisions and other US5 readiness lines.
begin;

create or replace function public.get_event_readiness(p_event_id uuid)
returns table (arrangement text, label text, complete boolean, detail text, sort_order integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  e                  public.events;
  v_confirmed        integer;
  v_rejected         integer;
  v_waiting          integer;
  v_held             integer;
  v_requirements     integer;
  v_essential        integer;
  v_essential_ready  integer;
  v_unavailable      integer;
  v_pending_review   integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see an event''s readiness' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  -- AC-005.4: the event's own Coordinator only.
  if public.current_user_role() is distinct from 'coordinator' or e.coordinator_id is distinct from auth.uid() then
    raise exception 'Only the event''s assigned Coordinator can see its readiness' using errcode = '42501';
  end if;

  -- Every live booking is required. Rejected requirements remain outstanding.
  -- Cancelled/expired attempts remain visible history but do not count as live requirements.
  select count(*) filter (where b.status = 'rejected'),
         count(*) filter (where b.status = 'confirmed'),
         count(*) filter (where b.status = 'pending_approval'),
         count(*) filter (where b.status = 'held' and b.hold_expires_at > now())
    into v_rejected, v_confirmed, v_waiting, v_held
  from public.venue_bookings b where b.event_id = e.id;

  arrangement := 'venue_booking';
  label := 'Venue booking';
  complete := v_confirmed > 0 and v_waiting = 0 and v_held = 0 and v_rejected = 0;
  detail := case
    when v_confirmed + v_waiting + v_held + v_rejected = 0 then 'No venue booked yet.'
    when complete then format('%s approved.', case when v_confirmed = 1 then '1 venue booking' else v_confirmed || ' venue bookings' end)
    else concat_ws(' ',
      case when v_rejected > 0 then format('%s rejected; venue requirements remain outstanding.', v_rejected) end,
      case when v_waiting > 0 then format('%s awaiting Venue Staff.', case when v_waiting = 1 then '1 booking' else v_waiting || ' bookings' end) end,
      case when v_held > 0 then format('%s held, not yet requested.', case when v_held = 1 then '1 booking' else v_held || ' bookings' end) end,
      case when v_confirmed > 0 then format('%s approved.', v_confirmed) end)
  end;
  sort_order := 1;
  return next;

  -- Equipment, only for an event that has equipment requirements (AC-005.8).
  select count(*),
         count(*) filter (where r.essential),
         count(*) filter (where r.essential and r.status = 'reserved'),
         count(*) filter (where r.essential and r.status = 'unavailable'),
         count(*) filter (where r.status = 'pending_review')
    into v_requirements, v_essential, v_essential_ready, v_unavailable, v_pending_review
  from public.event_equipment_requirements r where r.event_id = e.id;

  if v_requirements > 0 then
    arrangement := 'equipment_reservation';
    label := 'Equipment reservation';
    complete := v_essential_ready = v_essential;
    detail := case
      when v_essential = 0 then 'No essential equipment needed.'
      else concat_ws(' ',
        format('%s of %s essential %s reserved.', v_essential_ready, v_essential, case when v_essential = 1 then 'item' else 'items' end),
        case when v_unavailable > 0 then format('%s unavailable.', v_unavailable) end)
    end;
    sort_order := 2;
    return next;

    -- Nobody is assigned to an event as its Technical Support; what the app records is
    -- Technical Support reviewing each equipment request (US13).
    arrangement := 'technical_support';
    label := 'Technical support';
    complete := v_pending_review = 0;
    detail := case
      when complete then 'Technical Support has reviewed every equipment request.'
      else format('%s awaiting Technical Support.',
                  case when v_pending_review = 1 then '1 equipment request' else v_pending_review || ' equipment requests' end)
    end;
    sort_order := 3;
    return next;
  end if;

  arrangement := 'programme';
  label := 'Programme';
  complete := nullif(btrim(coalesce(e.programme, '')), '') is not null;
  detail := case when complete then 'Programme added.' else 'No programme yet.' end;
  sort_order := 4;
  return next;

  -- Registration, only for an event that takes registrations (AC-005.8). Attendees can
  -- register once the event is Confirmed (US15, US52).
  if e.registration_required then
    arrangement := 'registration_setup';
    label := 'Registration setup';
    complete := e.status = 'confirmed';
    detail := case
      when complete then 'Registration is open to Attendees.'
      else 'Registration opens to Attendees once the event is confirmed.'
    end;
    sort_order := 5;
    return next;
  end if;
end $$;
revoke all on function public.get_event_readiness(uuid) from public, anon;
grant execute on function public.get_event_readiness(uuid) to authenticated;

-- Read-only event summary. Do not expose internal staff identities or bypass assignment.
create or replace function public.get_event_venue_bookings(p_event_id uuid)
returns table(booking_id uuid, venue_name text, status text, space_layout text,
 space_attendance integer, review_note text, review_alternative text, created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id;
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator'
    or e.coordinator_id is distinct from auth.uid() then
   raise exception 'Only the assigned Coordinator can see all venue bookings' using errcode='42501';
 end if;
 return query select b.id,v.name::text,
   case when b.status='held' and b.hold_expires_at<=now() then 'expired' else b.status::text end,
   b.space_layout,b.space_attendance,b.review_note,b.review_alternative,b.created_at
 from public.venue_bookings b join public.venues v on v.id=b.venue_id
 where b.event_id=e.id order by b.created_at,b.id;
end $$;
revoke all on function public.get_event_venue_bookings(uuid) from public,anon;
grant execute on function public.get_event_venue_bookings(uuid) to authenticated;
commit;
