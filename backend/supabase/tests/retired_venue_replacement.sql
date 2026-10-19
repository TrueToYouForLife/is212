-- US20 AC3: real proposal/decision transactions, RLS and reservation preservation.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into auth.users(id,email,raw_user_meta_data) values
 ('20650000-0000-0000-0000-000000000001','us20s2-owner@example.test','{"full_name":"Owner"}'),
 ('20650000-0000-0000-0000-000000000002','us20s2-coordinator@example.test','{"full_name":"Coordinator"}'),
 ('20650000-0000-0000-0000-000000000003','us20s2-staff@example.test','{"full_name":"Venue Reviewer"}'),
 ('20650000-0000-0000-0000-000000000004','us20s2-other@example.test','{}');
update public.profiles set role=case right(id::text,1) when '1' then 'organiser' when '3' then 'venue_staff' else 'coordinator' end,
  client_org_id = case right(id::text,1) when '1' then '0c0a0000-0000-4000-8000-000000000001'::uuid else null end, 
  where id::text like '20650000-%';
insert into public.venues(id,name,location,capacity,layout,status) values
 ('20651000-0000-0000-0000-000000000001','US20 retired hall','Test',100,'Theatre','retired'),
 ('20651000-0000-0000-0000-000000000002','US20 alternative hall','Test',120,'Theatre','active'),
 ('20651000-0000-0000-0000-000000000003','US20 maintenance hall','Test',120,'Theatre','under_maintenance');
insert into public.events(id,organiser_id,coordinator_id,name,purpose,proposed_start,proposed_end,expected_attendance,status)
select ('20652000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '20650000-0000-0000-0000-000000000001','20650000-0000-0000-0000-000000000002',
 'Replacement event '||n,'Workshop',make_date(2039,1,n*3)+time '09:00',make_date(2039,1,n*3)+time '11:00',50,
 case n when 4 then 'confirmed' else 'approved' end from generate_series(1,7) n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status,hold_expires_at)
select ('20653000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('20652000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 case n when 5 then '20651000-0000-0000-0000-000000000002'::uuid else '20651000-0000-0000-0000-000000000001'::uuid end,
 '20650000-0000-0000-0000-000000000002',case n when 2 then 'pending_approval' when 3 then 'held' else 'confirmed' end,
 case n when 3 then now()+interval '2 days' else null end from generate_series(1,7) n;
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_bookings b join public.events e on e.id=b.event_id
 cross join lateral public.venue_review_cells(e.proposed_start,e.proposed_end) c where b.id::text like '20653000-%';
create temp table us20s2_claims_before as select * from public.venue_slot_claims;
-- Privileged fixture token readers are temporary test helpers, not application RPCs.
create function pg_temp.us20s2_source(n integer) returns text language sql security definer as $$
 select public.venue_replacement_source_version(('20653000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid); $$;
create function pg_temp.us20s2_version(id uuid) returns text language sql security definer as $$
 select public.venue_replacement_version(id); $$;
create function pg_temp.us20s2_propose(n integer,target uuid default '20651000-0000-0000-0000-000000000002',reason text default 'Alternative discussed with staff')
returns uuid language sql as $$
 select public.propose_venue_replacement(('20653000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,target,pg_temp.us20s2_source(n),reason); $$;
create function pg_temp.us20s2_refused(command text,code text) returns boolean language plpgsql as $$
begin execute command; return false; exception when others then return sqlstate=code; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000002',false);
select pg_temp.assert_true(jsonb_array_length(public.get_venue_replacements()->'sources')=5,
 'AC-020.3.1: assigned coordinator sees eligible retired bookings but not active venues or confirmed events');
select pg_temp.us20s2_propose(1);
select pg_temp.assert_true((select status='confirmed' from public.venue_bookings where id='20653000-0000-0000-0000-000000000001')
 and (select count(*)=1 from public.venue_replacement_requests where status='pending')
 and jsonb_array_length(public.get_venue_replacements()->'sources')=4,
 'AC-020.3.2: proposal records the alternative and keeps the original booking without duplicate propose controls');
select pg_temp.assert_true(pg_temp.us20s2_refused('select pg_temp.us20s2_propose(1)','23505')
 and pg_temp.us20s2_refused('select pg_temp.us20s2_propose(2,''20651000-0000-0000-0000-000000000002'','' '')','22023'),
 'AC-020.3.3: duplicate pending proposals and blank reasons are refused');
select pg_temp.assert_true(pg_temp.us20s2_refused('select pg_temp.us20s2_propose(4)','22023')
 and pg_temp.us20s2_refused('select pg_temp.us20s2_propose(5)','22023')
 and pg_temp.us20s2_refused('select pg_temp.us20s2_propose(2,''20651000-0000-0000-0000-000000000003'')','22023')
 and pg_temp.us20s2_refused('select pg_temp.us20s2_propose(2,''20651000-0000-0000-0000-000000000001'')','22023'),
 'AC-020.3.4: nonplanning events, active originals, maintenance targets and same-venue replacements are refused');
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),''approved'',''Agreed'') from public.venue_replacement_requests','42501'),
 'AC-020.3.5: coordinator cannot approve their own replacement');
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true(pg_temp.us20s2_refused('select pg_temp.us20s2_propose(2)','42501')
 and jsonb_array_length(public.get_venue_replacements()->'requests')=0 and not exists(select 1 from public.venue_replacement_requests),
 'AC-020.3.6: unassigned coordinator cannot propose or read another event replacement');
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.get_venue_replacements()','42501')
 and pg_temp.us20s2_refused('select pg_temp.us20s2_propose(2)','42501'),
 'AC-020.3.7: organiser cannot read the staff workflow or propose replacements');
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),''approved'','' '') from public.venue_replacement_requests','22023'),
 'AC-020.3.8: Venue Staff must record an agreement note');
