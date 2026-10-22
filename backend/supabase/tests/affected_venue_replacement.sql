-- US48 current-schema integration checks. Synthetic fixtures, disposable PostgreSQL only.
-- Written after implementation from AC-048.1/3/4/5/6 and their failure guarantees.
reset role;
select set_config('request.jwt.claim.sub','',false);
create function pg_temp.us48_id(kind integer,n integer) returns uuid language sql immutable as $$
 select ('48000000-0000-0000-'||lpad(kind::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.us48_assert(ok boolean,label text) returns void language plpgsql as $$
begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
create function pg_temp.us48_refused(command text,code text) returns boolean language plpgsql as $$
begin execute command; return false; exception when others then
 if sqlstate=code then return true; end if;
 raise exception 'Expected %, got %: %',code,sqlstate,sqlerrm;
end $$;
insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.us48_id(1,n),'us48-'||n||'@example.test',jsonb_build_object('full_name','US48 user '||n)
from generate_series(1,4) n;
update public.profiles set role=case id when pg_temp.us48_id(1,1) then 'organiser'
 when pg_temp.us48_id(1,3) then 'venue_staff' else 'coordinator' end,
 client_org_id=case when id=pg_temp.us48_id(1,1) then '0c0a0000-0000-4000-8000-000000000001'::uuid end
where id in (select pg_temp.us48_id(1,n) from generate_series(1,4) n);
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
insert into public.venues(id,name,location,capacity,layout,opens_at,closes_at,setup_minutes,turnaround_minutes)
select pg_temp.us48_id(2,n),'US48 venue '||n,'Test',100,'theatre','00:00','24:00',
 case when n=3 then 15 else 0 end,case when n=3 then 30 else 0 end
from generate_series(1,4) n;
select set_config('request.jwt.claim.sub','',false);
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,
 expected_attendance,layout_preference,accessibility_requirements,facility_requirements)
select pg_temp.us48_id(3,n),pg_temp.us48_id(1,1),pg_temp.us48_id(1,2),'US48 event '||n,'Workshop',
 case when n=3 then 'confirmed' when n=8 then 'cancelled' when n=9 then 'completed' else 'planning' end,
 case when n=10 then now()-interval '2 days' else '2048-01-01 10:00+08'::timestamptz+n*interval '2 days' end,
 case when n=10 then now()-interval '1 day' else '2048-01-01 11:00+08'::timestamptz+n*interval '2 days' end,
 50,'theatre','{}','{}' from generate_series(1,24) n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status,hold_expires_at)
select pg_temp.us48_id(4,n),pg_temp.us48_id(3,n),pg_temp.us48_id(2,case when n=2 then 2 else 1 end),
 pg_temp.us48_id(1,2),case when n=4 then 'pending_approval' when n in (5,6) then 'held' else 'confirmed' end,
 case when n=5 then now()+interval '2 days' when n=6 then now()-interval '1 day' end
from generate_series(1,24) n;
-- Administrative setup reserves original quarter-hour cells before blocking them.
select set_config('request.jwt.claim.sub','',false);
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_bookings b join public.events e on e.id=b.event_id
cross join lateral public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end) c
where b.id in (select pg_temp.us48_id(4,n) from generate_series(1,24) n);
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
set role authenticated;
-- Real US12 blocking creates the reviews; expiry and terminal-event exclusions are tested below.
select public.block_venue(pg_temp.us48_id(2,1),date '2048-01-01'+n*2,
 date '2048-01-01'+n*2,array['T1000'],'Ceiling unsafe')
