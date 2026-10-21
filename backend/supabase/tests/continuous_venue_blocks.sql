-- Continuous block integration. Isolated fixtures; real checked RPCs and authenticated roles.
reset role;
select set_config('request.jwt.claim.sub','',false);
create function pg_temp.period_id(kind integer,n integer) returns uuid language sql immutable as $$
 select ('10000000-0000-0000-'||lpad(kind::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid; $$;
create function pg_temp.period_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.period_refused(command text,code text) returns boolean language plpgsql as $$
begin execute command; return false; exception when others then
 if sqlstate=code then return true; end if; raise exception 'Expected %, got %: %',code,sqlstate,sqlerrm; end $$;
insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.period_id(1,n),'period-'||n||'@example.test',jsonb_build_object('full_name','Period user '||n) from generate_series(1,3)n;
update public.profiles set role=case id when pg_temp.period_id(1,1) then 'organiser' when pg_temp.period_id(1,2) then 'coordinator' else 'venue_staff' end,
 client_org_id=case when id=pg_temp.period_id(1,1) then '0c0a0000-0000-4000-8000-000000000001'::uuid end
where id in(select pg_temp.period_id(1,n) from generate_series(1,3)n);
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,3)::text,false);
insert into public.venues(id,name,location,capacity,layout,opens_at,closes_at,setup_minutes,turnaround_minutes)
select pg_temp.period_id(2,n),'Continuous venue '||n,'Test',100,'theatre','00:00','24:00',0,0 from generate_series(1,4)n;
select set_config('request.jwt.claim.sub','',false);
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,expected_attendance,layout_preference)
select pg_temp.period_id(3,n),pg_temp.period_id(1,1),pg_temp.period_id(1,2),'Continuous event '||n,'Workshop','planning',
 case n when 1 then '2049-10-21 20:45+08'::timestamptz when 2 then '2049-10-21 21:00+08'::timestamptz
 when 3 then '2049-10-22 07:45+08'::timestamptz when 4 then '2049-10-22 08:00+08'::timestamptz
 else '2049-10-24 10:00+08'::timestamptz end,
 case n when 1 then '2049-10-21 21:00+08'::timestamptz when 2 then '2049-10-21 21:15+08'::timestamptz
 when 3 then '2049-10-22 08:00+08'::timestamptz when 4 then '2049-10-22 08:15+08'::timestamptz
 else '2049-10-24 10:15+08'::timestamptz end,10,'theatre' from generate_series(1,8)n;
-- Pending bookings on both sides of the endpoints; only the two inside need review.
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
select pg_temp.period_id(4,n),pg_temp.period_id(3,n),pg_temp.period_id(2,2),pg_temp.period_id(1,2),'pending_approval' from generate_series(1,4)n;
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_bookings b join public.events e on e.id=b.event_id
cross join lateral public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end)c where b.venue_id=pg_temp.period_id(2,2);
create temp table period_original_events as select * from public.events where id in(select pg_temp.period_id(3,n) from generate_series(1,8)n);
create temp table period_original_claims as select * from public.venue_slot_claims where venue_id=pg_temp.period_id(2,2);
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,2)::text,false);
select pg_temp.period_assert(
 pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''2049-10-21 21:00+08'',''2049-10-22 08:00+08'',''Safety'')','42501')
 and pg_temp.period_refused('select * from public.preview_venue_block_period(pg_temp.period_id(2,1),''2049-10-21 21:00+08'',''2049-10-22 08:00+08'')','42501')
 and pg_temp.period_refused('select public.save_venue_block_window(null,null,null,null,null,null,null)','42501')
 and pg_temp.period_refused('select public.venue_closure_covers(null,null,null)','42501'),
 'AC-012.1.13: non-staff preview/save and private block helpers are denied');
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,3)::text,false);
select pg_temp.period_assert(
 pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),null,''2049-10-22 08:00+08'',''Safety'')','22023')
 and pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''-infinity'',''infinity'',''Safety'')','22023')
 and pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''2049-10-21 21:01+08'',''2049-10-22 08:00+08'',''Safety'')','22023')
 and pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''2049-10-21 21:00+08'',''2049-10-21 21:00+08'',''Safety'')','22023')
 and pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''2049-10-22 21:00+08'',''2049-10-21 21:00+08'',''Safety'')','22023')
 and pg_temp.period_refused('select * from public.preview_venue_block_period(pg_temp.period_id(2,1),''2049-01-01 00:00+08'',''2050-01-02 00:15+08'')','22023')
 and pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''2049-10-21 21:00+08'',''2049-10-22 08:00+08'','' '')','22023'),
 'AC-012.2.33: null/infinite/misaligned/nonpositive/overlong periods and blank reasons are refused');
