-- US27 PR2 integration tests: real PostgreSQL/RLS, simulated authenticated claims.
-- Setup comes from equipment_status_fixture.sql. All test mutations roll back for races.
begin;
reset role;
create or replace function pg_temp.us27_status_assert(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
create or replace function pg_temp.us27_refuses(statement text,expected text) returns boolean language plpgsql as $$ begin
 execute statement; return false;
exception when others then
 if sqlstate=expected then return true; end if;
 raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
end $$;
create or replace function pg_temp.us27_status_snapshot() returns jsonb language sql as $$
 select jsonb_build_array(
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_bookings t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_booking_lines t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_status_changes t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_notifications t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.notification_outbox t));
$$;

-- Both staff accounts can change statuses; legacy missing/retired records remain readable.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select public.set_equipment_status(pg_temp.us27_id(4,2),'needs_repair','  Cracked casing  ',0);
select public.set_equipment_status(pg_temp.us27_id(4,2),'under_repair','Repair started',1);
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,2)::text,true);
select public.set_equipment_status(pg_temp.us27_id(4,2),'unavailable','Awaiting inspection',2);
select public.set_equipment_status(pg_temp.us27_id(4,2),'operational','Inspection passed',3);
select pg_temp.us27_status_assert(
 public.get_equipment_status(pg_temp.us27_id(4,2))->>'status'='operational'
 and jsonb_array_length(public.get_equipment_status(pg_temp.us27_id(4,2))->'history')=4
 and public.get_equipment_status(pg_temp.us27_id(4,5))->>'status'='missing'
 and public.get_equipment_status(pg_temp.us27_id(4,6))->>'status'='retired',
 'AC-027.5.1: all four supported statuses work with notes and retain legacy status meanings');
reset role;
select pg_temp.us27_status_assert(
 (select count(*)=4 and min(version)=1 and max(version)=4 and bool_and(changed_at>=transaction_timestamp()) from public.equipment_status_changes where item_id=pg_temp.us27_id(4,2))
 and exists(select 1 from public.equipment_status_changes where item_id=pg_temp.us27_id(4,2) and version=1 and note='Cracked casing'
  and previous_status='operational' and new_status='needs_repair' and changed_by=pg_temp.us27_id(1,1) and changed_by_name='US27 Staff 1')
 and exists(select 1 from public.equipment_status_changes where item_id=pg_temp.us27_id(4,2) and version=4 and changed_by=pg_temp.us27_id(1,2)),
 'AC-027.8.1: immutable per-unit versions record actual staff identity, trimmed note, old/new status and server time');

create temp table status_before_refusal as select pg_temp.us27_status_snapshot() as value;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select pg_temp.us27_status_assert(
 pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,4)',pg_temp.us27_id(4,2),'operational','   '),'22023')
 and pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,4)',pg_temp.us27_id(4,2),'retired','Unsupported target'),'22023')
 and pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,null)',pg_temp.us27_id(4,2),'needs_repair','Note'),'22023')
 and pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,3)',pg_temp.us27_id(4,2),'needs_repair','Stale'),'40001')
 and pg_temp.us27_refuses(format('select public.get_equipment_status(%L)',pg_temp.us27_id(4,999)),'22023')
 and pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,0)',pg_temp.us27_id(4,999),'needs_repair','Missing'),'22023'),
 'AC-027.5.2: blank note, unsupported status, absent/stale version and unknown units are refused');
select pg_temp.us27_status_assert(public.set_equipment_status(pg_temp.us27_id(4,2),'operational','No change',4)->>'changed'='false',
 'AC-027.5.3: unchanged status is a no-op without another audit, review or notification');
reset role;
select pg_temp.us27_status_assert((select value=pg_temp.us27_status_snapshot() from status_before_refusal),
 'AC-027.5.2: refused and no-op changes preserve exact snapshots');

-- Existing unrelated reasons must survive equipment status changes and restoration.
insert into public.event_planning_updates(id,event_id,changed_by,changed_by_name,changes)
values(pg_temp.us27_id(10,1),pg_temp.us27_id(5,1),pg_temp.us27_id(1,4),'Coordinator','{"purpose":"Updated"}');
insert into public.arrangement_review_flags(planning_update_id,event_id,equipment_booking_id,reason_code,detail)
values(pg_temp.us27_id(10,1),pg_temp.us27_id(5,1),pg_temp.us27_id(6,1),'equipment_requirements_review','Independent reason');
-- Exactly at the event start is not an upcoming event.
update public.events set proposed_start=now(),proposed_end=now()+interval '1 hour' where id=pg_temp.us27_id(5,5);
create temp table reservation_before_status as select
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_bookings t) as bookings,
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_booking_lines t) as lines,
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t) as allocations,
 (select jsonb_agg(to_jsonb(t) order by id) from public.events t) as events;