from generate_series(1,24)n where n not in (2,7,10);
reset role;
select public.retire_venue(pg_temp.us48_id(2,2),public.venue_edit_version(pg_temp.us48_id(2,2)),'Building retired');
-- Independent reasons on the same booking must survive replacement, in both stores.
insert into public.venue_booking_flags(booking_id,event_id,venue_id,cause,detail,created_by)
values(pg_temp.us48_id(4,1),pg_temp.us48_id(3,1),pg_temp.us48_id(2,1),'venue_details_changed','Independent details review',pg_temp.us48_id(1,3));
insert into public.arrangement_review_flags(venue_change_id,event_id,venue_booking_id,reason_code,detail)
select id,pg_temp.us48_id(3,1),pg_temp.us48_id(4,1),'venue_capacity','Independent capacity review'
from public.venue_changes where venue_id=pg_temp.us48_id(2,1) and action='created';
insert into public.arrangement_review_flags(venue_change_id,event_id,venue_booking_id,reason_code,detail)
select id,pg_temp.us48_id(3,1),pg_temp.us48_id(4,1),'venue_retired','Retirement also requires replacement'
from public.venue_changes where venue_id=pg_temp.us48_id(2,1) and action='created';
-- A resolved historical review must not acquire the new replacement's audit metadata.
insert into public.venue_booking_flags(booking_id,event_id,venue_id,cause,detail,created_by,status,resolved_at,resolution)
values(pg_temp.us48_id(4,1),pg_temp.us48_id(3,1),pg_temp.us48_id(2,1),'venue_retired','Earlier issue',pg_temp.us48_id(1,3),
 'resolved','2026-01-01','Earlier resolution');
create temp table us48_events_before as select * from public.events where id in(select pg_temp.us48_id(3,n) from generate_series(1,24)n);
create function pg_temp.us48_source(n integer) returns text language sql security definer as $$
 select public.venue_replacement_source_version(pg_temp.us48_id(4,n)); $$;
create function pg_temp.us48_propose(n integer,target integer default 3) returns uuid language sql as $$
 select public.propose_venue_replacement(pg_temp.us48_id(4,n),pg_temp.us48_id(2,target),pg_temp.us48_source(n),'Alternative agreed for review'); $$;
-- The helper reads tokens as administrator but runs every mutation with the caller's role.
-- Private token functions remain non-executable by browser roles.
create or replace function pg_temp.us48_decide(n integer,decision text default 'approved') returns uuid language plpgsql as $$
declare request_id uuid; version text;
begin
 select q.id into request_id from public.venue_replacement_requests q where q.original_booking_id=pg_temp.us48_id(4,n) and q.status='pending';
 select pg_temp.us48_request_version(request_id) into version;
 return public.decide_venue_replacement(request_id,version,decision,'Checked current arrangements');
end $$;
create function pg_temp.us48_request_version(id uuid) returns text language sql security definer as $$
 select public.venue_replacement_version(id); $$;
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,2)::text,false);
select pg_temp.us48_assert(
 exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'sources') s where s->>'id'=pg_temp.us48_id(4,1)::text
 and s->'reasons' @> '[{"code":"venue_blocked","detail":"Venue blocked: Ceiling unsafe"}]'::jsonb)
 and exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'sources') s where s->>'id'=pg_temp.us48_id(4,2)::text
 and s->'reasons' @> '[{"code":"venue_retired"}]'::jsonb)
 and not exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'sources') s
 where s->>'id' in (select pg_temp.us48_id(4,n)::text from generate_series(6,10)n)),
 'AC-048.1.1: assigned Coordinator sees blocked/retired reasons and excludes unaffected, expired, closed and past bookings');
select pg_temp.us48_propose(1);
select pg_temp.us48_assert(
 exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'affectedBookings') s
 where s->>'id'=pg_temp.us48_id(4,1)::text and s->>'needsReplacement'='true')
 and not exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'sources')s where s->>'id'=pg_temp.us48_id(4,1)::text)
 and exists(select 1 from public.venue_bookings where id=pg_temp.us48_id(4,1) and status='confirmed')
 and not exists(select 1 from public.venue_bookings where event_id=pg_temp.us48_id(3,1) and venue_id=pg_temp.us48_id(2,3)),
 'AC-048.5.1: pending proposal still needs replacement, preserves the original and reserves no target');
