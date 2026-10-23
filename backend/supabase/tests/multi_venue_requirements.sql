-- US49 Slice 1: actual transactions, using isolated fixtures and authenticated roles.
reset role;
select set_config('request.jwt.claim.sub','',false);
create function pg_temp.us49_id(k integer,n integer) returns uuid language sql as $$
 select ('49020000-0000-0000-'||lpad(k::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid; $$;
create function pg_temp.us49_refused(command text) returns boolean language plpgsql as $$
begin execute command; return false; exception when sqlstate '22023' or sqlstate '42501' or unique_violation then return true; end $$;
insert into auth.users(id,email) select pg_temp.us49_id(1,n),'us49-'||n||'@example.test' from generate_series(1,3)n;
update public.profiles set role=case id when pg_temp.us49_id(1,1) then 'organiser' when pg_temp.us49_id(1,2) then 'coordinator' else 'venue_staff' end,
 client_org_id=case when id=pg_temp.us49_id(1,1) then '0c0a0000-0000-4000-8000-000000000001'::uuid end
where id in(select pg_temp.us49_id(1,n) from generate_series(1,3)n);
insert into public.venues(id,name,location,capacity,layout,opens_at,closes_at,setup_minutes,turnaround_minutes)
select pg_temp.us49_id(2,n),'US49 space '||n,'Test',50,'theatre','00:00','24:00',15,15 from generate_series(1,4)n;
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,expected_attendance)
select pg_temp.us49_id(3,n),pg_temp.us49_id(1,1),pg_temp.us49_id(1,2),'US49 event','Multi room event','planning',
 '2049-11-01 10:00+08','2049-11-01 12:00+08',100 from generate_series(1,2)n;
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,false);
select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,1),'theatre',50) as us49_a \gset
select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,2),'theatre',30) as us49_b \gset
select pg_temp.us47_assert((select count(*)=2 from public.venue_bookings where event_id=pg_temp.us49_id(3,1)),
 'AC-049.1.1: one event can hold two different venues simultaneously');
select pg_temp.us47_assert((select space_layout='theatre' and space_attendance=50 from public.venue_bookings where id=:'us49_a')
 and (select space_attendance=30 from public.venue_bookings where id=:'us49_b'),
 'AC-049.2.1: each space retains its own layout and attendance instead of whole-event attendance');
select pg_temp.us47_assert(pg_temp.us49_refused('select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,3),''theatre'',51)'),
 'AC-049.3.1: capacity is checked independently and one person above capacity is refused');
select pg_temp.us47_assert(pg_temp.us49_refused('select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,3),''classroom'',10)')
 and pg_temp.us49_refused('select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,3),''theatre'',0)'),
 'AC-049.2.2: unavailable layouts and nonpositive attendance cannot create bookings');
select pg_temp.us47_assert(pg_temp.us49_refused('select public.hold_venue_space(pg_temp.us49_id(3,2),pg_temp.us49_id(2,1),''theatre'',10)'),
 'AC-049.3.2: another event cannot occupy an existing space reservation');
select pg_temp.us47_assert((select count(*)=2 from public.venue_bookings where event_id=pg_temp.us49_id(3,1)),
 'AC-049.1.2: refused third bookings preserve the two existing bookings');
select pg_temp.us47_assert(pg_temp.us49_refused(format('update public.venue_bookings set space_attendance=1 where id=%L',:'us49_a')),
 'AC-049.2.3: browser writes cannot rewrite the checked requirements');
update public.venue_bookings set status='pending_approval' where id in (:'us49_a',:'us49_b');
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,3)::text,false);
select pg_temp.us47_assert((public.get_venue_booking_review(:'us49_b')->'details'->>'attendance')::integer=30,
 'AC-049.2.4: Venue Staff review the attendance for this booking');
select pg_temp.us47_assert(pg_temp.us49_refused('select public.hold_venue_space(pg_temp.us49_id(3,1),pg_temp.us49_id(2,3),''theatre'',10)'),
 'AC-049.1.3: Venue Staff cannot create coordinator holds');
reset role;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.us47_assert((select count(*)=2 from public.venue_slot_claims where booking_id=:'us49_a' and kind='buffer')
 and (select count(*)=2 from public.venue_slot_claims where booking_id=:'us49_b' and kind='buffer'),
 'AC-049.3.3: each booking reserves its own setup and turnaround');
update public.venues set facility='{}' where id=pg_temp.us49_id(2,3);
update public.events set facility_requirements='{projector}' where id=pg_temp.us49_id(3,2);
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,false);
select pg_temp.us47_assert(pg_temp.us49_refused('select public.hold_venue_space(pg_temp.us49_id(3,2),pg_temp.us49_id(2,3),''theatre'',10)'),
 'AC-049.3.4: missing event facilities refuse a space before reservation');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Whole-event attendance is 100, but the approved room needs only 50 places.
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,3)::text,false);
select public.approve_venue_booking(:'us49_a',public.get_venue_booking_review(:'us49_a')->>'reviewVersion');
select pg_temp.us47_assert((select status='confirmed' from public.venue_bookings where id=:'us49_a')
 and (select status='pending_approval' from public.venue_bookings where id=:'us49_b'),
 'AC-049.3.5: approving a suitable space does not use event-wide attendance or decide another booking');
update public.venue_layouts set capacity=20 where venue_id=pg_temp.us49_id(2,2) and layout='theatre';
select pg_temp.us47_assert(pg_temp.us49_refused(format('select public.approve_venue_booking(%L,%L)',
 :'us49_b',public.get_venue_booking_review(:'us49_b')->>'reviewVersion')),
 'AC-049.3.6: reduced layout capacity is checked again at approval');
reset role;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.us47_assert(exists(select 1 from public.arrangement_review_flags where venue_booking_id=:'us49_b'
 and reason_code='venue_capacity' and detail like '%expects 30%'),
 'AC-049.3.7: venue edit review uses the affected booking attendance');
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us49_id(1,2)::text,false);
select pg_temp.us47_assert(pg_temp.us49_refused('select public.hold_venue(pg_temp.us49_id(3,2),pg_temp.us49_id(2,4))'),
 'AC-049.3.8: legacy hold API cannot bypass suitability checks');
select pg_temp.us47_assert(pg_temp.us49_refused('insert into public.venue_bookings(event_id,venue_id,requested_by,status) values(pg_temp.us49_id(3,2),pg_temp.us49_id(2,4),pg_temp.us49_id(1,2),''held'')'),
 'AC-049.2.6: direct browser inserts cannot bypass checked requirements');
reset role;
select set_config('request.jwt.claim.sub','',false);
create temp table us49_before_replay as select * from public.venue_bookings;