create temp table period_blocks(label text,id uuid);
insert into period_blocks values('overnight',public.block_venue_period(pg_temp.period_id(2,1),'2049-10-21 21:00+08','2049-10-22 08:00+08','Overnight safety'));
insert into period_blocks values('legacy',public.block_venue(pg_temp.period_id(2,1),'2049-10-21','2049-10-22',array['T0900','T1200'],'Legacy gaps'));
insert into period_blocks values('middle',public.block_venue_period(pg_temp.period_id(2,1),'2049-11-01 21:00+08','2049-11-03 08:00+08','Full middle day'));
select pg_temp.period_assert(
 (select count(*)=44 from public.venue_slot_claims where closure_id=(select id from period_blocks where label='overnight'))
 and (select count(*)=140 from public.venue_slot_claims where closure_id=(select id from period_blocks where label='middle'))
 and (select count(*)=4 from public.venue_slot_claims where closure_id=(select id from period_blocks where label='legacy'))
 and not exists(select 1 from public.venue_slot_claims where venue_id=pg_temp.period_id(2,1) and
 ((slot_date='2049-10-21' and slot='T2045') or(slot_date='2049-10-22' and slot='T0800')))
 and pg_temp.period_refused('select public.block_venue(pg_temp.period_id(2,1),''2049-10-22'',''2049-10-22'',array[''T0745''],''Overlap'')','23505')
 and pg_temp.period_refused('select public.block_venue_period(pg_temp.period_id(2,1),''2049-10-22 09:00+08'',''2049-10-22 09:15+08'',''Overlap legacy'')','23505'),
 'AC-012.2.34: overnight/interior days cover exact half-open cells; legacy gaps remain and mixed overlap is refused');
-- Adjacent intervals and midnight endpoint are legal, with no following-day cells.
insert into period_blocks values('adjacent',public.block_venue_period(pg_temp.period_id(2,1),'2049-10-22 08:00+08','2049-10-22 08:15+08','Touching endpoint'));
insert into period_blocks values('midnight',public.block_venue_period(pg_temp.period_id(2,1),'2049-12-01 23:45+08','2049-12-02 00:00+08','Midnight end'));
select pg_temp.period_assert((select count(*)=1 from public.venue_slot_claims where closure_id=(select id from period_blocks where label='midnight'))
 and exists(select 1 from public.venue_closures where id=(select id from period_blocks where label='midnight') and starts_on=ends_on and ends_on='2049-12-01'),
 'AC-012.2.34: an exclusive midnight endpoint does not occupy the following date');
select pg_temp.period_assert(
 (select count(distinct booking_id)=2 and count(*)=2 from public.preview_venue_block_period(pg_temp.period_id(2,2),'2049-10-21 21:00+08','2049-10-22 08:00+08') where overlap_type='booking')
 and (select count(*)=1 from public.preview_venue_block_period(pg_temp.period_id(2,1),'2049-10-22 07:45+08','2049-10-22 08:00+08') where overlap_type='existing_block')
 and not exists(select 1 from public.preview_venue_block_period(pg_temp.period_id(2,1),'2049-10-22 08:15+08','2049-10-22 08:30+08')),
 'AC-012.7.15: preview identifies exact endpoint bookings and overlapping blocks without including adjacent cells');
insert into period_blocks values('booked',public.block_venue_period(pg_temp.period_id(2,2),'2049-10-21 21:00+08','2049-10-22 08:00+08','Booked overnight'));
reset role;
grant select on period_blocks to authenticated;
select pg_temp.period_assert((select count(*)=2 from public.venue_booking_flags where closure_id=(select id from period_blocks where label='booked') and status='open')
 and not exists(select * from period_original_claims except select * from public.venue_slot_claims)
 and not exists(select * from period_original_events except select * from public.events),
 'AC-012.8.26: exact affected bookings get review flags while all original reservations and event details remain');
create function pg_temp.period_approve(n integer) returns uuid language plpgsql as $$
declare version text; begin select pg_temp.period_review_version(pg_temp.period_id(4,n)) into version;
 return public.approve_venue_booking(pg_temp.period_id(4,n),version); end $$;
create function pg_temp.period_review_version(id uuid) returns text language sql security definer as $$ select public.venue_booking_review_version(id); $$;
set role authenticated;
select pg_temp.period_approve(1);
select pg_temp.period_approve(4);
select pg_temp.period_assert(jsonb_array_length(public.get_venue_booking_review(pg_temp.period_id(4,1))->'conflicts')=0
 and jsonb_array_length(public.get_venue_booking_review(pg_temp.period_id(4,4))->'conflicts')=0
 and jsonb_array_length(public.get_venue_booking_review(pg_temp.period_id(4,2))->'conflicts')=1
 and pg_temp.period_refused('select pg_temp.period_approve(2)','23514')
 and pg_temp.period_refused('select pg_temp.period_approve(3)','23514'),
 'AC-012.5.6: staff approve bookings touching either endpoint but refuse bookings inside the block');
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,2)::text,false);
-- A different venue has no bookings; hold boundaries exercise the definition check directly.
select public.hold_venue(pg_temp.period_id(3,1),pg_temp.period_id(2,1));
select public.hold_venue(pg_temp.period_id(3,4),pg_temp.period_id(2,3));
select pg_temp.period_assert(pg_temp.period_refused('select public.hold_venue(pg_temp.period_id(3,2),pg_temp.period_id(2,1))','23505'),
 'AC-012.5.6: holds outside the period remain available and an inside hold is refused');
