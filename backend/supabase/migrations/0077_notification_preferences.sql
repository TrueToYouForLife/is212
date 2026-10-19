-- US33 Choose notification channels by type (SCRUM-230), slice 1: the choices.
-- AC-033.1 a user sees the notification types that apply to their role. AC-033.2 for each,
-- in-app and email can be turned on or off independently. AC-033.3 a type nobody has chosen
-- for yet is on for both.
-- Apply after 0076. Safe to replay.
--
-- AC-033.4 (delivering only through the chosen channels) and AC-033.5 (changes affect future
-- notifications only) are Sprint 4: every feature that sends a notification must first record
-- which type it is, through one shared sending helper agreed with each feature's owner. Until
-- then the settings page stays behind VITE_FEATURE_NOTIFICATION_PREFERENCES, so nobody is shown
-- a switch that does not yet change what they receive.
begin;

-- ---------------------------------------------------------------------------
-- AC-033.1: the notification types, and which roles receive each
-- ---------------------------------------------------------------------------
-- One row per kind of notice the app sends today, named for the person receiving it.
-- delivered_in_app / delivered_by_email record how each is sent now; Sprint 4's helper uses
-- them to know which channels a type can actually reach.
create table if not exists public.notification_types (
  code               text primary key,
  label              text not null,
  description        text not null,
  roles              text[] not null check (cardinality(roles) > 0),
  delivered_in_app   boolean not null,
  delivered_by_email boolean not null,
  sort_order         integer not null
);

insert into public.notification_types (code, label, description, roles, delivered_in_app, delivered_by_email, sort_order) values
  ('event_request_decision', 'Decision on your event request', 'When your event request is approved, rejected or returned for more detail.', '{organiser}', false, true, 10),
  ('coordinator_assignment', 'Event assignments', 'When you are assigned an event, or your event is given a Coordinator.', '{coordinator,organiser}', true, true, 20),
  ('change_request', 'Change requests to review', 'When an Organiser asks to change one of your events.', '{coordinator}', true, true, 30),
  ('arrangement_review', 'Arrangements needing review', 'When a change may leave one of your events'' bookings or equipment unsuitable.', '{coordinator}', true, false, 40),
  ('venue_booking_decision', 'Venue booking decisions', 'When Venue Staff approve or reject one of your venue booking requests.', '{coordinator}', true, false, 50),
  ('venue_block_alert', 'Venue closures affecting your bookings', 'When a venue you have booked is closed for some of your slots.', '{coordinator}', false, true, 60),
  ('equipment_reservation_outcome', 'Equipment reservation results', 'When Technical Support reserves, partly reserves or cannot supply your equipment.', '{coordinator}', true, true, 70),
  ('venue_booking_request', 'New venue booking requests', 'When a Coordinator asks to book a venue.', '{venue_staff}', true, false, 80),
  ('equipment_requirement_change', 'Equipment requests to review', 'When a Coordinator adds, changes or removes an equipment request.', '{tech_support}', true, false, 90),
  ('registration_update', 'Your registrations', 'When you register for an event or withdraw.', '{attendee}', false, true, 100),
  ('waitlist_update', 'Waiting list updates', 'When you join a waiting list, are offered a place, or an offer lapses.', '{attendee}', false, true, 110)
on conflict (code) do update set
  label = excluded.label, description = excluded.description, roles = excluded.roles,
  delivered_in_app = excluded.delivered_in_app, delivered_by_email = excluded.delivered_by_email,
  sort_order = excluded.sort_order;

alter table public.notification_types enable row level security;
revoke all on public.notification_types from anon, authenticated;
grant select on public.notification_types to authenticated;
drop policy if exists notification_types_read on public.notification_types;
create policy notification_types_read on public.notification_types for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- AC-033.2, AC-033.3: each person's choices
-- ---------------------------------------------------------------------------
-- Only what someone has changed is stored; a type with no row is on for both (AC-033.3), so a
-- new user, or a type added later, needs no backfill.
create table if not exists public.notification_preferences (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type_code  text not null references public.notification_types (code) on delete cascade,
  in_app     boolean not null,
  email      boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type_code)
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());

-- AC-033.1, AC-033.3: the types for the caller's role, each with their choice or the default.
create or replace function public.get_my_notification_preferences()
returns table (type_code text, label text, description text, in_app boolean, email boolean, customised boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.current_user_role();
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your notification settings' using errcode = '42501';
  end if;
  return query
  select t.code, t.label, t.description,
         coalesce(p.in_app, true), coalesce(p.email, true), p.user_id is not null
  from public.notification_types t
  left join public.notification_preferences p on p.type_code = t.code and p.user_id = auth.uid()
  where v_role = any (t.roles)
  order by t.sort_order, t.code;
end $$;
revoke all on function public.get_my_notification_preferences() from public, anon;
grant execute on function public.get_my_notification_preferences() to authenticated;

-- AC-033.2: sets both channels for one type. Only a type that applies to the caller's role.
create or replace function public.set_my_notification_preference(p_type text, p_in_app boolean, p_email boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to change your notification settings' using errcode = '42501';
  end if;
  if p_in_app is null or p_email is null then
    raise exception 'Choose on or off for both in-app and email' using errcode = '22023';
  end if;
  if not exists (select 1 from public.notification_types t
                 where t.code = p_type and public.current_user_role() = any (t.roles)) then
    raise exception 'That notification type does not apply to you' using errcode = '22023';
  end if;
  insert into public.notification_preferences (user_id, type_code, in_app, email)
  values (auth.uid(), p_type, p_in_app, p_email)
  on conflict (user_id, type_code) do update
    set in_app = excluded.in_app, email = excluded.email, updated_at = now();
end $$;
revoke all on function public.set_my_notification_preference(text, boolean, boolean) from public, anon;
grant execute on function public.set_my_notification_preference(text, boolean, boolean) to authenticated;

commit;
