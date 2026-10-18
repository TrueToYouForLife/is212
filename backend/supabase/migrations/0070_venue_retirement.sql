-- US46 Add and edit venue details (SCRUM-241), slice 3: retire a venue.
-- AC-046.5 Venue Staff can retire a venue: it no longer appears in venue search, its future
-- bookings are flagged for review rather than cancelled, and their Coordinators are notified.
-- Apply after 0069. Safe to replay.
--
-- Venue search (US8) shows active venues only, and suitability (US18) and availability (US19)
-- leave retired ones out, so retiring hides a venue there already. This migration records the
-- retirement, reviews its bookings through the arrangement reviews 0067 extended, and stops
-- new holds on a retired venue.
begin;

-- Why a venue was retired, shown to the Coordinators whose bookings it affects. Only a
-- retired venue has one; venues retired before 0070 may have none.
alter table public.venues add column if not exists retirement_note text;
alter table public.venues drop constraint if exists venues_retirement_note_valid;
alter table public.venues add constraint venues_retirement_note_valid check (
  retirement_note is null or (status = 'retired' and length(btrim(retirement_note)) > 0)
);

-- 0067's reasons plus one: the venue has been retired.
-- Only widened, never narrowed: if the list already has venue_retired (a later migration may have
-- added more reasons since), a replay leaves it alone instead of dropping theirs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.arrangement_review_flags'::regclass
      and conname = 'arrangement_review_flags_reason_code_check'
      and pg_get_constraintdef(oid) like '%venue_retired%'
  ) then
    alter table public.arrangement_review_flags drop constraint if exists arrangement_review_flags_reason_code_check;
    alter table public.arrangement_review_flags add constraint arrangement_review_flags_reason_code_check
      check (reason_code in ('venue_time_conflict', 'venue_timing_changed', 'venue_capacity', 'venue_layout_review',
        'venue_accessibility_review', 'venue_facility_review', 'venue_hours_review', 'venue_retired',
        'equipment_time_conflict', 'equipment_timing_changed', 'equipment_requirements_review'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-046.5, AC-046.6: the retirement note is part of the venue's recorded history
-- ---------------------------------------------------------------------------
-- 0067's function with retirement_note added to the columns it records.
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
    'opens_at', 'closes_at', 'retirement_note'
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

-- ---------------------------------------------------------------------------
-- AC-046.5: retiring flags every live booking for review; nothing is cancelled
-- ---------------------------------------------------------------------------
-- 0067's function with one new case: a change to status 'retired' flags every live booking
-- of an event that has not ended, with reason venue_retired and the retirement note.
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
revoke all on function public.review_bookings_for_venue_change(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- AC-046.5: no new holds on a retired venue
-- ---------------------------------------------------------------------------
-- 0049's policy, unchanged except for the venue check. Search no longer offers a retired
-- venue, but a saved link or an old page could still try to hold it.
drop policy if exists bookings_insert_coordinator on public.venue_bookings;
create policy bookings_insert_coordinator on public.venue_bookings
  for insert to authenticated
  with check (
    public.is_assigned_event_coordinator(event_id)
    and requested_by = auth.uid()
    and status = 'held'
    and exists (
      select 1 from public.events e
      where e.id = venue_bookings.event_id
        and e.status in ('approved', 'planning')
    )
    and exists (
      select 1 from public.venues v
      where v.id = venue_bookings.venue_id
        and v.status <> 'retired'
    )
  );

-- ---------------------------------------------------------------------------
-- AC-046.5: retire a venue
-- ---------------------------------------------------------------------------
-- 0067's function with the retirement note added, so the edit page can show it.
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
    'retirementNote', v.retirement_note,
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

-- Retires a venue the person has open, with a reason. Like update_venue it refuses if the
-- venue changed since it was opened. Returns how many bookings were sent for review.
create or replace function public.retire_venue(p_venue_id uuid, p_version text, p_note text)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
  v_changes_before uuid[];
begin
  if public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can retire venues' using errcode = '42501';
  end if;
  select status into v_status from public.venues where id = p_venue_id for update;
  if not found then
    raise exception 'Venue not found' using errcode = 'P0002';
  end if;
  if v_status = 'retired' then
    raise exception 'This venue is already retired' using errcode = '22023';
  end if;
  if public.venue_edit_version(p_venue_id) is distinct from p_version then
    raise exception 'This venue was changed by someone else. Reload it before saving.' using errcode = '40001';
  end if;
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Say why the venue is being retired' using errcode = '22023';
  end if;

  select coalesce(array_agg(id), '{}') into v_changes_before from public.venue_changes where venue_id = p_venue_id;
  update public.venues set status = 'retired', retirement_note = btrim(p_note) where id = p_venue_id;
  return public.count_venue_reviewed_bookings(p_venue_id, v_changes_before);
end $$;
revoke execute on function public.retire_venue(uuid, text, text) from public, anon;
grant execute on function public.retire_venue(uuid, text, text) to authenticated;

commit;