reset role;
create function pg_temp.period_source(n integer) returns text language sql security definer as $$ select public.venue_replacement_source_version(pg_temp.period_id(4,n)); $$;
create function pg_temp.period_request_version(id uuid) returns text language sql security definer as $$ select public.venue_replacement_version(id); $$;
set role authenticated;
-- Replacement uses the same checked approval and releases old booked cells to this exact closure.
create temp table period_request as select public.propose_venue_replacement(pg_temp.period_id(4,2),pg_temp.period_id(2,3),pg_temp.period_source(2),'Use available venue') id;
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,3)::text,false);
select public.decide_venue_replacement(id,pg_temp.period_request_version(id),'approved','Checked continuous replacement') from period_request;
reset role;
select pg_temp.period_assert(exists(select 1 from public.venue_slot_claims where venue_id=pg_temp.period_id(2,2) and slot_date='2049-10-21' and slot='T2100' and closure_id=(select id from period_blocks where label='booked'))
 and exists(select 1 from public.venue_booking_flags where booking_id=pg_temp.period_id(4,2) and status='resolved' and resolved_by=pg_temp.period_id(1,3) and replacement_booking_id is not null)
 and exists(select 1 from public.venue_booking_flags where booking_id=pg_temp.period_id(4,3) and status='open')
 and not exists(select 1 from public.venue_slot_claims where closure_id=(select id from period_blocks where label='booked') and slot_date='2049-10-22' and slot='T0800'),
 'AC-012.8.26: replacement approval reblocks the released exact cell and resolves only the replaced booking');
-- Settings expansion reaches a block on the next day; saved claims stay unchanged.
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,2)::text,false);
create temp table period_buffer_hold as select public.hold_venue(pg_temp.period_id(3,5),pg_temp.period_id(2,4)) id;
select set_config('request.jwt.claim.sub',pg_temp.period_id(1,3)::text,false);
select public.block_venue_period(pg_temp.period_id(2,4),'2049-10-23 21:00+08','2049-10-24 09:45+08','Before setup');
select public.update_venue_buffer_settings(pg_temp.period_id(2,4),public.get_venue_buffer_settings(pg_temp.period_id(2,4))->>'version',15,0);
reset role;
select pg_temp.period_assert(not exists(select 1 from public.arrangement_review_flags where venue_booking_id=(select id from period_buffer_hold) and status='open'),
 'AC-012.7.16: buffer ending exactly at the block end is adjacent, not overlapping');
set role authenticated;
select public.update_venue_buffer_settings(pg_temp.period_id(2,4),public.get_venue_buffer_settings(pg_temp.period_id(2,4))->>'version',30,0);
reset role;
select pg_temp.period_assert(exists(select 1 from public.arrangement_review_flags where venue_booking_id=(select id from period_buffer_hold) and status='open')
 and exists(select 1 from public.preview_venue_block_period(pg_temp.period_id(2,4),'2049-10-24 09:30+08','2049-10-24 09:45+08') where booking_id=(select id from period_buffer_hold) and claim_kind='buffer'),
 'AC-012.7.16: settings and preview detect derived setup inside the exact block without rewriting the hold');
reset role;
select pg_temp.period_assert((select count(*)=1 from public.venue_slot_claims where booking_id=(select id from period_buffer_hold)),
 'AC-012.7.16: settings preserve saved occupancy while effective occupancy includes newly required buffers');
set role authenticated;
select public.remove_venue_block(id) from period_blocks where label='booked';
select pg_temp.period_assert(not exists(select 1 from public.venue_slot_claims where closure_id=(select id from period_blocks where label='booked'))
 and exists(select 1 from public.venue_bookings where id=pg_temp.period_id(4,3) and status='pending_approval')
 and not exists(select 1 from public.venue_booking_flags where closure_id=(select id from period_blocks where label='booked') and status='open')
 and exists(select 1 from public.venue_closures where id=(select id from period_blocks where label='overnight') and removed_at is null),
 'AC-012.9.27: removing one continuous block releases only its maintenance cells/reviews and preserves other blocks and bookings');
reset role;
-- Keep all populated state for the runner's replay assertion (including legacy closures).
create function pg_temp.period_snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
 'events',(select jsonb_agg(to_jsonb(t) order by id) from public.events t),
 'bookings',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_bookings t),
 'claims',(select jsonb_agg(to_jsonb(t) order by venue_id,slot_date,slot) from public.venue_slot_claims t),
 'closures',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_closures t),
 'requests',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_replacement_requests t),
 'flags',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_booking_flags t),
 'reviews',(select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t)); $$;
create temp table period_before_replay as select pg_temp.period_snapshot() value;