select pg_temp.us48_assert(
 pg_temp.us48_refused('select pg_temp.us48_propose(1)','23505')
 and pg_temp.us48_refused('select public.propose_venue_replacement(pg_temp.us48_id(4,4),pg_temp.us48_id(2,3),pg_temp.us48_source(4),'' '')','22023')
 and pg_temp.us48_refused('select pg_temp.us48_decide(1)','42501')
 and pg_temp.us48_refused('update public.venue_replacement_requests set status=''rejected''','42501')
 and pg_temp.us48_refused('update public.venue_booking_flags set resolved_by=auth.uid()','42501')
 and pg_temp.us48_refused('select public.venue_replacement_reasons(pg_temp.us48_id(4,1))','42501'),
 'AC-048.3.1: duplicate/blank proposals, self-approval and direct audit/helper writes are refused');
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,4)::text,false);
select pg_temp.us48_assert(jsonb_array_length(public.get_venue_replacements()->'sources')=0
 and jsonb_array_length(public.get_venue_replacements()->'affectedBookings')=0
 and jsonb_array_length(public.get_venue_replacements()->'requests')=0
 and pg_temp.us48_refused('select pg_temp.us48_propose(4)','42501'),
 'AC-048.3.2: unassigned Coordinator cannot see or propose another event replacement');
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,1)::text,false);
select pg_temp.us48_assert(pg_temp.us48_refused('select public.get_venue_replacements()','42501')
 and pg_temp.us48_refused('select pg_temp.us48_propose(4)','42501'),
 'AC-048.3.2: organiser cannot use the internal replacement workflow');
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,2)::text,false);
select pg_temp.us48_assert(
 pg_temp.us48_refused('select pg_temp.us48_propose(6)','22023')
 and pg_temp.us48_refused('select pg_temp.us48_propose(7)','22023')
 and pg_temp.us48_refused('select pg_temp.us48_propose(8)','22023')
 and pg_temp.us48_refused('select pg_temp.us48_propose(9)','22023')
 and pg_temp.us48_refused('select pg_temp.us48_propose(10)','22023')
 and pg_temp.us48_refused('select pg_temp.us48_propose(4,1)','22023')
 and pg_temp.us48_refused('select pg_temp.us48_propose(4,2)','22023'),
 'AC-048.3.3: expired holds, unaffected/closed/past events and same/retired targets are ineligible');
select pg_temp.us48_propose(n) from generate_series(2,5)n;
select pg_temp.us48_propose(n) from generate_series(11,21)n;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
select pg_temp.us48_decide(1);
reset role;
select pg_temp.us48_assert(
 exists(select 1 from public.venue_replacement_requests q join public.venue_bookings b on b.id=q.replacement_booking_id
 where q.original_booking_id=pg_temp.us48_id(4,1) and q.status='approved' and q.decided_by=pg_temp.us48_id(1,3)
 and b.status='confirmed' and b.reviewed_by=q.decided_by
 and (select count(*)=7 from public.venue_slot_claims where booking_id=b.id)
 and (select count(*)=4 from public.venue_slot_claims where booking_id=b.id and kind='event'))
 and exists(select 1 from public.venue_bookings where id=pg_temp.us48_id(4,1) and status='cancelled')
 and not exists(select 1 from public.venue_slot_claims where booking_id=pg_temp.us48_id(4,1))
 and exists(select 1 from public.venue_slot_claims c where c.venue_id=pg_temp.us48_id(2,1) and c.slot='T1000'
 and c.slot_date='2048-01-03' and c.kind='maintenance')
 and exists(select 1 from public.venue_booking_flags f join public.venue_replacement_requests q on q.original_booking_id=f.booking_id
 where f.booking_id=pg_temp.us48_id(4,1) and f.cause='venue_blocked' and f.status='resolved'
 and f.resolved_by=q.decided_by and f.replacement_booking_id=q.replacement_booking_id and f.resolved_at is not null)
 and exists(select 1 from public.arrangement_review_flags f join public.venue_replacement_requests q on q.original_booking_id=f.venue_booking_id
 where f.venue_booking_id=pg_temp.us48_id(4,1) and f.reason_code='venue_retired' and f.status='resolved'
 and f.resolved_by=q.decided_by and f.replacement_booking_id=q.replacement_booking_id)
 and exists(select 1 from public.venue_booking_flags where booking_id=pg_temp.us48_id(4,1) and cause='venue_details_changed' and status='open')
 and exists(select 1 from public.arrangement_review_flags where venue_booking_id=pg_temp.us48_id(4,1) and reason_code='venue_capacity' and status='open')
 and exists(select 1 from public.venue_booking_flags where booking_id=pg_temp.us48_id(4,1) and resolution='Earlier resolution'
 and resolved_at='2026-01-01' and replacement_booking_id is null and resolved_by is null),
 'AC-048.6.1: blocked approval reserves target-specific buffers, reblocks old cells and resolves only eligible open reviews with staff/link audit');
