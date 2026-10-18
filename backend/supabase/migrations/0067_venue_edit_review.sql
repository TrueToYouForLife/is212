-- US46 Add and edit venue details (SCRUM-241), slice 2: edit a venue.
-- AC-046.2 Venue Staff can edit any detail. AC-046.4 an edit never changes a booking's status;
-- bookings it may have made unsuitable are flagged for review and their Coordinators notified.
-- Apply after 0066. Safe to replay.
--
-- Reviews use the arrangement review records of US41 (0052) and US20 (0063): the same flags,
-- notifications and resolution, so a Coordinator sees every reason to recheck an arrangement in
-- one place. Each flag points at the venue_changes row (0064) that caused it.
begin;

-- ---------------------------------------------------------------------------
-- AC-046.4: a venue change can be the source of an arrangement review
-- ---------------------------------------------------------------------------
alter table public.arrangement_review_flags
  add column if not exists venue_change_id uuid references public.venue_changes (id);

alter table public.arrangement_review_flags drop constraint if exists arrangement_review_source;
alter table public.arrangement_review_flags add constraint arrangement_review_source
  check (num_nonnulls(change_request_id, planning_update_id, venue_change_id) = 1);

create unique index if not exists venue_change_review_reason on public.arrangement_review_flags
  (venue_change_id, venue_booking_id, reason_code) where venue_change_id is not null;

-- 0063's reasons plus one: operating hours that no longer cover a booked slot.
-- Only widened, never narrowed: if the list already has venue_hours_review (a later migration may have
-- added more reasons since), a replay leaves it alone instead of dropping theirs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.arrangement_review_flags'::regclass
      and conname = 'arrangement_review_flags_reason_code_check'
      and pg_get_constraintdef(oid) like '%venue_hours_review%'
  ) then
    alter table public.arrangement_review_flags drop constraint if exists arrangement_review_flags_reason_code_check;
    alter table public.arrangement_review_flags add constraint arrangement_review_flags_reason_code_check
      check (reason_code in ('venue_time_conflict', 'venue_timing_changed', 'venue_capacity', 'venue_layout_review',
        'venue_accessibility_review', 'venue_facility_review', 'venue_hours_review',
        'equipment_time_conflict', 'equipment_timing_changed', 'equipment_requirements_review'));
  end if;
end $$;

drop function if exists public.record_venue_change_review(uuid, uuid, uuid, text, text);

