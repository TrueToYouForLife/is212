-- Uses Slice 1 fixtures; preserves them for races and replay.
begin;
reset role;
select set_config('request.jwt.claim.sub','',true);
create function pg_temp.us49_cancel_refused(command text) returns boolean language plpgsql as $$
begin execute command; return false;
exception when sqlstate '42501' or sqlstate '22023' or sqlstate '40001' then return true; end $$;
create temp table us49_cancel_events as select * from public.events;
create temp table us49_cancel_sibling as select to_jsonb(b) value from public.venue_bookings b where id=:'us49_b';
create temp table us49_cancel_claims as select * from public.venue_slot_claims where booking_id=:'us49_b';
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select public.get_venue_cancellation(:'us49_a')->>'version' as us49_cancel_version \gset
select pg_temp.us47_assert(pg_temp.us49_cancel_refused(format('select public.cancel_individual_venue_booking(%L,%L,%L)',:'us49_a','   ',:'us49_cancel_version')),
 'AC-049.7.1: blank cancellation reason is refused');
select pg_temp.us47_assert(pg_temp.us49_cancel_refused(format('select public.cancel_individual_venue_booking(%L,%L,%L)',:'us49_a','Not needed','stale')),
 'AC-049.7.2: stale consent cannot cancel a booking');
select pg_temp.us47_assert(pg_temp.us49_cancel_refused(format('update public.venue_bookings set status=''cancelled'' where id=%L',:'us49_b')),
 'AC-049.7.3: direct browser cancellation cannot bypass the checked action');
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,3)::text,true);
select pg_temp.us47_assert(pg_temp.us49_cancel_refused(format('select public.cancel_individual_venue_booking(%L,%L,%L)',:'us49_a','Not needed',:'us49_cancel_version')),
 'AC-049.7.4: Venue Staff cannot perform the assigned Coordinator action');
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select public.cancel_individual_venue_booking(:'us49_a','  No longer required  ',:'us49_cancel_version');
select pg_temp.us47_assert((public.get_venue_cancellation(:'us49_a')->'audit'->>'reason')='No longer required'
 and (public.get_venue_cancellation(:'us49_a')->'audit'->>'cancelled_by')=pg_temp.us49_id(1,2)::text,
 'AC-049.9.1: cancellation records trimmed reason, actual actor and server time');
select pg_temp.us47_assert(pg_temp.us49_cancel_refused(format('select public.cancel_individual_venue_booking(%L,%L,%L)',:'us49_a','Retry',:'us49_cancel_version')),
 'AC-049.9.2: retry cannot duplicate a cancellation');
reset role;
select pg_temp.us47_assert(not exists(select 1 from public.venue_slot_claims where booking_id=:'us49_a'),
 'AC-049.7.5: approved booking cancellation frees event, setup and turnaround claims');
select pg_temp.us47_assert((select to_jsonb(b)=(select value from us49_cancel_sibling) from public.venue_bookings b where id=:'us49_b')
 and not exists((select * from public.venue_slot_claims where booking_id=:'us49_b' except select * from us49_cancel_claims)
 union all(select * from us49_cancel_claims except select * from public.venue_slot_claims where booking_id=:'us49_b')),
 'AC-049.8.1: cancelling one space preserves sibling bookings and reservations');
select pg_temp.us47_assert(exists(select 1 from public.user_notifications where recipient_id=pg_temp.us49_id(1,3)
 and type_code='venue_booking_cancelled' and body like '%No longer required%')
 and exists(select 1 from public.notification_outbox where recipient_id=pg_temp.us49_id(1,3) and notification_type='venue_booking_cancelled'),
 'AC-049.9.3: Venue Staff receive in-app and queued email cancellation notices through the shared helper');
create function pg_temp.us49_fail_notice() returns trigger language plpgsql as $$
begin if new.type_code='venue_booking_cancelled' then raise exception 'Injected notice failure' using errcode='22023'; end if; return new; end $$;
create trigger us49_fail_notice before insert on public.user_notifications for each row execute function pg_temp.us49_fail_notice();
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select pg_temp.us47_assert(pg_temp.us49_cancel_refused(format('select public.cancel_individual_venue_booking(%L,%L,%L)',
 :'us49_b','Rollback test',public.get_venue_cancellation(:'us49_b')->>'version')),
 'AC-049.7.7: downstream notification failure refuses cancellation');
reset role;
select pg_temp.us47_assert((select status='pending_approval' from public.venue_bookings where id=:'us49_b')
 and not exists(select 1 from public.venue_booking_cancellations where booking_id=:'us49_b')
 and not exists((select * from public.venue_slot_claims where booking_id=:'us49_b' except select * from us49_cancel_claims)
 union all(select * from us49_cancel_claims except select * from public.venue_slot_claims where booking_id=:'us49_b')),
 'AC-049.8.3: failed transaction restores booking, claims and audit completely');
drop trigger us49_fail_notice on public.user_notifications;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,3)::text,true);
select public.set_my_notification_preference('venue_booking_cancelled',false,false);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select public.cancel_individual_venue_booking(:'us49_b','Cancel final space',public.get_venue_cancellation(:'us49_b')->>'version');
reset role;
select pg_temp.us47_assert((select count(*)=1 from public.user_notifications where recipient_id=pg_temp.us49_id(1,3)
 and type_code='venue_booking_cancelled'), 'AC-049.9.5: staff channel preferences suppress future cancellation notices');
select pg_temp.us47_assert(not exists((select * from public.events except select * from us49_cancel_events)
 union all(select * from us49_cancel_events except select * from public.events)),
 'AC-049.8.2: cancelling every booking leaves all event columns unchanged');
-- Rejected history is preserved when the requirement is explicitly cancelled.
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status,review_note,review_alternative)
values(pg_temp.us49_id(4,1),pg_temp.us49_id(3,1),pg_temp.us49_id(2,3),pg_temp.us49_id(1,2),'rejected','Original rejection','Other room');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
values(pg_temp.us49_id(4,2),pg_temp.us49_id(3,1),pg_temp.us49_id(2,4),pg_temp.us49_id(1,2),'confirmed');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,true);
select public.cancel_individual_venue_booking(pg_temp.us49_id(4,1),'Requirement withdrawn',public.get_venue_cancellation(pg_temp.us49_id(4,1))->>'version');
select pg_temp.us47_assert((select complete from public.get_event_readiness(pg_temp.us49_id(3,1)) where arrangement='venue_booking'),
 'AC-049.7.8: cancelling rejected requirement clears readiness when remaining bookings are approved');
reset role;
select pg_temp.us47_assert((select status='cancelled' and review_note='Original rejection' and review_alternative='Other room'
 from public.venue_bookings where id=pg_temp.us49_id(4,1)),
 'AC-049.7.6: rejected booking can be cancelled without erasing the rejection history');
select pg_temp.us47_assert((select count(*)=3 from public.venue_booking_cancellations),
 'AC-049.9.4: each successful cancellation has exactly one immutable audit record');
rollback;