select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),'approved','Alternative checked and agreed') from public.venue_replacement_requests;
select pg_temp.assert_true((select status='cancelled' from public.venue_bookings where id='20653000-0000-0000-0000-000000000001')
 and (select count(*)=1 from public.venue_replacement_requests q join public.venue_bookings b on b.id=q.replacement_booking_id
 where q.status='approved' and q.decided_by=auth.uid() and q.decided_by_name='Venue Reviewer' and b.status='confirmed')
 and not exists(select 1 from public.venue_slot_claims where booking_id='20653000-0000-0000-0000-000000000001'),
 'AC-020.3.9: approval atomically confirms the replacement, releases original claims and records actual Venue Staff identity');
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),''approved'',''Again'') from public.venue_replacement_requests','40001'),
 'AC-020.3.10: repeated decisions cannot duplicate a replacement');
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000002',false);
select pg_temp.us20s2_propose(2);
select pg_temp.us20s2_propose(3);
select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),'withdrawn','Changing the proposal') from public.venue_replacement_requests where original_booking_id='20653000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',false);
select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),'rejected','Alternative not agreed') from public.venue_replacement_requests where original_booking_id='20653000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select status='pending_approval' from public.venue_bookings where id='20653000-0000-0000-0000-000000000002')
 and (select status='held' from public.venue_bookings where id='20653000-0000-0000-0000-000000000003'),
 'AC-020.3.11: rejection and withdrawal retain original pending bookings and holds');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Occupy the proposed alternative after the proposal, exercising approval-time checks.
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
 select '20651000-0000-0000-0000-000000000002',slot_date,slot,kind,'20653000-0000-0000-0000-000000000005'
 from public.venue_slot_claims where booking_id='20653000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000002',false);
