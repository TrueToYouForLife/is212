-- US2/US6 structured event requirements, part 1 (follows 0051). Safe to replay.
--
-- Why this exists: the organiser's layout/accessibility/equipment fields were free text,
-- so nothing could be matched against a venue. 0023 worked around that by asking the
-- coordinator to retype a structured version (its own comment says so). This migration
-- removes the cause instead: the organiser now picks from catalogues, so the event's own
-- requirements are directly comparable to venues.accessibility / venues.facility.
--
-- Four requirement fields, deliberately kept apart:
--   layout_preference          one layout_types code      -> matched to venues.layout
--   accessibility_requirements accessibility_types codes   -> matched to venues.accessibility
--   facility_requirements      facility_types codes        -> matched to venues.facility keys
--   equipment_requirements     equipment_types codes       -> portable kit, US13/US14 only
-- facility is what a room already has; equipment is carried in. They filter different
-- things, so they are different columns rather than one overloaded list.
begin;

-- ---------------------------------------------------------------------------
-- 1. Catalogues
-- ---------------------------------------------------------------------------
-- Tables, not enums, for the same reason as layout_types (0021): staff can add an option
-- without a code change. Seeds mirror frontend venueFeatureCatalogue.ts exactly, which is
-- what US8 search and US18 suitability already match on.
create table if not exists public.accessibility_types (
  code       text primary key check (code ~ '^[a-z0-9_]+$'),
  label      text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 100
);

insert into public.accessibility_types (code, label, sort_order) values
  ('wheelchair_access', 'Wheelchair access', 1),
  ('hearing_loop',      'Hearing loop',      2),
  ('accessible_toilet', 'Accessible toilet', 3),
  ('lift_access',       'Lift access',       4)
on conflict (code) do nothing;

create table if not exists public.facility_types (
  code       text primary key check (code ~ '^[a-z0-9_]+$'),
  label      text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 100
);

insert into public.facility_types (code, label, sort_order) values
  ('projector',  'Projector',  1),
  ('microphone', 'Microphone', 2),
  ('stage',      'Stage',      3),
  ('wifi',       'Wi-Fi',      4)
on conflict (code) do nothing;

alter table public.accessibility_types enable row level security;
alter table public.facility_types enable row level security;
revoke all on public.accessibility_types from anon, authenticated;
revoke all on public.facility_types from anon, authenticated;
grant select on public.accessibility_types to authenticated;
grant select on public.facility_types to authenticated;

-- Readable by every signed-in role: an organiser filling in the request form needs the
-- same option list the coordinator filters with, or the two can disagree again.
drop policy if exists accessibility_types_select_all on public.accessibility_types;
create policy accessibility_types_select_all on public.accessibility_types
  for select to authenticated using (true);

drop policy if exists facility_types_select_all on public.facility_types;
create policy facility_types_select_all on public.facility_types
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. equipment_types gains a stable code (US13/US14 table — additive only)
-- ---------------------------------------------------------------------------
-- The organiser's choices are stored as codes, not uuids, so a stored requirement stays
-- readable in event_change_requests.proposed_changes and in the review screens. No
-- existing column changes type and no row is deleted.
alter table public.equipment_types add column if not exists code text;