-- Records one review and notifies the event's current Coordinator, as 0063's
-- record_arrangement_review does. An event with no Coordinator gets the flag and no notice;
-- whoever the Lead assigns sees it.
--
-- If the booking already has an open venue review for this reason, that review is brought up
-- to date instead: its detail becomes the latest one and it points at the newest edit, so a
-- Coordinator never acts on figures a later edit has replaced. It is not notified again:
-- 0052 keeps one notice per review, and the open review already shows in their panel.
create or replace function public.record_venue_change_review(
  p_change uuid, p_event uuid, p_booking uuid, p_code text, p_detail text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_flag uuid;
  v_recipient uuid;
begin
  update public.arrangement_review_flags f
  set detail = p_detail, venue_change_id = p_change
  where f.venue_booking_id = p_booking and f.reason_code = p_code
    and f.venue_change_id is not null and f.status = 'open';
  if found then return; end if;

  insert into public.arrangement_review_flags (venue_change_id, event_id, venue_booking_id, reason_code, detail)
  values (p_change, p_event, p_booking, p_code, p_detail)
  on conflict do nothing
  returning id into v_flag;
  if v_flag is null then return; end if;

  select e.coordinator_id into v_recipient
  from public.events e join public.profiles p on p.id = e.coordinator_id and p.role = 'coordinator'
  where e.id = p_event;
  if v_recipient is not null then
    insert into public.arrangement_review_notifications (flag_id, event_id, recipient_id, detail)
    values (v_flag, p_event, v_recipient, p_detail);
  end if;
end $$;
revoke all on function public.record_venue_change_review(uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- The layout an event needs: the same rule 0063 applies when an event changes. An approved
-- layout change supersedes the Coordinator's structured requirement unless that is newer.
create or replace function public.event_requested_layout(p_event uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when r.updated_at > coalesce((select max(q.created_at) from (
           select created_at from public.event_change_revalidations
           where event_id = e.id and 'layoutPreference' = any (approved_fields)
           union all
           select changed_at from public.event_planning_updates
           where event_id = e.id and changes ? 'layoutPreference') q), '-infinity'::timestamptz)
      then coalesce(r.layout, public.layout_code(e.layout_preference))
    else coalesce(public.layout_code(e.layout_preference), r.layout)
  end
  from public.events e left join public.event_venue_requirements r on r.event_id = e.id
  where e.id = p_event;
$$;
revoke all on function public.event_requested_layout(uuid) from public, anon, authenticated;

-- A recorded old or new value may be JSON null (a column that was empty); treat it as empty.
create or replace function public.venue_change_list(p_value jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end;
$$;
create or replace function public.venue_change_object(p_value jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'object' then p_value else '{}'::jsonb end;
$$;
revoke all on function public.venue_change_list(jsonb) from public, anon, authenticated;
revoke all on function public.venue_change_object(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.4: check the bookings one recorded change may have made unsuitable
-- ---------------------------------------------------------------------------
-- Only live bookings (held and not lapsed, awaiting Venue Staff, or confirmed) of events that
-- have not ended. Only what this change took away is flagged, so an edit is never blamed for
-- a problem it did not cause. Name and location changes are not reviewed. Nothing about the
-- booking itself changes.
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
    select vb.id as booking_id, e.id as event_id, e.expected_attendance,
           coalesce(e.accessibility_requirements, '{}') as accessibility_required,
           coalesce(e.facility_requirements, '{}') as facilities_required
    from public.venue_bookings vb join public.events e on e.id = vb.event_id
    where vb.venue_id = c.venue_id
      and (vb.status in ('pending_approval', 'confirmed') or (vb.status = 'held' and vb.hold_expires_at > now()))
      and e.proposed_end > now()
  loop
    if c.action = 'layout_removed' then
      v_layout := public.event_requested_layout(b.event_id);
      if v_layout = c.details ->> 'layout' then
        perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_layout_review',
          format('%s no longer offers the %s layout this event requested. Check the arrangement or find another venue; the booking is unchanged.',
                 v.name, v_layout));
      end if;

    elsif c.action = 'layout_updated' then
      v_layout := public.event_requested_layout(b.event_id);
      v_capacity := (c.details -> 'capacity' ->> 'to')::integer;
      if v_layout = c.details ->> 'layout'
         and v_capacity < (c.details -> 'capacity' ->> 'from')::integer
         and b.expected_attendance > v_capacity then
        perform public.record_venue_change_review(c.id, b.event_id, b.booking_id, 'venue_capacity',
          format('%s: capacity for the %s layout is now %s; this event expects %s. The booking is unchanged.',
                 v.name, v_layout, v_capacity, b.expected_attendance));
      end if;

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
revoke all on function public.review_bookings_for_venue_change(uuid) from public, anon, authenticated;

-- 0064's history triggers now also start the review, so every path that changes a venue or
-- its layouts is checked, not only the edit page. The recorded values are unchanged.
create or replace function public.record_venue_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_column  text;
  v_change  uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.venue_changes (venue_id, action, changed_by, details)
    values (new.id, 'created', auth.uid(), jsonb_build_object('name', new.name));
    return new;
  end if;

  foreach v_column in array array[
    'name', 'location', 'capacity', 'layout', 'accessibility', 'facility', 'status',
    'opens_at', 'closes_at'
  ] loop
    if (to_jsonb(old) -> v_column) is distinct from (to_jsonb(new) -> v_column) then
      v_changes := v_changes || jsonb_build_object(
        v_column, jsonb_build_object('from', to_jsonb(old) -> v_column, 'to', to_jsonb(new) -> v_column));
    end if;
  end loop;

  if v_changes <> '{}'::jsonb then
    insert into public.venue_changes (venue_id, action, changed_by, details)
    values (new.id, 'updated', auth.uid(), v_changes)
    returning id into v_change;
    perform public.review_bookings_for_venue_change(v_change);
  end if;
  return new;
end $$;
revoke execute on function public.record_venue_change() from public, anon, authenticated;

create or replace function public.record_venue_layout_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_change uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.venue_changes (venue_id, action, changed_by, details)
    values (new.venue_id, 'layout_added', auth.uid(),
            jsonb_build_object('layout', new.layout, 'capacity', new.capacity));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.capacity is distinct from old.capacity then
      insert into public.venue_changes (venue_id, action, changed_by, details)
      values (new.venue_id, 'layout_updated', auth.uid(),
              jsonb_build_object('layout', new.layout,
                                 'capacity', jsonb_build_object('from', old.capacity, 'to', new.capacity)))
      returning id into v_change;
      perform public.review_bookings_for_venue_change(v_change);
    end if;
    return new;
  end if;
  -- A layout removed because its venue is being deleted has nowhere left to be recorded.
  if exists (select 1 from public.venues v where v.id = old.venue_id) then
    insert into public.venue_changes (venue_id, action, changed_by, details)
    values (old.venue_id, 'layout_removed', auth.uid(),
            jsonb_build_object('layout', old.layout, 'capacity', old.capacity))
    returning id into v_change;
    perform public.review_bookings_for_venue_change(v_change);
  end if;
  return old;
end $$;
revoke execute on function public.record_venue_layout_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.1, AC-046.2, AC-046.3: one set of checks for adding and editing
-- ---------------------------------------------------------------------------
-- Moved out of 0064's add_venue unchanged, so a venue is checked the same way however it is
-- saved. Returns the primary layout: the largest, the first listed on a tie.
create or replace function public.check_venue_input(
  p_name text, p_location text, p_opens_at time, p_closes_at time,
  p_accessibility text[], p_facilities text[], p_layouts jsonb,
  out primary_layout text, out primary_capacity integer)
language plpgsql stable set search_path = '' as $$
declare
  v_layout   jsonb;
  v_code     text;
  v_capacity integer;
  v_seen     text[] := '{}';
begin
  primary_capacity := 0;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'A venue needs a name' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_location, '')), '') is null then
    raise exception 'A venue needs a location' using errcode = '22023';
  end if;
  if p_opens_at is null or p_closes_at is null then
    raise exception 'A venue needs opening and closing times' using errcode = '22023';
  end if;
  if p_layouts is null or jsonb_typeof(p_layouts) <> 'array' or jsonb_array_length(p_layouts) = 0 then
    raise exception 'A venue needs at least one layout' using errcode = '22023';
  end if;
  for v_layout in select * from jsonb_array_elements(p_layouts) loop
    v_code := v_layout ->> 'layout';
    if v_code is null or not exists (select 1 from public.layout_types t where t.code = v_code) then
      raise exception 'Unknown layout: %', coalesce(v_code, '(none)') using errcode = '22023';
    end if;
    if v_code = any (v_seen) then
      raise exception 'Each layout can be listed only once' using errcode = '22023';
    end if;
    v_seen := v_seen || v_code;
    if jsonb_typeof(v_layout -> 'capacity') is distinct from 'number'
       or (v_layout ->> 'capacity')::numeric <> trunc((v_layout ->> 'capacity')::numeric)
       or (v_layout ->> 'capacity')::numeric < 1 then
      raise exception 'Every layout needs a capacity of at least 1' using errcode = '22023';
    end if;
    v_capacity := (v_layout ->> 'capacity')::integer;
    if v_capacity > primary_capacity then
      primary_layout := v_code;
      primary_capacity := v_capacity;
    end if;
  end loop;
  if exists (select 1 from unnest(coalesce(p_accessibility, '{}')) a(code)
             where not exists (select 1 from public.accessibility_types t where t.code = a.code)) then
    raise exception 'Unknown accessibility feature' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_facilities, '{}')) f(code)
             where not exists (select 1 from public.facility_types t where t.code = f.code)) then
    raise exception 'Unknown facility' using errcode = '22023';
  end if;