set role authenticated;
select pg_temp.us48_decide(n) from generate_series(2,5)n;
reset role;
select pg_temp.us48_assert(
 (select count(*)=4 from public.venue_replacement_requests q join public.venue_bookings b on b.id=q.replacement_booking_id
 where q.original_booking_id in(select pg_temp.us48_id(4,n) from generate_series(2,5)n) and q.status='approved' and b.status='confirmed')
 and exists(select 1 from public.arrangement_review_flags f join public.venue_replacement_requests q on q.original_booking_id=f.venue_booking_id
 where f.venue_booking_id=pg_temp.us48_id(4,2) and f.reason_code='venue_retired' and f.status='resolved'
 and f.resolved_by=q.decided_by and f.replacement_booking_id=q.replacement_booking_id and f.resolution_method='corrected')
 and exists(select 1 from public.events where id=pg_temp.us48_id(3,3) and status='confirmed'),
 'AC-048.6.2: retired reviews resolve; upcoming Confirmed events, pending requests and live holds can be replaced');
select pg_temp.us48_assert(
 not exists((select * from us48_events_before except select * from public.events)
 union all(select e.* from public.events e join us48_events_before old on old.id=e.id except select * from us48_events_before)),
 'AC-048.4.1: successful replacements keep every original event field and status unchanged');

-- Snapshot every relevant row before non-success outcomes, not just the booking status.
create temp table us48_bookings_before as select * from public.venue_bookings where event_id in(select pg_temp.us48_id(3,n) from generate_series(11,21)n);
create temp table us48_claims_before as select * from public.venue_slot_claims where booking_id in(select pg_temp.us48_id(4,n) from generate_series(11,21)n);
create temp table us48_flags_before as select * from public.venue_booking_flags where booking_id in(select pg_temp.us48_id(4,n) from generate_series(11,21)n);
set role authenticated;
select pg_temp.us48_decide(13,'rejected');
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,2)::text,false);
select pg_temp.us48_decide(14,'withdrawn');
select pg_temp.us48_assert(
 (select count(*)=2 from jsonb_array_elements(public.get_venue_replacements()->'affectedBookings')s
 where s->>'id' in (pg_temp.us48_id(4,13)::text,pg_temp.us48_id(4,14)::text) and s->>'needsReplacement'='true')
 and (select count(*)=2 from public.venue_replacement_requests where original_booking_id in(pg_temp.us48_id(4,13),pg_temp.us48_id(4,14)) and status in('rejected','withdrawn')),
 'AC-048.6.3: rejection and withdrawal retain affected status and recorded decisions');
-- Changes after proposal: fresh staff review cannot silently accept changed Coordinator consent.
reset role;
create temp table us48_loaded as select q.id,public.venue_replacement_version(q.id) version from public.venue_replacement_requests q
where q.original_booking_id in(pg_temp.us48_id(4,15),pg_temp.us48_id(4,16));
grant select on us48_loaded to authenticated;
select set_config('request.jwt.claim.sub','',false);
update public.events set expected_attendance=60 where id=pg_temp.us48_id(3,15);
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
select public.remove_venue_block(closure_id) from public.venue_booking_flags where booking_id=pg_temp.us48_id(4,16);
select pg_temp.us48_assert(
 pg_temp.us48_refused('select public.decide_venue_replacement(id,version,''approved'',''Old review'') from us48_loaded where id in(select id from public.venue_replacement_requests where original_booking_id=pg_temp.us48_id(4,15))','40001')
 and pg_temp.us48_refused('select pg_temp.us48_decide(15)','40001')
 and pg_temp.us48_refused('select pg_temp.us48_decide(16)','40001'),
 'AC-048.3.4: changed event consent or removed block invalidates approval even after reloading staff review');