select pg_temp.us20s2_propose(2);
select pg_temp.us20s2_propose(6);
select pg_temp.us20s2_propose(7);
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),''approved'',''Agreed'') from public.venue_replacement_requests where original_booking_id=''20653000-0000-0000-0000-000000000002'' and status=''pending''','23505')
 and (select status='pending_approval' from public.venue_bookings where id='20653000-0000-0000-0000-000000000002'),
 'AC-020.3.12: an occupied target rolls back the replacement and original cancellation');
reset role;
select pg_temp.assert_true(not exists((select * from us20s2_claims_before where booking_id in ('20653000-0000-0000-0000-000000000002','20653000-0000-0000-0000-000000000003')
 except select * from public.venue_slot_claims)),
 'AC-020.3.13: failed approval, rejection and withdrawal preserve every original slot');
update public.events set name='Changed since proposal' where id='20652000-0000-0000-0000-000000000006';
set role authenticated;
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),''approved'',''Agreed'') from public.venue_replacement_requests where original_booking_id=''20653000-0000-0000-0000-000000000006''','40001'),
 'AC-020.3.14: changed event details require a new coordinator proposal even after staff reload');
reset role;
create function pg_temp.us20s2_fail_history() returns trigger language plpgsql as $$
begin raise exception 'Simulated decision storage failure'; end $$;
create trigger us20s2_fail_history before update on public.venue_replacement_requests for each row execute function pg_temp.us20s2_fail_history();
set role authenticated;
select pg_temp.assert_true(pg_temp.us20s2_refused('select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),''approved'',''Agreed'') from public.venue_replacement_requests where original_booking_id=''20653000-0000-0000-0000-000000000007''','P0001')
 and (select status='confirmed' from public.venue_bookings where id='20653000-0000-0000-0000-000000000007'),
 'AC-020.3.15: decision storage failure rolls back new approval and preserves the original booking');
select pg_temp.assert_true(pg_temp.us20s2_refused('update public.venue_replacement_requests set reason=''Forged''','42501')
 and pg_temp.us20s2_refused('delete from public.venue_replacement_requests','42501'),
 'AC-020.3.16: browser clients cannot rewrite or delete proposal/decision evidence');
reset role;
drop trigger us20s2_fail_history on public.venue_replacement_requests;
select set_config('request.jwt.claim.sub','',false);
-- Clear only the synthetic conflict cells, then exercise the pending and held paths.
delete from public.venue_slot_claims where booking_id='20653000-0000-0000-0000-000000000005'
 and slot_date in (select slot_date from public.venue_slot_claims where booking_id='20653000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',false);
select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),'approved','Conflict cleared and alternative agreed')
 from public.venue_replacement_requests where original_booking_id='20653000-0000-0000-0000-000000000002' and status='pending';
select pg_temp.assert_true((select status='cancelled' from public.venue_bookings where id='20653000-0000-0000-0000-000000000002')
 and (select count(*)=1 from public.venue_replacement_requests where original_booking_id='20653000-0000-0000-0000-000000000002' and status='approved'),
 'AC-020.3.19: pending original can be replaced without violating the one-active-hold index');
reset role;
update public.venue_bookings set hold_expires_at=now()-interval '1 second' where id='20653000-0000-0000-0000-000000000003';
set role authenticated;
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000002',false);
select pg_temp.assert_true(pg_temp.us20s2_refused('select pg_temp.us20s2_propose(3)','22023'),
 'AC-020.3.20: expired holds cannot be proposed for replacement');
reset role;
update public.venue_bookings set hold_expires_at=now()+interval '1 day' where id='20653000-0000-0000-0000-000000000003';
set role authenticated;
select pg_temp.us20s2_propose(3);
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',false);
select public.decide_venue_replacement(id,pg_temp.us20s2_version(id),'approved','Live hold alternative agreed')
 from public.venue_replacement_requests where original_booking_id='20653000-0000-0000-0000-000000000003' and status='pending';
select pg_temp.assert_true((select status='cancelled' from public.venue_bookings where id='20653000-0000-0000-0000-000000000003')
 and (select count(*)=1 from public.venue_replacement_requests q join public.venue_bookings b on b.id=q.replacement_booking_id
 where q.original_booking_id='20653000-0000-0000-0000-000000000003' and b.status='confirmed'),
 'AC-020.3.21: a live hold can become a confirmed staff-agreed replacement');
reset role;
select set_config('request.jwt.claim.sub','',false);
create temp table us20s2_requests_before_replay as select * from public.venue_replacement_requests;
create temp table us20s2_bookings_before_replay as select * from public.venue_bookings;
