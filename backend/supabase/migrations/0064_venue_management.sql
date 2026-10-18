-- US46 Add and edit venue details (SCRUM-241), slice 1: add a venue.
-- AC-046.1 add a venue with its details, AC-046.3 every layout has a capacity of at least 1,
-- AC-046.6 only Venue Staff change venues, and every change is recorded with who and when.
-- Apply after 0063. Safe to replay.
begin;

-- ---------------------------------------------------------------------------
-- AC-046.1: operating hours
-- ---------------------------------------------------------------------------
-- One opening and closing time per venue, on slot boundaries (time_slots, 0018): opening at
-- the start of AM, PM or Night and closing at the end of one, so a venue's hours always map
-- onto whole bookable slots. Nullable: venues created before 0064 have no hours recorded.
alter table public.venues add column if not exists opens_at time;
alter table public.venues add column if not exists closes_at time;

alter table public.venues drop constraint if exists venues_operating_hours_valid;
alter table public.venues add constraint venues_operating_hours_valid check (
  (opens_at is null and closes_at is null)
  or (opens_at in (time '07:00', time '13:00', time '19:00')
      and closes_at in (time '12:00', time '18:00', time '24:00')
      and closes_at > opens_at)
);

-- ---------------------------------------------------------------------------
-- AC-046.6: only Venue Staff change venues
-- ---------------------------------------------------------------------------
-- 0018 and 0022 also let the Operations Manager write venues and layouts. The customer's
-- roles (Week 4, Week 7) and AC-046.6 give venue management to Venue Staff alone. The
-- policy names are kept, so these replace 0018's and 0022's rather than adding to them.
drop policy if exists venues_manage_insert on public.venues;
create policy venues_manage_insert on public.venues
  for insert to authenticated
  with check (public.current_user_role() = 'venue_staff');

drop policy if exists venues_manage_update on public.venues;
create policy venues_manage_update on public.venues
  for update to authenticated
  using (public.current_user_role() = 'venue_staff')
  with check (public.current_user_role() = 'venue_staff');

drop policy if exists venue_layouts_manage on public.venue_layouts;
create policy venue_layouts_manage on public.venue_layouts
  for all to authenticated
  using (public.current_user_role() = 'venue_staff')
  with check (public.current_user_role() = 'venue_staff');

-- ---------------------------------------------------------------------------
-- AC-046.6: every change recorded with who made it and when
-- ---------------------------------------------------------------------------
-- Written only by triggers, so no path into venues or venue_layouts can skip it.
-- changed_by is null for changes made outside the app (migrations, seed data, the dashboard).
create table if not exists public.venue_changes (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  action     text not null
    check (action in ('created', 'updated', 'layout_added', 'layout_updated', 'layout_removed')),
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now(),
  details    jsonb not null default '{}'::jsonb
);
create index if not exists venue_changes_venue_idx on public.venue_changes (venue_id, changed_at);

alter table public.venue_changes enable row level security;
revoke all on public.venue_changes from anon, authenticated;
grant select on public.venue_changes to authenticated;
drop policy if exists venue_changes_select_venue_staff on public.venue_changes;
create policy venue_changes_select_venue_staff on public.venue_changes
  for select to authenticated
  using (public.current_user_role() = 'venue_staff');

-- The columns a person can change. updated_at and id are bookkeeping, not changes.
create or replace function public.record_venue_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_column  text;
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
    values (new.id, 'updated', auth.uid(), v_changes);
  end if;
  return new;
end $$;
revoke execute on function public.record_venue_change() from public, anon, authenticated;

drop trigger if exists venues_record_change on public.venues;
create trigger venues_record_change
  after insert or update on public.venues
  for each row execute function public.record_venue_change();

create or replace function public.record_venue_layout_change()
returns trigger language plpgsql security definer set search_path = '' as $$
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
                                 'capacity', jsonb_build_object('from', old.capacity, 'to', new.capacity)));
    end if;
    return new;
  end if;
  -- A layout removed because its venue is being deleted has nowhere left to be recorded.
  if exists (select 1 from public.venues v where v.id = old.venue_id) then
    insert into public.venue_changes (venue_id, action, changed_by, details)
    values (old.venue_id, 'layout_removed', auth.uid(),
            jsonb_build_object('layout', old.layout, 'capacity', old.capacity));
  end if;
  return old;
end $$;
revoke execute on function public.record_venue_layout_change() from public, anon, authenticated;

drop trigger if exists venue_layouts_record_change on public.venue_layouts;
create trigger venue_layouts_record_change
  after insert or update or delete on public.venue_layouts
  for each row execute function public.record_venue_layout_change();

-- ---------------------------------------------------------------------------
-- AC-046.1, AC-046.3: add a venue and all its layouts together, or nothing at all
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: RLS decides who may write, and the role check below only gives a clear
-- error first. Codes are checked against the catalogues (0021, 0054), so a venue can only
-- offer layouts, facilities and accessibility features that events can ask for.
-- The primary layout (venues.layout/capacity, read by search) is the largest, first listed
-- on a tie. venues.layout stores the code, which search and 0022's sync trigger match on.
create or replace function public.add_venue(
  p_name          text,
  p_location      text,
  p_opens_at      time,
  p_closes_at     time,
  p_accessibility text[],
  p_facilities    text[],
  p_layouts       jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_venue_id uuid;
  v_layout   jsonb;
  v_code     text;
  v_capacity integer;
  v_seen     text[] := '{}';
  v_primary_code     text;
  v_primary_capacity integer := 0;
begin
  if public.current_user_role() is distinct from 'venue_staff' then
    raise exception 'Only Venue Staff can add venues' using errcode = '42501';
  end if;
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
    if v_capacity > v_primary_capacity then
      v_primary_code := v_code;
      v_primary_capacity := v_capacity;
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

  insert into public.venues (name, location, capacity, layout, accessibility, facility, status, opens_at, closes_at)
  values (
    btrim(p_name),
    btrim(p_location),
    v_primary_capacity,
    v_primary_code,
    (select coalesce(array_agg(distinct a), '{}') from unnest(coalesce(p_accessibility, '{}')) a),
    (select coalesce(jsonb_object_agg(f, true), '{}'::jsonb) from (select distinct unnest(coalesce(p_facilities, '{}')) f) d),
    'active',
    p_opens_at,
    p_closes_at
  )
  returning id into v_venue_id;

  -- The primary layout is already in venue_layouts through 0022's sync trigger.
  insert into public.venue_layouts (venue_id, layout, capacity)
  select v_venue_id, l ->> 'layout', (l ->> 'capacity')::integer
  from jsonb_array_elements(p_layouts) l
  where l ->> 'layout' <> v_primary_code;

  return v_venue_id;
end $$;
revoke execute on function public.add_venue(text, text, time, time, text[], text[], jsonb) from public, anon;
grant execute on function public.add_venue(text, text, time, time, text[], text[], jsonb) to authenticated;

commit;