-- Target-only block, including only its setup time, is checked by normal approval.
select public.block_venue(pg_temp.us48_id(2,3),'2048-01-23','2048-01-23',array['T0945'],'Target setup unavailable');
select pg_temp.us48_assert(pg_temp.us48_refused('select pg_temp.us48_decide(11)','23514'),
 'AC-048.6.4: target block covering only setup rejects approval and rolls back the switch');
reset role;
select set_config('request.jwt.claim.sub','',false);
-- A saved neighbour ended at 09:30. Increased turnaround makes only its derived
-- occupancy conflict with the replacement's setup; no saved ledger cell overlaps.
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
values(pg_temp.us48_id(3,100),pg_temp.us48_id(1,1),pg_temp.us48_id(1,2),'planning','Neighbour','2048-01-25 09:00+08','2048-01-25 09:30+08',10);
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
values(pg_temp.us48_id(4,100),pg_temp.us48_id(3,100),pg_temp.us48_id(2,3),pg_temp.us48_id(1,2),'confirmed');
select set_config('request.jwt.claim.sub','',false);
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
values(pg_temp.us48_id(2,3),'2048-01-25','T0900','event',pg_temp.us48_id(4,100)),
 (pg_temp.us48_id(2,3),'2048-01-25','T0915','event',pg_temp.us48_id(4,100));
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
select pg_temp.us48_assert(pg_temp.us48_refused('select pg_temp.us48_decide(12)','23505'),
 'AC-048.6.5: derived neighbour turnaround conflicts with target setup without losing original rows');
-- Review persistence is part of approval: force that final write to fail, expect full rollback.
reset role;
create function pg_temp.us48_fail_resolution() returns trigger language plpgsql as $$
begin
 if old.booking_id=pg_temp.us48_id(4,21) and new.status='resolved' then
  raise exception 'Injected resolution failure' using errcode='P0048';
 end if;
 return new;
end $$;
create trigger us48_fail_resolution before update on public.venue_booking_flags
for each row execute function pg_temp.us48_fail_resolution();
set role authenticated;
select pg_temp.us48_assert(pg_temp.us48_refused('select pg_temp.us48_decide(21)','P0048'),
 'AC-048.6.6: a review-write failure rolls back booking, claims, proposal decision and audit together');
reset role;
drop trigger us48_fail_resolution on public.venue_booking_flags;
-- Validate all originals/claims/reviews after rejected, withdrawn and failed approvals.
-- Block removal above intentionally resolved event 16, so exclude only that external action.
select pg_temp.us48_assert(
 not exists((select * from us48_bookings_before except select * from public.venue_bookings)
 union all(select b.* from public.venue_bookings b where b.event_id in(select pg_temp.us48_id(3,n) from generate_series(11,21)n) except select * from us48_bookings_before))
 and not exists((select * from us48_claims_before except select * from public.venue_slot_claims)
 union all(select c.* from public.venue_slot_claims c where c.booking_id in(select pg_temp.us48_id(4,n) from generate_series(11,21)n) except select * from us48_claims_before))
 and not exists((select * from us48_flags_before where booking_id<>pg_temp.us48_id(4,16) except select * from public.venue_booking_flags)
 union all(select f.* from public.venue_booking_flags f where f.booking_id in(select pg_temp.us48_id(4,n) from generate_series(11,21)n where n<>16) except select * from us48_flags_before))
 and (select count(*)=3 from public.venue_replacement_requests where original_booking_id in(pg_temp.us48_id(4,11),pg_temp.us48_id(4,12),pg_temp.us48_id(4,21)) and status='pending'),
 'AC-048.6.6: unsuccessful outcomes leave exact original booking, claim and review snapshots intact');
