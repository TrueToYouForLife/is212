-- US21 Cancel, postpone or reschedule an event (SCRUM-66), slice 1: cancelling properly.
-- AC-021.1 (cancel) An event cancelled at any stage releases its arrangements, while the event
--          record is kept.
-- AC-021.3 (cancel) Attendees registered for it, or on its waiting list, are told it was cancelled.
-- Before this, cancelling only let go of held and pending venue bookings (0035), so confirmed
-- bookings and equipment reservations stayed taken and nobody registered was told.
--
-- When an event becomes Cancelled:
-- - each pending or confirmed venue booking is released the way 0110 releases one: a
--   venue_booking_cancellations row ("The event was cancelled."), status Cancelled, its slot
--   claims deleted, and every Venue Staff member told (0110's "Venue booking cancellations").
--   Held bookings are still released by 0035, which runs after this.
-- - reserved equipment is released; items already checked out are left for the return
--   inspection (US24), and an equipment booking is cancelled once none of its items is out.
-- - registered attendees and those still waiting for a place are told through the US33 helper,
--   under a new attendee type that slice 2 (postpone, reschedule) reuses. Registrations are kept.
-- No change to the status rules. Applied after 0110 (it writes 0110's cancellation record), so the
-- runners skip it in their first pass and the venue-time runner applies and tests it after 0110.
-- Apply after 0118. Safe to replay.
begin;

-- AC-021.3: how attendees hear about it (US33).
insert into public.notification_types (code, label, description, roles, delivered_in_app, delivered_by_email, sort_order)
values ('event_schedule_change', 'Cancelled, postponed or rescheduled events',
        'When an event you registered for, or are on the waiting list for, is cancelled, postponed or rescheduled.',
        '{attendee}', true, true, 135)
on conflict (code) do update set
  label = excluded.label, description = excluded.description, roles = excluded.roles,
  delivered_in_app = excluded.delivered_in_app, delivered_by_email = excluded.delivered_by_email,
  sort_order = excluded.sort_order;

create or replace function public.release_event_on_cancellation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.coordinator_id);
  v_actor_name text;
  v_when text;
  b record;
  r record;
begin
  select coalesce(nullif(btrim(full_name), ''), 'Event Coordinator') into v_actor_name
    from public.profiles where id = v_actor;
  v_actor_name := coalesce(v_actor_name, 'An administrator');

  -- AC-021.1: venue bookings awaiting Venue Staff or approved, released as 0110 releases one.
  for b in
    select vb.id, vb.status, v.name as venue_name
      from public.venue_bookings vb join public.venues v on v.id = vb.venue_id
     where vb.event_id = new.id and vb.status in ('pending_approval', 'confirmed')
     order by vb.created_at, vb.id
  loop
    if v_actor is not null then
      insert into public.venue_booking_cancellations (booking_id, event_id, previous_status, reason, cancelled_by, actor_name)
      values (b.id, new.id, b.status, 'The event was cancelled.', v_actor, v_actor_name)
      on conflict (booking_id) do nothing;
    end if;
    update public.venue_bookings set status = 'cancelled' where id = b.id;
    delete from public.venue_slot_claims where booking_id = b.id;
    for r in select id from public.profiles where role = 'venue_staff' loop
      perform public.send_notification(r.id, 'venue_booking_cancelled', new.id,
        format('Venue booking cancelled: %s', b.venue_name),
        format('%s cancelled %s, so its booking for %s is released. Previous status: %s.',
               v_actor_name, coalesce(new.reference, new.name), b.venue_name, b.status));
    end loop;
  end loop;

  -- AC-021.1: reserved equipment goes back; checked-out items come back through returns (US24).
  update public.equipment_allocations a
     set status = 'cancelled'
    from public.equipment_booking_lines l
    join public.equipment_bookings eb on eb.id = l.booking_id
   where a.line_id = l.id and eb.event_id = new.id and a.status = 'reserved';
  update public.equipment_bookings eb
     set status = 'cancelled'
   where eb.event_id = new.id
     and eb.status in ('submitted', 'awaiting_coordinator', 'confirmed', 'partially_confirmed')
     and not exists (select 1 from public.equipment_booking_lines l
                       join public.equipment_allocations a on a.line_id = l.id
                      where l.booking_id = eb.id and a.status = 'checked_out');

  -- AC-021.3: everyone registered or still waiting for a place is told; registrations are kept.
  v_when := case when new.proposed_start is not null
                 then to_char(new.proposed_start at time zone 'Asia/Singapore', 'FMDD Mon YYYY, FMHH12:MI AM') end;
  for r in
    select attendee_id from public.event_registrations where event_id = new.id and status = 'registered'
    union
    select attendee_id from public.event_waitlist_entries where event_id = new.id and status in ('waiting', 'offered')
  loop
    perform public.send_notification(r.attendee_id, 'event_schedule_change', new.id,
      format('Event cancelled: %s', new.name),
      format('%s%s has been cancelled. Your registration stays on record; there is nothing you need to do.',
             new.name, coalesce(' (' || v_when || ')', '')));
  end loop;
  return null;
end $$;
revoke all on function public.release_event_on_cancellation() from public, anon, authenticated;

-- Named to run before 0035's events_release_venue_holds (triggers fire in name order).
drop trigger if exists events_release_on_cancellation on public.events;
create trigger events_release_on_cancellation
  after update of status on public.events
  for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.release_event_on_cancellation();

commit;