-- Backfill from name, de-duplicating so two names that slugify the same still get
-- distinct codes. Only rows that have no code yet are touched, so replay is a no-op.
with slugged as (
  select id,
         nullif(btrim(regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g'), '_'), '') as base
  from public.equipment_types
  where code is null
), numbered as (
  select id, base,
         row_number() over (partition by base order by id) as position
  from slugged
)
update public.equipment_types t
set code = case when n.position = 1 then n.base else n.base || '_' || n.position end
from numbered n
where t.id = n.id and n.base is not null;

-- A name that slugifies to nothing (punctuation only) would otherwise block the NOT NULL.
update public.equipment_types
set code = 'equipment_' || replace(id::text, '-', '')
where code is null;

create unique index if not exists equipment_types_code_key on public.equipment_types (code);

-- A trigger fills the code in, rather than the column simply being NOT NULL. Every
-- existing insert into this table — Technical Support adding a type, and several test
-- fixtures in other stories — names the type without a code, and those would all start
-- failing. Deriving it keeps them working and still guarantees a code exists.
create or replace function public.equipment_types_set_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix integer := 1;
begin
  if new.code is not null and btrim(new.code) <> '' then
    new.code := btrim(new.code);
    return new;
  end if;

  base := nullif(btrim(regexp_replace(lower(coalesce(new.name, '')), '[^a-z0-9]+', '_', 'g'), '_'), '');
  -- A name of punctuation alone still has to produce a usable code.
  if base is null then
    base := 'equipment_' || replace(gen_random_uuid()::text, '-', '');
  end if;

  candidate := base;
  while exists (select 1 from public.equipment_types t
                where t.code = candidate and t.id is distinct from new.id) loop
    suffix := suffix + 1;
    candidate := base || '_' || suffix;
  end loop;

  new.code := candidate;
  return new;
end;
$$;
revoke execute on function public.equipment_types_set_code()
  from public, anon, authenticated;

drop trigger if exists equipment_types_set_code on public.equipment_types;
create trigger equipment_types_set_code
  before insert or update of code, name on public.equipment_types
  for each row execute function public.equipment_types_set_code();

alter table public.equipment_types alter column code set not null;
alter table public.equipment_types
  drop constraint if exists equipment_types_code_format;
alter table public.equipment_types
  add constraint equipment_types_code_format check (code ~ '^[a-z0-9_]+$');

-- The browser may read the code but never choose one: it identifies the type for every
-- requirement already stored against it, so a client-supplied value could collide with,
-- or quietly reassign, another type's requests.
revoke insert (code), update (code) on public.equipment_types from anon, authenticated;

-- 0019 limited the catalogue to coordinators and tech support. Organisers now choose from
-- it on the request form, and reviewers (Lead / Operations Manager) read back what was
-- chosen, so the read side widens. Writes are untouched: still tech_support only.
drop policy if exists types_select_staff on public.equipment_types;
create policy types_select_staff on public.equipment_types
  for select to authenticated
  using (public.current_user_role() in
    ('organiser', 'coordinator', 'coordinator_lead', 'operations_manager',
     'venue_staff', 'tech_support'));

-- ---------------------------------------------------------------------------
-- 3. Keep the free text that cannot be mapped
-- ---------------------------------------------------------------------------
-- Converting text to a code list discards anything that is not a known option. Rather
-- than lose what an organiser actually typed, park it here first. Staff-readable only;
-- never written by the browser.
create table if not exists public.event_requirement_migration_notes (
  event_id   uuid primary key references public.events (id) on delete cascade,
  layout_preference_text          text,
  accessibility_requirements_text text,
  equipment_requirements_text     text,
  recorded_at timestamptz not null default now()
);

-- Dynamic SQL, not a guarded plain INSERT: once the columns are arrays this statement no
-- longer type-checks (btrim of a text[] is an error), and PostgreSQL checks the types of a
-- plain statement whether or not its WHERE clause can ever be true. EXECUTE defers that
-- until the branch is actually taken, which is what makes the migration replayable.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
      and column_name = 'accessibility_requirements' and data_type = 'text'
  ) then
    execute $sql$
      insert into public.event_requirement_migration_notes
        (event_id, layout_preference_text, accessibility_requirements_text,
         equipment_requirements_text)
      select e.id, e.layout_preference, e.accessibility_requirements, e.equipment_requirements
      from public.events e
      where nullif(btrim(coalesce(e.layout_preference, '')), '') is not null
         or nullif(btrim(coalesce(e.accessibility_requirements, '')), '') is not null
         or nullif(btrim(coalesce(e.equipment_requirements, '')), '') is not null
      on conflict (event_id) do nothing
    $sql$;
  end if;
end $$;

alter table public.event_requirement_migration_notes enable row level security;
revoke all on public.event_requirement_migration_notes from anon, authenticated;
grant select on public.event_requirement_migration_notes to authenticated;

drop policy if exists event_requirement_notes_select_staff
  on public.event_requirement_migration_notes;
create policy event_requirement_notes_select_staff on public.event_requirement_migration_notes
  for select to authenticated
  using (public.current_user_role() in
    ('coordinator', 'coordinator_lead', 'operations_manager', 'venue_staff'));

-- ---------------------------------------------------------------------------
-- 4. events: convert the requirement columns
-- ---------------------------------------------------------------------------
-- ALTER COLUMN ... USING refuses a subquery, so the catalogue lookup lives in a helper
-- function instead. "Wheelchair Access." and "wheelchair_access" both reduce to the same
-- letters-and-digits key, which is how old free text is recognised; anything unrecognised
-- is dropped here and survives in event_requirement_migration_notes above.
create or replace function public.map_legacy_requirement_codes(p_text text, p_kind text)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct code), '{}'::text[])
  from (
    select a.code as code,
           regexp_replace(a.code, '[^a-z0-9]', '', 'g') as code_key,
           regexp_replace(lower(a.label), '[^a-z0-9]', '', 'g') as label_key
    from public.accessibility_types a where p_kind = 'accessibility'
    union all
    select f.code, regexp_replace(f.code, '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(f.label), '[^a-z0-9]', '', 'g')
    from public.facility_types f where p_kind = 'facility'
    union all
    select t.code, regexp_replace(t.code, '[^a-z0-9]', '', 'g'),
           regexp_replace(lower(t.name), '[^a-z0-9]', '', 'g')
    from public.equipment_types t where p_kind = 'equipment'
  ) catalogue
  where nullif(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g'), '') is not null
    and (
      regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g')
        like '%' || catalogue.code_key || '%'
      or (catalogue.label_key <> ''
          and regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g')
              like '%' || catalogue.label_key || '%')
    );
$$;

-- Each conversion is guarded on the column still being text, so a shared database that
-- has already been migrated is left alone (same pattern as 0020).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
      and column_name = 'accessibility_requirements' and data_type = 'text'
  ) then
    alter table public.events alter column accessibility_requirements type text[]
      using public.map_legacy_requirement_codes(accessibility_requirements, 'accessibility');
  end if;
end $$;

update public.events set accessibility_requirements = '{}' where accessibility_requirements is null;
alter table public.events alter column accessibility_requirements set default '{}';
alter table public.events alter column accessibility_requirements set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events'
      and column_name = 'equipment_requirements' and data_type = 'text'
  ) then
    alter table public.events alter column equipment_requirements type text[]
      using public.map_legacy_requirement_codes(equipment_requirements, 'equipment');
  end if;
