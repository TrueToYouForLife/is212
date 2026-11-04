-- US11 AC-011.10 (SCRUM-16): the venue's suitability is checked before a hold is placed, and an
-- unsuitable venue is held only on "Book anyway".
--
-- That override could not exist while check_booking_space (US49, 0102) refused a missing
-- accessibility code or facility outright: the browser would offer "Book anyway" and the database
-- would answer 22023, which is the bare error the check exists to replace.
--
-- This makes those two advisory. Capacity is unchanged and still refuses: a layout that cannot
-- hold the people the booking declares is a physical impossibility, not a judgement call, and
-- AC-049.2 gives each booking its own number to check against.
--
-- Why this is the right side of the argument, rather than a convenience for US11:
--
--   * US18 AC-018.2 already says suitability is advice -- "an unsuitable venue can still be booked
--     once the coordinator has seen why it does not fit". The hard refusal contradicted it.
--   * US49's own acceptance criteria never ask for a refusal. AC-049.3 says each booking is
--     "checked independently for suitability, availability and conflicts"; checked, not blocked.
--   * US10 remains the control. Venue Staff review every request and can reject one whose venue
--     does not meet the organiser's requirements, with a reason (0037). Moving the decision from
--     a constraint to a person is the point: a requirement entered in error, or met by an
--     arrangement the system does not model, is exactly what a reviewer is for.
--
-- What this permits, stated plainly so nobody has to infer it: a Coordinator can now hold, and
-- Venue Staff can approve, a venue that lacks an accessibility feature the organiser asked for.
-- The requirement is still shown to Venue Staff by get_venue_booking_review, and the Coordinator
-- cannot reach it by accident -- UnsuitableVenueAlert names the missing code and takes a second
-- click. This was raised on SCRUM-16 and SCRUM-244 before the change was made.
--
-- Rebuilt from 0102, the only previous definition. Everything below is 0102's body with the two
-- raise statements removed; the signature, security, search_path and revoke are unchanged, so
-- hold_venue_space (0102) and approve_venue_booking (0102, replaced by 0116) keep calling it
-- without edit. Anything that replaces check_booking_space again must carry this forward.
--
-- Apply after 0102 and 0116. Safe to replay.
begin;

create or replace function public.check_booking_space(p_event uuid,p_venue uuid,p_layout text,p_attendance integer)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events; v public.venues; r public.event_venue_requirements; cap integer;
begin
 select * into e from public.events where id=p_event;
 select * into v from public.venues where id=p_venue;
 select * into r from public.event_venue_requirements where event_id=p_event;
 select capacity into cap from public.venue_layouts where venue_id=p_venue and layout=p_layout;
 -- Unchanged from 0102. A space must be a real layout of this venue, with room for the people
 -- this booking declares. Nothing downstream can make a too-small room fit.
 if p_attendance is null or p_attendance<1 or nullif(btrim(p_layout),'') is null
    or cap is null or cap<p_attendance then
  raise exception 'Choose an offered layout with enough capacity for this space' using errcode='22023';
 end if;
 -- 0102 raised here for an accessibility code the venue lacks, and again for a missing facility.
 -- Both are now advice: the browser shows them before the hold (US11 AC-011.10) and Venue Staff
 -- see them at review (US10). The loops are gone rather than made conditional, because a flag
 -- would be a second way to express a rule that now has one answer.
end $$;
revoke all on function public.check_booking_space(uuid,uuid,text,integer) from public,anon,authenticated;

comment on function public.check_booking_space(uuid,uuid,text,integer) is
  'US49 AC-049.2 with US11 AC-011.10: refuses a layout this venue does not offer or cannot fit '
  'the booking''s declared attendance into. Accessibility and facility requirements are advisory '
  'from 0125; they are shown to the Coordinator before the hold and to Venue Staff at review.';

commit;
