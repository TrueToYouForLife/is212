-- US49 Slice 2: uses the isolated Slice 1 fixtures, rolls back every test change.
begin;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.venue_layouts set capacity=50 where venue_id=pg_temp.us49_id(2,2);
create temp table us49_other_before as select to_jsonb(b) value from public.venue_bookings b where id=:'us49_a';
create temp table us49_claims_before as select * from public.venue_slot_claims where booking_id=:'us49_a';
grant select on us49_other_before,us49_claims_before to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select pg_temp.us47_assert((select not complete from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='venue_booking'),
 'AC-049.6.1: one approved and one pending venue remain incomplete');
select pg_temp.us47_assert((select count(*)=2 from public.get_event_venue_bookings(pg_temp.us49_id(3,1))),
 'AC-049.5.1: assigned coordinator sees both bookings for the event');
select pg_temp.us47_assert((select not complete from public.get_event_readiness(pg_temp.us49_id(3,2)) where arrangement='venue_booking'),
 'AC-049.6.2: no bookings is incomplete rather than vacuously approved');
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,3)::text,true);
select pg_temp.us47_assert(pg_temp.us49_refused('select public.get_event_venue_bookings(pg_temp.us49_id(3,1))'),
 'AC-049.5.2: staff cannot use the coordinator-only event summary');
select public.approve_venue_booking(:'us49_b',public.get_venue_booking_review(:'us49_b')->>'reviewVersion');
select pg_temp.us47_assert((select to_jsonb(b)=(select value from us49_other_before) from public.venue_bookings b where id=:'us49_a'),
 'AC-049.4.1: approving one booking leaves its sibling record unchanged');
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select pg_temp.us47_assert((select complete from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='venue_booking'),
 'AC-049.6.3: all required bookings approved is complete');
select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,3),'theatre',20) as us49_c \gset
select pg_temp.us47_assert((select not complete from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='venue_booking'),
 'AC-049.6.4: adding a live hold makes previously complete venues outstanding');
update public.venue_bookings set status='pending_approval' where id=:'us49_c';
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,3)::text,true);
update public.venue_bookings set status='rejected',review_note='Room unavailable',review_alternative='Try another room' where id=:'us49_c';
select pg_temp.us47_assert((select to_jsonb(b)=(select value from us49_other_before) from public.venue_bookings b where id=:'us49_a')
 and not exists((select * from public.venue_slot_claims where booking_id=:'us49_a' except select * from us49_claims_before)
 union all(select * from us49_claims_before except select * from public.venue_slot_claims where booking_id=:'us49_a'))
 and (select status='confirmed' from public.venue_bookings where id=:'us49_b'),
 'AC-049.4.2: rejection preserves approved sibling records and their occupied slots');
select pg_temp.us47_assert(not exists(select 1 from public.venue_slot_claims where booking_id=:'us49_c'),
 'AC-049.4.3: rejecting one booking releases only its own occupied cells');
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select pg_temp.us47_assert((select not complete and detail like '%rejected%' from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='venue_booking'),
 'AC-049.6.5: rejection remains outstanding even when other venues are approved');
select pg_temp.us47_assert((select count(*)=3 from public.get_event_venue_bookings(pg_temp.us49_id(3,1)))
 and exists(select 1 from public.get_event_venue_bookings(pg_temp.us49_id(3,1)) where status='rejected' and review_note='Room unavailable' and review_alternative='Try another room'),
 'AC-049.5.3: rejection stays visible with reason and suggested alternative');
reset role;
-- Simulate a later explicit cancellation; cancellation UI/permissions are Slice 3.
update public.venue_bookings set status='cancelled' where id=:'us49_c';
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select pg_temp.us47_assert((select complete from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='venue_booking')
 and exists(select 1 from public.get_event_venue_bookings(pg_temp.us49_id(3,1)) where status='cancelled'),
 'AC-049.6.6: explicitly cancelled requirement no longer blocks readiness but remains visible');
select pg_temp.us47_assert((select not complete from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='programme'),
 'AC-049.6.7: venue completion does not mark another arrangement complete');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.events set coordinator_id=null where id=pg_temp.us49_id(3,1);
set local role authenticated;
select pg_temp.us47_assert(pg_temp.us49_refused('select public.get_event_venue_bookings(pg_temp.us49_id(3,1))'),
 'AC-049.5.4: reassignment immediately removes the former coordinator summary access');
rollback;