end $$;

update public.events set equipment_requirements = '{}' where equipment_requirements is null;
alter table public.events alter column equipment_requirements set default '{}';
alter table public.events alter column equipment_requirements set not null;

-- New column: what the room itself must provide.
alter table public.events add column if not exists facility_requirements text[];
update public.events set facility_requirements = '{}' where facility_requirements is null;
alter table public.events alter column facility_requirements set default '{}';
alter table public.events alter column facility_requirements set not null;

-- layout_preference stays a single text code and gains a real foreign key, so an unknown
-- layout is impossible rather than merely unmatched. Unmappable free text becomes null.
update public.events e
set layout_preference = (
  select l.code from public.layout_types l
  where regexp_replace(lower(e.layout_preference), '[^a-z0-9]', '', 'g')
        = regexp_replace(l.code, '[^a-z0-9]', '', 'g')
     or regexp_replace(lower(e.layout_preference), '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(l.label), '[^a-z0-9]', '', 'g')
  limit 1
)
where e.layout_preference is not null
  and not exists (select 1 from public.layout_types l where l.code = e.layout_preference);

update public.events set layout_preference = null
where layout_preference is not null
  and not exists (select 1 from public.layout_types l where l.code = layout_preference);

alter table public.events drop constraint if exists events_layout_preference_fkey;
alter table public.events
  add constraint events_layout_preference_fkey
  foreign key (layout_preference) references public.layout_types (code);

-- Blank codes are never meaningful and would silently never match a venue.
alter table public.events drop constraint if exists events_requirement_codes_not_blank;
alter table public.events
  add constraint events_requirement_codes_not_blank check (
    not ('' = any (accessibility_requirements))
    and not ('' = any (facility_requirements))
    and not ('' = any (equipment_requirements))
  );

-- ---------------------------------------------------------------------------
-- 5. Every stored code must exist in its catalogue
-- ---------------------------------------------------------------------------
-- A trigger, not a CHECK: a CHECK cannot read another table. Not a foreign key either:
-- PostgreSQL has no per-element foreign key for array columns. This is the integrity half
-- of the house rule — the browser validates for the message, the database for the truth.
create or replace function public.events_validate_requirement_codes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bad text;
begin
  -- The unnested column is aliased (wanted.value), never left as a bare "code". Compared
  -- against a.code unqualified, PostgreSQL resolves the name to the catalogue's own column,
  -- the test becomes a.code = a.code, and every invalid code passes silently.
  select wanted.value into bad
  from unnest(new.accessibility_requirements) as wanted(value)
  where not exists (
    select 1 from public.accessibility_types a where a.code = wanted.value)
  limit 1;
  if bad is not null then
    raise exception 'Unknown accessibility requirement: %', bad using errcode = '23514';
  end if;

  select wanted.value into bad
  from unnest(new.facility_requirements) as wanted(value)
  where not exists (
    select 1 from public.facility_types f where f.code = wanted.value)
  limit 1;
  if bad is not null then
    raise exception 'Unknown facility requirement: %', bad using errcode = '23514';
  end if;

  select wanted.value into bad
  from unnest(new.equipment_requirements) as wanted(value)
  where not exists (
    select 1 from public.equipment_types t where t.code = wanted.value)
  limit 1;
  if bad is not null then
    raise exception 'Unknown equipment requirement: %', bad using errcode = '23514';
  end if;

  -- Duplicates are a client bug, not a user intent; collapse rather than reject so a
  -- double-posted form does not fail.
  new.accessibility_requirements := (
    select coalesce(array_agg(distinct wanted.value), '{}'::text[])
    from unnest(new.accessibility_requirements) as wanted(value));
  new.facility_requirements := (
    select coalesce(array_agg(distinct wanted.value), '{}'::text[])
    from unnest(new.facility_requirements) as wanted(value));
  new.equipment_requirements := (
    select coalesce(array_agg(distinct wanted.value), '{}'::text[])
    from unnest(new.equipment_requirements) as wanted(value));

  return new;
end;
$$;
revoke execute on function public.events_validate_requirement_codes()
  from public, anon, authenticated;

drop trigger if exists events_validate_requirement_codes on public.events;
create trigger events_validate_requirement_codes
  before insert or update of
    accessibility_requirements, facility_requirements, equipment_requirements
  on public.events
  for each row execute function public.events_validate_requirement_codes();

-- ---------------------------------------------------------------------------
-- 6. Column grants
-- ---------------------------------------------------------------------------
-- 0005 revoked table-wide SELECT and re-granted column by column, so a new column is
-- invisible until it is named here. Easy to miss: the query simply returns no such column.
grant select (facility_requirements) on public.events to authenticated;

-- The legacy mapper has done its job and is not part of the running system.
drop function if exists public.map_legacy_requirement_codes(text, text);

commit;