select pg_temp.us27_status_assert((select count(*)=1 from public.equipment_free_units(pg_temp.us27_id(3,1),pg_temp.us27_id(5,11),'2051-01-01','2051-01-02')),
 'AC-027.6.1: unoccupied Operational unit starts available');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select public.set_equipment_status(pg_temp.us27_id(4,1),'needs_repair','Lamp failure',0) as status_result \gset
reset role;
select pg_temp.us27_status_assert((:'status_result'::jsonb->>'reviewCount')::int=3
 and (select array_agg(equipment_booking_id order by equipment_booking_id)=array[pg_temp.us27_id(6,1),pg_temp.us27_id(6,2),pg_temp.us27_id(6,10)]
  from public.arrangement_review_flags where equipment_status_change_id is not null),
 'AC-027.7.1: upcoming reserved/checked-out arrangements flagged once per booking, including unassigned; past, start boundary, closed and returned/cancelled excluded');
select pg_temp.us27_status_assert((select
 bookings=(select jsonb_agg(to_jsonb(t) order by id) from public.equipment_bookings t)
 and lines=(select jsonb_agg(to_jsonb(t) order by id) from public.equipment_booking_lines t)
 and allocations=(select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t)
 and events=(select jsonb_agg(to_jsonb(t) order by id) from public.events t) from reservation_before_status)
 and exists(select 1 from public.arrangement_review_flags where detail='Independent reason' and status='open'),
 'AC-027.7.2: status change preserves exact reservations, quantities, allocations, events and independent review reasons');
select pg_temp.us27_status_assert(
 (select count(*)=2 from public.arrangement_review_notifications where event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10)))
 and (select count(*)=2 from public.notification_outbox where notification_type='arrangement_review' and event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10)))
 and not exists(select 1 from public.notification_outbox where event_id=pg_temp.us27_id(5,2) and notification_type='arrangement_review'),
 'AC-027.7.3: current Coordinator receives one in-app notice/email per affected booking; unassigned event has review without requester fallback');
select pg_temp.us27_status_assert(not exists(select 1 from public.equipment_free_units(pg_temp.us27_id(3,1),pg_temp.us27_id(5,11),'2051-01-01','2051-01-02')),
 'AC-027.6.1: status exclusion is immediate for all future windows');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select pg_temp.us27_status_assert(pg_temp.us27_refuses(format('select public.reserve_equipment(%L,1)',pg_temp.us27_id(9,11)),'23P01'),
 'AC-027.6.2: actual reservation refuses a non-operational unit and leaves the requirement undecided');
select public.set_equipment_status(pg_temp.us27_id(4,1),'operational','Repaired',1);
reset role;
select pg_temp.us27_status_assert((select count(*)=1 from public.equipment_free_units(pg_temp.us27_id(3,1),pg_temp.us27_id(5,11),'2051-01-01','2051-01-02'))
 and (select count(*)=3 from public.arrangement_review_flags where equipment_status_change_id is not null and status='open'),
 'AC-027.6.3: restoring Operational makes future stock eligible without resolving or cancelling any existing review');

-- Preferences control notices, not reviews. Change one person independently of the requester.
insert into public.notification_preferences(user_id,type_code,in_app,email)
values(pg_temp.us27_id(1,4),'arrangement_review',false,true);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select public.set_equipment_status(pg_temp.us27_id(4,1),'under_repair','Inspection',2);
reset role;
select pg_temp.us27_status_assert(
 (select count(*)=6 from public.arrangement_review_flags where equipment_status_change_id is not null)
 and (select count(*)=2 from public.arrangement_review_notifications where event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10)))
 and (select count(*)=4 from public.notification_outbox where notification_type='arrangement_review' and event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10))),
 'AC-027.7.4: email-only preference preserves reviews without creating another in-app copy');
select pg_temp.us27_status_assert(not exists(select 1 from public.equipment_free_units(pg_temp.us27_id(3,1),pg_temp.us27_id(5,11),'2051-01-01','2051-01-02')),
 'AC-027.6.1: Under Maintenance units are immediately excluded');
update public.notification_preferences set in_app=true,email=false where user_id=pg_temp.us27_id(1,4) and type_code='arrangement_review';
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select public.set_equipment_status(pg_temp.us27_id(4,1),'unavailable','Awaiting parts',3);
reset role;
select pg_temp.us27_status_assert(
 (select count(*)=9 from public.arrangement_review_flags where equipment_status_change_id is not null)
 and (select count(*)=4 from public.arrangement_review_notifications where event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10)))
 and (select count(*)=4 from public.notification_outbox where notification_type='arrangement_review' and event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10))),
 'AC-027.7.4: in-app-only preference queues no email; different non-operational changes retain their own history');