-- Target edits invalidate a loaded staff decision, but do not rewrite Coordinator consent.
create temp table us48_target_loaded as select q.id,public.venue_replacement_version(q.id) version
from public.venue_replacement_requests q where q.original_booking_id=pg_temp.us48_id(4,20);
grant select on us48_target_loaded to authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
update public.venues set name='US48 updated target' where id=pg_temp.us48_id(2,3);
set role authenticated;
select pg_temp.us48_assert(pg_temp.us48_refused('select public.decide_venue_replacement(id,version,''approved'',''Old target review'') from us48_target_loaded','40001'),
 'AC-048.3.4: changed target details invalidate the loaded staff decision');
reset role;
-- Handover changes who may withdraw or propose; historical proposer remains unchanged.
select set_config('request.jwt.claim.sub','',false);
update public.events set coordinator_id=pg_temp.us48_id(1,4) where id=pg_temp.us48_id(3,17);
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,2)::text,false);
select pg_temp.us48_assert(pg_temp.us48_refused('select pg_temp.us48_decide(17,''withdrawn'')','42501'),
 'AC-048.3.5: previous Coordinator loses replacement management after reassignment');
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,4)::text,false);
select pg_temp.us48_decide(17,'withdrawn');
select pg_temp.us48_propose(17);
select pg_temp.us48_assert(exists(select 1 from public.venue_replacement_requests where original_booking_id=pg_temp.us48_id(4,17)
 and status='pending' and proposed_by=auth.uid()),
 'AC-048.3.5: current Coordinator can withdraw stale history and submit a fresh proposal');
reset role;
-- Ordinary cancellation still retains US12 cleanup; replacement exception is narrowly scoped.
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,3)::text,false);
update public.venue_bookings set status='cancelled' where id=pg_temp.us48_id(4,22);
select pg_temp.us48_assert(exists(select 1 from public.venue_booking_flags where booking_id=pg_temp.us48_id(4,22)
 and status='resolved' and resolution='Booking cancelled' and replacement_booking_id is null),
 'AC-048.6.7: ordinary cancellation retains existing flag cleanup without inventing replacement audit');
-- Ordinary new bookings on Confirmed events remain ineligible.
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
values(pg_temp.us48_id(4,101),pg_temp.us48_id(3,3),pg_temp.us48_id(2,4),pg_temp.us48_id(1,2),'pending_approval');
create function pg_temp.us48_booking_version(id uuid) returns text language sql security definer as $$
 select public.venue_booking_review_version(id); $$;
set role authenticated;
select pg_temp.us48_assert(pg_temp.us48_refused('select public.approve_venue_booking(pg_temp.us48_id(4,101),pg_temp.us48_booking_version(pg_temp.us48_id(4,101)))','22023'),
 'AC-048.3.6: Confirmed-event exception does not permit ordinary unrelated booking approvals');
reset role;
-- Prepare real two-session races. No assertion depends on a guessed winner.
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,2)::text,false);
select pg_temp.us48_decide(18,'withdrawn');
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.events set proposed_start='2048-02-10 10:00+08',proposed_end='2048-02-10 11:00+08'
where id=pg_temp.us48_id(3,24);
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us48_id(1,2)::text,false);
select pg_temp.us48_propose(24);
reset role;
create function pg_temp.us48_snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
 'events',(select jsonb_agg(to_jsonb(t) order by id) from public.events t),
 'bookings',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_bookings t),
 'claims',(select jsonb_agg(to_jsonb(t) order by venue_id,slot_date,slot) from public.venue_slot_claims t),
 'requests',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_replacement_requests t),
 'flags',(select jsonb_agg(to_jsonb(t) order by id) from public.venue_booking_flags t),
 'reviews',(select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t));
$$;
create temp table us48_replay_before as select pg_temp.us48_snapshot() value;