end $$;
-- Pure checks with no access of its own, called by add_venue and update_venue as the caller.
revoke all on function public.check_venue_input(text, text, time, time, text[], text[], jsonb) from public, anon;
grant execute on function public.check_venue_input(text, text, time, time, text[], text[], jsonb) to authenticated;

create or replace function public.add_venue(
  p_name text, p_location text, p_opens_at time, p_closes_at time,
  p_accessibility text[], p_facilities text[], p_layouts jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_venue_id uuid;
  v_primary  record;
begin
  if public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can add venues' using errcode = '42501';
  end if;
  select * into v_primary from public.check_venue_input(
    p_name, p_location, p_opens_at, p_closes_at, p_accessibility, p_facilities, p_layouts);

  insert into public.venues (name, location, capacity, layout, accessibility, facility, status, opens_at, closes_at)
  values (
    btrim(p_name), btrim(p_location), v_primary.primary_capacity, v_primary.primary_layout,
    (select coalesce(array_agg(distinct a), '{}') from unnest(coalesce(p_accessibility, '{}')) a),
    (select coalesce(jsonb_object_agg(f, true), '{}'::jsonb) from (select distinct unnest(coalesce(p_facilities, '{}')) f) d),
    'active', p_opens_at, p_closes_at)
  returning id into v_venue_id;

  -- The primary layout is already in venue_layouts through 0022's sync trigger.
  insert into public.venue_layouts (venue_id, layout, capacity)
  select v_venue_id, l ->> 'layout', (l ->> 'capacity')::integer
  from jsonb_array_elements(p_layouts) l
  where l ->> 'layout' <> v_primary.primary_layout;

  return v_venue_id;
end $$;
revoke execute on function public.add_venue(text, text, time, time, text[], text[], jsonb) from public, anon;
grant execute on function public.add_venue(text, text, time, time, text[], text[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.2: open a venue for editing, and save it
-- ---------------------------------------------------------------------------
-- A fingerprint of everything the edit form shows. Saving checks it is unchanged, so one
-- person's edit never silently overwrites another's, including layout-only edits that would
-- not move venues.updated_at.
create or replace function public.venue_edit_version(p_venue uuid)
returns text language sql stable security definer set search_path = '' as $$
  select md5(
    jsonb_build_array(v.name, v.location, v.accessibility, v.facility, v.status, v.opens_at, v.closes_at)::text
    || coalesce((select jsonb_agg(jsonb_build_array(l.layout, l.capacity) order by l.layout)::text
                 from public.venue_layouts l where l.venue_id = v.id), '[]'))
  from public.venues v where v.id = p_venue;
$$;
-- Reveals nothing a signed-in user cannot already read about a venue; update_venue calls it as the caller.
revoke all on function public.venue_edit_version(uuid) from public, anon;
grant execute on function public.venue_edit_version(uuid) to authenticated;

create or replace function public.get_venue_for_edit(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can edit venues' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'location', v.location,
    'status', v.status,
    'opensAt', to_char(v.opens_at, 'HH24:MI'),
    'closesAt', to_char(v.closes_at, 'HH24:MI'),
    'accessibility', to_jsonb(coalesce(v.accessibility, '{}')),
    'facilities', coalesce((select jsonb_agg(f.key order by f.key) from jsonb_each(v.facility) f
                            where f.value = 'true'::jsonb), '[]'::jsonb),
    'layouts', coalesce((select jsonb_agg(jsonb_build_object('layout', l.layout, 'capacity', l.capacity)
                                          order by l.capacity desc, l.layout)
                         from public.venue_layouts l where l.venue_id = v.id), '[]'::jsonb),
    'version', public.venue_edit_version(v.id))
  into v_result
  from public.venues v where v.id = p_venue_id;
  if v_result is null then
    raise exception 'Venue not found' using errcode = 'P0002';
  end if;
  return v_result;
end $$;
revoke all on function public.get_venue_for_edit(uuid) from public, anon;
grant execute on function public.get_venue_for_edit(uuid) to authenticated;

-- How many bookings at a venue were sent for review by the changes not in p_before: the
-- venue's change records from before a save. Counts bookings, not review records, since one
-- booking can be reviewed for several reasons, and includes open reviews a save refreshed.
-- SECURITY DEFINER: Venue Staff cannot read the flags themselves (they are the Coordinator's);
-- a count for a venue reveals nothing about any event.
create or replace function public.count_venue_reviewed_bookings(p_venue uuid, p_before uuid[])
returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct f.venue_booking_id)::integer from public.arrangement_review_flags f
  join public.venue_changes c on c.id = f.venue_change_id
  where c.venue_id = p_venue and not (c.id = any (coalesce(p_before, '{}')));
$$;
revoke all on function public.count_venue_reviewed_bookings(uuid, uuid[]) from public, anon;
grant execute on function public.count_venue_reviewed_bookings(uuid, uuid[]) to authenticated;

-- Saves every detail together or nothing at all. Layouts are written before the venue row, so
-- 0022's sync of the primary layout finds them already correct and records nothing twice.
-- Returns how many bookings this edit sent for review.
create or replace function public.update_venue(
  p_venue_id uuid, p_version text,
  p_name text, p_location text, p_opens_at time, p_closes_at time,
  p_accessibility text[], p_facilities text[], p_layouts jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_primary record;
  v_changes_before uuid[];
begin
  if public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can edit venues' using errcode = '42501';
  end if;
  perform 1 from public.venues where id = p_venue_id for update;
  if not found then
    raise exception 'Venue not found' using errcode = 'P0002';
  end if;
  if public.venue_edit_version(p_venue_id) is distinct from p_version then
    raise exception 'This venue was changed by someone else. Reload it before saving.' using errcode = '40001';
  end if;
  select * into v_primary from public.check_venue_input(
    p_name, p_location, p_opens_at, p_closes_at, p_accessibility, p_facilities, p_layouts);
  select coalesce(array_agg(id), '{}') into v_changes_before from public.venue_changes where venue_id = p_venue_id;

  delete from public.venue_layouts l
  where l.venue_id = p_venue_id
    and l.layout not in (select x ->> 'layout' from jsonb_array_elements(p_layouts) x);
  insert into public.venue_layouts (venue_id, layout, capacity)
  select p_venue_id, x ->> 'layout', (x ->> 'capacity')::integer from jsonb_array_elements(p_layouts) x
  on conflict (venue_id, layout) do update set capacity = excluded.capacity
  where public.venue_layouts.capacity is distinct from excluded.capacity;

  update public.venues set
    name = btrim(p_name),
    location = btrim(p_location),
    capacity = v_primary.primary_capacity,
    layout = v_primary.primary_layout,
    accessibility = (select coalesce(array_agg(distinct a order by a), '{}') from unnest(coalesce(p_accessibility, '{}')) a),
    facility = (select coalesce(jsonb_object_agg(f, true), '{}'::jsonb) from (select distinct unnest(coalesce(p_facilities, '{}')) f) d),
    opens_at = p_opens_at,
    closes_at = p_closes_at
  where id = p_venue_id;

  return public.count_venue_reviewed_bookings(p_venue_id, v_changes_before);
end $$;
revoke execute on function public.update_venue(uuid, text, text, text, time, time, text[], text[], jsonb) from public, anon;
grant execute on function public.update_venue(uuid, text, text, text, time, time, text[], text[], jsonb) to authenticated;

commit;
