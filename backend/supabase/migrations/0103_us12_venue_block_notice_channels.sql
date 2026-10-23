-- US33 Choose notification channels by type (SCRUM-230), slice 2b (0103): US12 venue closures moved onto
-- the sending helper (0079). Rebuilt from 0100 (US48 continuous venue blocks), which moved the
-- closure email out of block_venue() into save_venue_block_window(); block_venue() and
-- block_venue_period() are now thin wrappers around it, so both kinds of block are covered.
-- save_venue_block_window() is recreated exactly as in 0100 except for how it sends its notice.
--
-- Same email as before, now also kept in-app separately so turning email off does not hide it in
-- the app. Each follows the Coordinator's choice; with no choice made, both are sent, as before.
-- Owner of the function: Jeremiah (US12); continuous blocks: 0100's author.
-- Numbered after 0100 so it applies after it on a fresh install. Tested in
-- run_venue_time_conversion.sh straight after 0100; both runners skip it in their first pass.
-- Apply after 0100. Safe to replay.
begin;

create or replace function public.save_venue_block_window(
  p_venue_id uuid, p_starts_on date, p_ends_on date, p_slots text[], p_reason text,
  p_starts_at timestamptz,p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice record;
  v_slots      text[];
  v_closure    uuid;
  v_venue_name text;
begin
  v_slots := public.venue_block_request_slots(p_venue_id, p_starts_on, p_ends_on, p_slots);

  if p_starts_at is not null or p_ends_at is not null then
    perform public.validate_venue_block_period(p_venue_id,p_starts_at,p_ends_at);
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to block a venue' using errcode = '22023';
  end if;

  -- Serialise blocks on one venue, so two staff members cannot both pass the overlap check
  -- below and then both save. (A race cannot be shown in the single-session test runner.)
  select name into v_venue_name from public.venues where id = p_venue_id for update;

  -- Recheck venue eligibility after acquiring the shared venue lock.
  perform public.venue_block_request_slots(p_venue_id,p_starts_on,p_ends_on,p_slots);

  -- Venue lock serialises both legacy and continuous block creation. Compare
  -- actual cells, not the Cartesian product of dates and all stored slots.
  if exists(select 1 from public.venue_closures vc
   cross join public.venue_block_window_cells(p_starts_on,p_ends_on,v_slots,p_starts_at,p_ends_at) wanted
   where vc.venue_id=p_venue_id and vc.removed_at is null
    and vc.starts_on<=p_ends_on and vc.ends_on>=p_starts_on
    and public.venue_closure_covers(vc.id,wanted.slot_date,wanted.slot)) then
    raise exception 'Part of this period is already blocked. Remove or change that block first.' using errcode='23505';
  end if;

  -- Lapsed holds are otherwise released only when someone next books (0018). Release this
  -- venue's now, so a dead hold is neither flagged nor left on a cell the block should own.
  delete from public.venue_slot_claims c
  using public.venue_bookings b
  where c.booking_id = b.id and b.venue_id = p_venue_id
    and b.status = 'held' and b.hold_expires_at < now();
  update public.venue_bookings
  set status = 'expired'
  where venue_id = p_venue_id and status = 'held' and hold_expires_at < now();

  -- Who blocked comes from the session, never from the browser.
  insert into public.venue_closures
    (venue_id, starts_on, ends_on, slots, reason, created_by, created_by_name, starts_at, ends_at)
  values
    (p_venue_id, p_starts_on, p_ends_on, v_slots, btrim(p_reason), auth.uid(),
     (select full_name from public.profiles where id = auth.uid()),p_starts_at,p_ends_at)
  returning id into v_closure;

  -- Free cells become blocked. A cell a booking already holds stays with that booking.
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  select p_venue_id, wanted.slot_date, wanted.slot, 'maintenance', v_closure
  from public.venue_block_window_cells(p_starts_on,p_ends_on,v_slots,p_starts_at,p_ends_at) wanted
  on conflict (venue_id, slot_date, slot) do nothing;

  -- One flag per live booking inside the block, listing only its cells that the block covers.
  -- The assigned coordinator owns the event; the requester is the fallback for an event
  -- still in the unassigned queue (Week 7 change 5).
  insert into public.venue_booking_flags
    (booking_id, event_id, venue_id, closure_id, cause, detail, affected_cells,
     recipient_id, created_by)
  select b.id, b.event_id, p_venue_id, v_closure, 'venue_blocked',
         'Venue blocked: ' || btrim(p_reason),
         jsonb_agg(jsonb_build_object('date', c.slot_date, 'slot', c.slot, 'kind', c.kind)
                   order by c.slot_date, c.slot),
         coalesce(e.coordinator_id, b.requested_by), auth.uid()
  from public.venue_effective_slot_claims c
  join public.venue_bookings b on b.id = c.booking_id
  join public.events e on e.id = b.event_id
  where c.venue_id = p_venue_id
    and c.kind in ('event', 'buffer')
    and public.venue_closure_covers(v_closure,c.slot_date,c.slot)
    and b.status in ('held', 'pending_approval', 'confirmed')
  group by b.id, b.event_id, e.coordinator_id, b.requested_by;

  -- US33 (0103): one notice per flag; the in-app copy and the email each follow the
  -- recipient's choice for "Venue closures affecting your bookings". Same subject and body.
  for v_notice in
    select f.recipient_id, f.event_id, e.reference, e.name
    from public.venue_booking_flags f
    join public.events e on e.id = f.event_id
    where f.closure_id = v_closure and f.recipient_id is not null
  loop
    perform public.send_notification(v_notice.recipient_id, 'venue_block_alert', v_notice.event_id,
      'Venue booking needs review: ' || v_venue_name,
      format(
        E'Venue Staff have blocked %s during %s.\nReason: %s\n\n'
        'Your booking for event %s (%s) overlaps this period. It has not been cancelled. '
        'Please review it in ConnectSphere and arrange an alternative if needed.',
        v_venue_name,case when p_starts_at is null then format('%s to %s (%s daily)',p_starts_on,p_ends_on,array_to_string(v_slots,', '))
         else format('%s to %s (Singapore time)',p_starts_at at time zone 'Asia/Singapore',p_ends_at at time zone 'Asia/Singapore') end,btrim(p_reason),
        coalesce(v_notice.reference, 'without a reference'), coalesce(v_notice.name, 'untitled')));
  end loop;

  return v_closure;
end;
$$;
revoke all on function public.save_venue_block_window(uuid,date,date,text[],text,timestamptz,timestamptz) from public,anon,authenticated;

commit;
