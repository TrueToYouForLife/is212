-- US31 slice 1 (SCRUM-228, SCRUM-257): AC-031.4 — every Organiser account belongs to
-- exactly one client organisation.
--
-- 0001 declared profiles.client_org_id and nothing ever used it: no table behind it, no
-- constraint, no reader. This migration gives that reserved column a meaning. It does not
-- add the colleague read path (AC-031.1 to .3); that is slice 2, and it depends on the
-- ownership recorded here existing first.
--
-- Slice boundary is deliberate. profiles is read by every role and every story, so a
-- backfill against it lands on its own, verifiable in isolation, before anything reads it.

begin;

-- ---------------------------------------------------------------------------
-- The organisations themselves
-- ---------------------------------------------------------------------------
create table if not exists public.client_organisations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),

  -- Two organisations with the same name are indistinguishable to the Organiser choosing
  -- between them, and AC-031.3 turns on telling them apart.
  constraint client_organisations_name_unique unique (name)
);

-- Fixed ids rather than generated ones: the backfill below and the slice 2 tests both
-- reference the default organisation, and a value that changes per deployment cannot be
-- referenced from either. Rename these to the real client names before the demo; the ids
-- are what the data depends on, not the names.
insert into public.client_organisations (id, name) values
  ('0c0a0000-0000-4000-8000-000000000001', 'Northwind Trading'),
  ('0c0a0000-0000-4000-8000-000000000002', 'Harbourline Group')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill, then constrain — in that order
-- ---------------------------------------------------------------------------
-- A CHECK is validated against existing rows the moment it is added, so adding it before
-- the backfill would abort this migration on any database that already has Organisers.
-- That is also why the assignment cannot be left to be done by hand in the dashboard
-- afterwards: there would be no green state in between. Reassigning an individual
-- afterwards is fine and expected — see the guard below.
update public.profiles
   set client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where role = 'organiser'
   and client_org_id is null;

alter table public.profiles drop constraint if exists profiles_client_org_fk;
alter table public.profiles add constraint profiles_client_org_fk
  foreign key (client_org_id) references public.client_organisations (id);

-- A CHECK rather than NOT NULL, per the house rule: the column is legitimately empty for
-- Coordinators, Venue Staff, Technical Support and Attendees, who work across clients or
-- for none. One consequence worth knowing: promoting an Attendee to Organiser must set
-- client_org_id in the same statement, which is correct — an administrator promoting
-- someone has to say which client they work for.
--
-- Deliberately one-directional. The stricter reading — that a non-Organiser must have no
-- organisation — was tried and rejected: it refuses an existing fixture that moves one
-- profile between organiser and coordinator, and AC-031.4 constrains Organisers only. It
-- would also buy nothing, because slice 2 has to filter on role regardless; role is the
-- authority on what someone may see, and a leftover id on a Coordinator who no longer
-- organises is inert as long as nothing reads this column without checking role first.
-- Slice 2 must therefore read client_org_id only after establishing role = 'organiser'.
alter table public.profiles drop constraint if exists profiles_client_org_required;
alter table public.profiles add constraint profiles_client_org_required check (
  role <> 'organiser' or client_org_id is not null
);

-- Slice 2 filters colleagues' events on this column; profiles is small today but the
-- lookup runs on every read of the organisation view.
create index if not exists profiles_client_org_id_idx
  on public.profiles (client_org_id)
  where client_org_id is not null;

-- ---------------------------------------------------------------------------
-- Which organisation you belong to is not yours to choose
-- ---------------------------------------------------------------------------
-- Exactly the escalation prevent_role_self_assignment (0003) exists to stop, one column
-- over: without this, AC-031.3 is bypassable with a single UPDATE moving yourself into
-- another client's organisation and then reading their events.
--
-- A separate function rather than extending 0003's: the test runner replays historical
-- migrations, and a replay of 0003 would `create or replace` an extended version straight
-- back to the role-only one. A function of its own survives that.
--
-- It reuses app.allow_role_change rather than inventing a second switch. Assigning someone
-- to a client organisation is the same administrative act as assigning their role, and two
-- switches would mean an administrator could satisfy one and be surprised by the other.
-- auth.uid() is null for the service role and the SQL editor, so dashboard edits pass.
create or replace function public.prevent_client_org_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_org_id is distinct from old.client_org_id
     and auth.uid() is not null
     and coalesce(current_setting('app.allow_role_change', true), '') <> 'on' then
    raise exception 'Client organisations are assigned by an administrator, not chosen by the user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_client_org_self_assignment on public.profiles;
create trigger profiles_prevent_client_org_self_assignment
  before update on public.profiles
  for each row execute function public.prevent_client_org_self_assignment();

-- ---------------------------------------------------------------------------
-- Reading the organisation list
-- ---------------------------------------------------------------------------
-- Supabase grants the authenticated role full DML on new public tables by default, which
-- on this table would let any signed-in user rename or delete a client organisation. The
-- explicit revoke is the same defence 0005 applies to events: start from nothing and grant
-- the columns a browser actually needs.
revoke all on public.client_organisations from public, anon, authenticated;
grant select (id, name) on public.client_organisations to authenticated;

alter table public.client_organisations enable row level security;

-- No insert, update or delete policy anywhere, on purpose. Organisations are seed data
-- maintained by an administrator through the service role, which bypasses RLS — the same
-- stance the team took for roles and for Organiser accounts themselves. There is no
-- story asking for an in-app organisation editor, and adding a write path here would be
-- the one place a user could manufacture their way into another client's events.
drop policy if exists client_organisations_select_own on public.client_organisations;
create policy client_organisations_select_own on public.client_organisations
  for select to authenticated
  using (
    -- An Organiser may see the organisation they belong to. Which other companies are
    -- clients of ConnectSphere is not theirs to enumerate; that is the same instinct as
    -- AC-031.3, applied to the organisation list rather than to events.
    id = (select p.client_org_id from public.profiles p where p.id = auth.uid())
    -- Staff work across clients, so they see the whole list.
    or public.current_user_role() in ('coordinator', 'coordinator_lead', 'operations_manager')
  );

commit;
