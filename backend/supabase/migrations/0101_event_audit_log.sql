-- US34 (SCRUM-231): append-only audit trail of significant event actions.
-- Existing history tables (review decisions, assignment, change-request review) keep their own
-- purpose and access rules; this table is the single account of "who did what and when".
-- Only future actions are recorded: older rows have no reliable actor/time to backfill.
begin;

create table if not exists public.event_audit_log (
  id uuid primary key default gen_random_uuid(),
  -- No ON DELETE action: an event with an audit trail cannot be removed from under it.
  event_id uuid not null references public.events(id),
  -- Null when the change came from an administrator or the database itself, not a signed-in
  -- user. We do not invent an actor for those.
  actor_id uuid references public.profiles(id),
  action text not null check (action in (
    'submitted', 'approved', 'rejected', 'confirmed', 'cancelled', 'status_changed',
    'coordinator_assigned', 'rescheduled', 'details_changed',
    'venue_booking_decided', 'equipment_reservation_changed'
  )),
  item_type text not null check (item_type in ('event', 'venue_booking', 'equipment_line')),
  item_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists event_audit_log_event_idx
  on public.event_audit_log (event_id, occurred_at, id);

alter table public.event_audit_log enable row level security;
revoke all on public.event_audit_log from public, anon, authenticated;
grant select on public.event_audit_log to authenticated;

-- AC-034.3/.4: only the event's assigned Coordinator and the Coordinator Lead read records.
drop policy if exists audit_log_read on public.event_audit_log;
create policy audit_log_read on public.event_audit_log for select to authenticated
  using (
    public.current_user_role() = 'coordinator_lead'
    or public.is_assigned_event_coordinator(event_id)
  );

-- AC-034.2: grants stop application users, this trigger stops everyone else (table owner,
-- service role) from rewriting history by accident. Inserts come only from the triggers below.
create or replace function public.guard_event_audit_log_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit records cannot be changed or deleted' using errcode = '42501';
end $$;
drop trigger if exists event_audit_log_immutable on public.event_audit_log;
create trigger event_audit_log_immutable
  before update or delete on public.event_audit_log
  for each row execute function public.guard_event_audit_log_immutable();
drop trigger if exists event_audit_log_no_truncate on public.event_audit_log;
create trigger event_audit_log_no_truncate
  before truncate on public.event_audit_log
  for each statement execute function public.guard_event_audit_log_immutable();

-- One insert path so every record is shaped the same way. Trigger functions below are
-- SECURITY DEFINER because the signed-in user has no insert right on the log.
create or replace function public.write_event_audit(
  p_event_id uuid, p_action text, p_item_type text, p_item_id uuid,
  p_old jsonb, p_new jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.event_audit_log (event_id, actor_id, action, item_type, item_id, old_values, new_values)
  values (p_event_id, auth.uid(), p_action, p_item_type, p_item_id, p_old, p_new);
$$;
revoke all on function public.write_event_audit(uuid, text, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;

-- Event status, assignment and significant detail changes. Runs in the same transaction as the
-- change, so a failed log write rolls the action back instead of leaving it unrecorded.
create or replace function public.audit_event_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_action text;
begin
  if new.status is distinct from old.status then
    v_action := case
      when old.status = 'draft' and new.status = 'submitted' then 'submitted'
      when new.status = 'approved' then 'approved'
      when new.status = 'rejected' then 'rejected'
      when new.status = 'confirmed' then 'confirmed'
      when new.status = 'cancelled' then 'cancelled'
      else 'status_changed'
    end;
    perform public.write_event_audit(new.id, v_action, 'event', new.id,
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  end if;

  -- Draft edits are not significant; only changes to a request that has been submitted.
  if new.coordinator_id is distinct from old.coordinator_id and new.status <> 'draft' then
    perform public.write_event_audit(new.id, 'coordinator_assigned', 'event', new.id,
      jsonb_build_object('coordinator_id', old.coordinator_id),
      jsonb_build_object('coordinator_id', new.coordinator_id));
  end if;

  if old.status = 'draft' then return new; end if;

  -- Dates are a reschedule; the other listed fields are significant information changes.
  v_old := '{}'::jsonb; v_new := '{}'::jsonb;
  if new.proposed_start is distinct from old.proposed_start then
    v_old := v_old || jsonb_build_object('proposed_start', old.proposed_start);
    v_new := v_new || jsonb_build_object('proposed_start', new.proposed_start);
  end if;
  if new.proposed_end is distinct from old.proposed_end then
    v_old := v_old || jsonb_build_object('proposed_end', old.proposed_end);
    v_new := v_new || jsonb_build_object('proposed_end', new.proposed_end);
  end if;
  if v_new <> '{}'::jsonb then
    perform public.write_event_audit(new.id, 'rescheduled', 'event', new.id, v_old, v_new);
  end if;

  v_old := '{}'::jsonb; v_new := '{}'::jsonb;
  if new.expected_attendance is distinct from old.expected_attendance then
    v_old := v_old || jsonb_build_object('expected_attendance', old.expected_attendance);
    v_new := v_new || jsonb_build_object('expected_attendance', new.expected_attendance);
  end if;
  if new.layout_preference is distinct from old.layout_preference then
    v_old := v_old || jsonb_build_object('layout_preference', old.layout_preference);
    v_new := v_new || jsonb_build_object('layout_preference', new.layout_preference);
  end if;
  if new.accessibility_requirements is distinct from old.accessibility_requirements then
    v_old := v_old || jsonb_build_object('accessibility_requirements', old.accessibility_requirements);
    v_new := v_new || jsonb_build_object('accessibility_requirements', new.accessibility_requirements);
  end if;
  if new.equipment_requirements is distinct from old.equipment_requirements then
    v_old := v_old || jsonb_build_object('equipment_requirements', old.equipment_requirements);
    v_new := v_new || jsonb_build_object('equipment_requirements', new.equipment_requirements);
  end if;
  if v_new <> '{}'::jsonb then
    perform public.write_event_audit(new.id, 'details_changed', 'event', new.id, v_old, v_new);
  end if;
  return new;
end $$;
revoke all on function public.audit_event_changes() from public, anon, authenticated;
drop trigger if exists events_audit_changes on public.events;
create trigger events_audit_changes
  after update on public.events
  for each row execute function public.audit_event_changes();

-- Venue booking decisions. Holds and their expiry are system housekeeping, not decisions.
create or replace function public.audit_venue_booking_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('confirmed', 'rejected', 'cancelled') then
    perform public.write_event_audit(new.event_id, 'venue_booking_decided', 'venue_booking', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status, 'venue_id', new.venue_id, 'review_note', new.review_note));
  end if;
  return new;
end $$;
revoke all on function public.audit_venue_booking_decision() from public, anon, authenticated;
drop trigger if exists venue_bookings_audit_decision on public.venue_bookings;
create trigger venue_bookings_audit_decision
  after update of status on public.venue_bookings
  for each row execute function public.audit_venue_booking_decision();

-- Equipment reservation changes: a line created, or its status or reserved quantity changed.
create or replace function public.audit_equipment_line_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.equipment_bookings where id = new.booking_id;
  if v_event_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.quantity_reserved is not distinct from old.quantity_reserved then
    return new;
  end if;
  perform public.write_event_audit(v_event_id, 'equipment_reservation_changed', 'equipment_line', new.id,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('status', old.status, 'quantity_reserved', old.quantity_reserved) end,
    jsonb_build_object('status', new.status, 'quantity_reserved', new.quantity_reserved,
      'type_id', new.type_id, 'quantity_requested', new.quantity_requested));
  return new;
end $$;
revoke all on function public.audit_equipment_line_change() from public, anon, authenticated;
drop trigger if exists equipment_lines_audit_change on public.equipment_booking_lines;
create trigger equipment_lines_audit_change
  after insert or update of status, quantity_reserved on public.equipment_booking_lines
  for each row execute function public.audit_equipment_line_change();

-- Read path: records in time order with the actor's name. Access is checked here as well as by
-- RLS because profiles are not readable by every caller. An unauthorised caller gets an error,
-- not an empty list, so a refusal is never mistaken for "nothing happened".
create or replace function public.get_event_audit_log(p_event_id uuid)
returns table (
  id uuid, action text, item_type text, item_id uuid,
  old_values jsonb, new_values jsonb, occurred_at timestamptz,
  actor_id uuid, actor_name text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.current_user_role() = 'coordinator_lead'
          or public.is_assigned_event_coordinator(p_event_id)) then
    raise exception 'Not allowed to view this audit trail' using errcode = '42501';
  end if;
  return query
    select l.id, l.action, l.item_type, l.item_id, l.old_values, l.new_values, l.occurred_at,
           l.actor_id, p.full_name
    from public.event_audit_log l
    left join public.profiles p on p.id = l.actor_id
    where l.event_id = p_event_id
    order by l.occurred_at, l.id;
end $$;
revoke all on function public.get_event_audit_log(uuid) from public, anon;
grant execute on function public.get_event_audit_log(uuid) to authenticated;

commit;
