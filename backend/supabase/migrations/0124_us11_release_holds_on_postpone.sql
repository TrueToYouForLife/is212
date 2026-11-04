-- US11 AC-011.9 (SCRUM-16): a tentative hold is released automatically when its event is
-- cancelled, postponed or withdrawn.
--
-- Defect fix. 0035 wrote this trigger with the list ('cancelled', 'rejected'), which was every
-- terminal status that existed in September. Two were added afterwards:
--
--   'withdrawn'  US22, 0066
--   'postponed'  US38, 0119
--
-- Neither released a hold, so a postponed event kept its venue slots claimed until the hold
-- lapsed three days later, and AC-011.2 refused any other event's hold on those slots in the
-- meantime. 0119 allows planning -> postponed and a hold is legal in planning, so this was
-- reachable from the Coordinator's own screens. 0120 (US21) releases arrangements on
-- cancellation only, and only for 'pending_approval' and 'confirmed' bookings, so it does not
-- cover a held one.
--
-- 'withdrawn' cannot be reached with a live hold today: holds are placed only from 'approved' or
-- 'planning' (BOOKABLE_EVENT_STATUSES) and 0119 allows 'withdrawn' only from 'submitted' or
-- 'under_review'. It is in the list anyway because the AC names it, so a later lifecycle change
-- that makes it reachable does not quietly reopen this defect.
--
-- 'rejected' stays, though AC-011.9 does not name it: it has been released since 0035 and
-- dropping it would be a silent behaviour change to a path this story does not own.
--
-- Rebuilt from 0035, the only definition of this function. Everything below is 0035's body with
-- the status list widened; anything that replaces it again must carry this forward. Nothing else
-- in 0035 changes, and the trigger keeps its name so it still fires after 0120's
-- events_cancel_releases (triggers fire in name order).
--
-- Apply after 0119. Safe to replay.
begin;

create or replace function public.release_holds_on_event_close()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('cancelled', 'rejected', 'withdrawn', 'postponed') then return new; end if;
  if old.status = new.status then return new; end if;

  delete from public.venue_slot_claims c
   using public.venue_bookings b
   where c.booking_id = b.id
     and b.event_id = new.id
     and b.status in ('held', 'pending_approval');

  update public.venue_bookings
     set status = 'cancelled'
   where event_id = new.id
     and status in ('held', 'pending_approval');

  return new;
end;
$$;
revoke execute on function public.release_holds_on_event_close() from public, anon, authenticated;

-- Recreated so a database that somehow lost the trigger gets it back; 0035's definition is
-- unchanged, including the name, which decides the order against 0120's trigger.
drop trigger if exists events_release_venue_holds on public.events;
create trigger events_release_venue_holds
  after update of status on public.events
  for each row execute function public.release_holds_on_event_close();

comment on function public.release_holds_on_event_close() is
  'US11 AC-011.9: releases held and pending_approval venue bookings when an event becomes '
  'cancelled, rejected, withdrawn or postponed. Confirmed bookings are left alone: releasing '
  'those belongs to US21/US49 cancellation, not to a tentative hold.';

commit;