select pg_temp.us27_status_assert(not exists(select 1 from public.equipment_free_units(pg_temp.us27_id(3,1),pg_temp.us27_id(5,11),'2051-01-01','2051-01-02')),
 'AC-027.6.1: Unavailable units are immediately excluded');
update public.notification_preferences set in_app=false where user_id=pg_temp.us27_id(1,4) and type_code='arrangement_review';
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select public.set_equipment_status(pg_temp.us27_id(4,1),'needs_repair','Still damaged',4);
reset role;
select pg_temp.us27_status_assert(
 (select count(*)=12 from public.arrangement_review_flags where equipment_status_change_id is not null)
 and (select count(*)=4 from public.arrangement_review_notifications where event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10)))
 and (select count(*)=4 from public.notification_outbox where notification_type='arrangement_review' and event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10))),
 'AC-027.7.4: both channels off still records affected reservation reviews');

-- Atomic rollback on a failing notice, then a failing review write (deliberate injection).
create function pg_temp.us27_break_notice() returns trigger language plpgsql as $$ begin raise exception 'Injected US27 notice failure'; end $$;
create trigger us27_break_notice before insert on public.notification_outbox for each row execute function pg_temp.us27_break_notice();
update public.notification_preferences set in_app=true,email=true where user_id=pg_temp.us27_id(1,4) and type_code='arrangement_review';
create temp table status_before_failure as select pg_temp.us27_status_snapshot() as value;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select pg_temp.us27_status_assert(pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,5)',pg_temp.us27_id(4,1),'under_repair','Should roll back'),'P0001'),
 'AC-027.7.5: a notice-write failure refuses the whole status change');
reset role;
drop trigger us27_break_notice on public.notification_outbox;
create trigger us27_break_review before insert on public.arrangement_review_flags for each row execute function pg_temp.us27_break_notice();
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select pg_temp.us27_status_assert(pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,5)',pg_temp.us27_id(4,1),'under_repair','Should roll back'),'P0001'),
 'AC-027.7.5: a review-write failure refuses the whole status change');
reset role;
drop trigger us27_break_review on public.arrangement_review_flags;
select pg_temp.us27_status_assert((select value=pg_temp.us27_status_snapshot() from status_before_failure),
 'AC-027.7.5: failures preserve exact unit versions, audits, bookings, allocations, reviews and notices');

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,1)::text,true);
select pg_temp.us27_status_assert(
 pg_temp.us27_refuses(format('update public.equipment_items set operational_status=%L where id=%L','operational',pg_temp.us27_id(4,1)),'42501')
 and pg_temp.us27_refuses(format('update public.equipment_items set status_version=99 where id=%L',pg_temp.us27_id(4,1)),'42501')
 and pg_temp.us27_refuses('delete from public.equipment_status_changes','42501')
 and pg_temp.us27_refuses('update public.equipment_status_changes set note=''Forged''','42501')
 and pg_temp.us27_refuses(format('select public.review_equipment_status_change(%L)',pg_temp.us27_id(10,999)),'42501'),
 'AC-027.8.2: even Technical Support cannot bypass status validation, rewrite/delete audit or call the private review helper');
do $$ declare actor uuid; begin
 foreach actor in array array[pg_temp.us27_id(1,3),pg_temp.us27_id(1,4),pg_temp.us27_id(1,5),pg_temp.us27_id(1,6),pg_temp.us27_id(1,7),pg_temp.us27_id(1,8),pg_temp.us27_id(1,9),null::uuid] loop
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform pg_temp.us27_status_assert(
   pg_temp.us27_refuses(format('select public.set_equipment_status(%L,%L,%L,5)',pg_temp.us27_id(4,1),'operational','Forbidden'),'42501')
   and pg_temp.us27_refuses(format('select public.get_equipment_status(%L)',pg_temp.us27_id(4,1)),'42501'),
   'AC-027.8.3: other roles and signed-out claims cannot manage status or read internal history');
 end loop;
end $$;
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,5)::text,true);
select pg_temp.us27_status_assert(not exists(select 1 from public.arrangement_review_flags where event_id=pg_temp.us27_id(5,1))
 and not exists(select 1 from public.equipment_status_changes),
 'AC-027.8.3: unrelated Coordinator cannot read the reviews or Technical Support history');
select set_config('request.jwt.claim.sub',pg_temp.us27_id(1,4)::text,true);
select pg_temp.us27_status_assert((select count(*)=5 from public.arrangement_review_flags where equipment_booking_id=pg_temp.us27_id(6,1))
 and (select count(*)=4 from public.get_my_notifications(100) where event_id in(pg_temp.us27_id(5,1),pg_temp.us27_id(5,10)) and source='arrangement_review'),
 'AC-027.7.3: assigned Coordinator sees every independent reason and each permitted notice once, without duplicated email feed copies');
reset role;
rollback;
