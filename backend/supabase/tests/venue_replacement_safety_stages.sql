-- US48 safety-stage compatibility. Synthetic fixtures, disposable PostgreSQL only.
reset role;
select set_config('request.jwt.claim.sub','',false);
create function pg_temp.s48_id(kind integer,n integer) returns uuid language sql immutable as $$
 select ('48160000-0000-0000-'||lpad(kind::text,4,'0')||'-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.s48_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label; end $$;
create function pg_temp.s48_refused(command text,code text) returns boolean language plpgsql as $$
begin execute command; return false; exception when others then
 if sqlstate=code then return true; end if;
 raise exception 'Expected %, got %: %',code,sqlstate,sqlerrm; end $$;
insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.s48_id(1,n),'us48-safety-'||n||'@example.test',jsonb_build_object('full_name','US48 safety user '||n)
from generate_series(1,5)n;
update public.profiles set role=case id when pg_temp.s48_id(1,1) then 'organiser'
 when pg_temp.s48_id(1,3) then 'venue_staff' when pg_temp.s48_id(1,5) then 'safety_officer' else 'coordinator' end,
 client_org_id=case when id=pg_temp.s48_id(1,1) then '0c0a0000-0000-4000-8000-000000000001'::uuid end
where id in(select pg_temp.s48_id(1,n) from generate_series(1,5)n);
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
insert into public.venues(id,name,location,capacity,layout,opens_at,closes_at,setup_minutes,turnaround_minutes)
select pg_temp.s48_id(2,n),'US48 safety venue '||n,'Test',100,'theatre','00:00','24:00',
 case when n=3 then 15 else 0 end,case when n=3 then 30 else 0 end from generate_series(1,4)n;
select set_config('request.jwt.claim.sub','',false);
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,proposed_start,proposed_end,
 expected_attendance,layout_preference,accessibility_requirements,facility_requirements)
select pg_temp.s48_id(3,n),pg_temp.s48_id(1,1),pg_temp.s48_id(1,2),'US48 safety event '||n,'Workshop',
 case when n<=14 then 'awaiting_safety_review' when n<=28 then 'in_preparation'
 when n=29 then 'safety_changes_requested' when n=30 then 'cancelled' else 'completed' end,
 '2049-01-01 10:00+08'::timestamptz+(case when n in(13,27) then n-1 else n end)*interval '2 days',
 '2049-01-01 11:00+08'::timestamptz+(case when n in(13,27) then n-1 else n end)*interval '2 days',
 50,'theatre','{}','{}' from generate_series(1,31)n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status,space_layout,space_attendance)
select pg_temp.s48_id(4,n),pg_temp.s48_id(3,n),pg_temp.s48_id(2,
 case when n in(2,16) then 2 when n in(13,27) then 4 else 1 end),
 pg_temp.s48_id(1,2),case when n in(9,23) then 'pending_approval' else 'confirmed' end,'theatre',40
from generate_series(1,31)n;
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select b.venue_id,c.slot_date,c.slot,c.kind,b.id from public.venue_bookings b
join public.events e on e.id=b.event_id cross join lateral
 public.venue_review_cells(b.venue_id,e.proposed_start,e.proposed_end)c
where b.id in(select pg_temp.s48_id(4,n) from generate_series(1,31)n);
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
set role authenticated;
select public.block_venue(pg_temp.s48_id(2,case when n in(13,27) then 4 else 1 end),
 date '2049-01-01'+(case when n in(13,27) then n-1 else n end)*2,
 date '2049-01-01'+(case when n in(13,27) then n-1 else n end)*2,array['T1000'],'US48 safety source blocked')
from generate_series(1,31)n where n not in(2,16);
reset role;
select public.retire_venue(pg_temp.s48_id(2,2),public.venue_edit_version(pg_temp.s48_id(2,2)),'US48 source retired');
-- Additional unrelated reasons must survive automatic replacement resolution.
insert into public.venue_booking_flags(booking_id,event_id,venue_id,cause,detail,created_by)
select b.id,b.event_id,b.venue_id,'venue_details_changed','Independent details review',pg_temp.s48_id(1,3)
from public.venue_bookings b where b.id in(select pg_temp.s48_id(4,n) from unnest(array[1,2,15,16])n);
insert into public.arrangement_review_flags(venue_change_id,event_id,venue_booking_id,reason_code,detail)
select c.id,b.event_id,b.id,'venue_capacity','Independent capacity review'
from public.venue_bookings b join public.venue_changes c on c.venue_id=b.venue_id and c.action='created'
where b.id in(select pg_temp.s48_id(4,n) from unnest(array[1,2,15,16])n);
-- Retained decisions are fixture history; this patch must not rewrite or manufacture a safety decision.
insert into public.safety_review_decisions(event_id,decided_by,decision,comment,revisit)
select pg_temp.s48_id(3,n),pg_temp.s48_id(1,5),
 case when n<=14 then 'request_changes' else 'approve' end,'Prior safety assessment',
 case when n<=14 then array['venue'] else '{}'::text[] end from generate_series(1,28)n;
create temp table s48_safety_before as select * from public.safety_review_decisions;
create temp table s48_events_before as select * from public.events where id in
 (select pg_temp.s48_id(3,n) from generate_series(1,31)n);
create function pg_temp.s48_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_array(
 (select jsonb_agg(to_jsonb(t) order by id) from public.events t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.venue_bookings t),
 (select jsonb_agg(to_jsonb(t) order by venue_id,slot_date,slot) from public.venue_slot_claims t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.venue_replacement_requests t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.venue_booking_flags t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.notification_outbox t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.safety_review_decisions t));
$$;
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,2)::text,false);
set role authenticated;
select pg_temp.s48_assert(
 (select count(*)=28 from jsonb_array_elements(public.get_venue_replacements()->'sources')v
 where v->>'id' in(select pg_temp.s48_id(4,n)::text from generate_series(1,28)n))
 and (select count(*)=28 from jsonb_array_elements(public.get_venue_replacements()->'affectedBookings')v
 where v->>'id' in(select pg_temp.s48_id(4,n)::text from generate_series(1,28)n))
 and not exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'sources')v
 where v->>'id' in(select pg_temp.s48_id(4,n)::text from generate_series(29,31)n)),
 'AC-048.1.5: both agreed safety stages expose affected sources; unagreed/terminal stages remain excluded');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,4)::text,false);
set role authenticated;
select pg_temp.s48_assert(not exists(select 1 from jsonb_array_elements(public.get_venue_replacements()->'sources')v
 where v->>'id' like '48160000%') and pg_temp.s48_refused(format(
 'select public.propose_venue_replacement(%L,%L,%L,%L)',pg_temp.s48_id(4,1),pg_temp.s48_id(2,3),
 'not-the-version','Wrong owner'),'42501'),
 'AC-048.3.10: only the assigned Coordinator can list/propose a safety-stage replacement');
reset role;
-- Source versions are private; capture consent as administrator for independent assertions.
create temp table s48_requests(n integer primary key,id uuid,version text);
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,2)::text,false);
do $$ declare n integer; request uuid; begin
 for n in 1..28 loop
  if n in(9,10,23,24) then continue; end if;
  request:=public.propose_venue_replacement(pg_temp.s48_id(4,n),pg_temp.s48_id(2,3),
   public.venue_replacement_source_version(pg_temp.s48_id(4,n)),'Safety-stage replacement');
  insert into s48_requests values(n,request,public.venue_replacement_version(request));
 end loop;
end $$;
-- Proposed target reserves nothing and never mutates event/booking/claims.
select pg_temp.s48_assert(not exists(select 1 from public.venue_bookings where venue_id=pg_temp.s48_id(2,3))
 and not exists(select 1 from s48_events_before old join public.events e using(id) where to_jsonb(old)<>to_jsonb(e))
 and (select count(*)=28 from public.venue_bookings where id in(select pg_temp.s48_id(4,n) from generate_series(1,28)n)),
 'AC-048.4.2: safety-stage proposals preserve event information and original reservations without target claims');
-- Approve blocked and retired originals in each stage through the real Venue Staff RPC.
grant select on s48_requests to authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
set role authenticated;
select public.decide_venue_replacement(id,version,'approved','Approved replacement') from s48_requests where n in(1,2,15,16);
reset role;
select pg_temp.s48_assert((select count(*)=4 from public.venue_replacement_requests q join s48_requests s using(id)
 join public.venue_bookings original on original.id=q.original_booking_id
 join public.venue_bookings target on target.id=q.replacement_booking_id
 where s.n in(1,2,15,16) and q.status='approved' and q.decided_by=pg_temp.s48_id(1,3)
 and original.status='cancelled' and target.status='confirmed'
 and target.space_layout=original.space_layout and target.space_attendance=original.space_attendance
 and not exists(select 1 from public.venue_slot_claims where booking_id=original.id)
 and (select count(*)=7 from public.venue_slot_claims where booking_id=target.id))
 and not exists(select 1 from s48_events_before old join public.events e using(id) where to_jsonb(old)<>to_jsonb(e))
 and not exists((select * from public.safety_review_decisions except select * from s48_safety_before)
 union all(select * from s48_safety_before except select * from public.safety_review_decisions)),
 'AC-048.6.11: blocked/retired approval in both stages atomically releases originals and reserves buffered targets without event changes');
select pg_temp.s48_assert(not exists(select 1 from public.venue_booking_flags f
 where booking_id in(select pg_temp.s48_id(4,n) from unnest(array[1,2,15,16])n)
 and cause in('venue_blocked','venue_retired') and
 (status<>'resolved' or resolved_by is distinct from pg_temp.s48_id(1,3) or replacement_booking_id is null))
 and (select count(*)=4 from public.venue_booking_flags where booking_id in
 (select pg_temp.s48_id(4,n) from unnest(array[1,2,15,16])n) and cause='venue_details_changed' and status='open')
 and (select count(*)=4 from public.arrangement_review_flags where venue_booking_id in
 (select pg_temp.s48_id(4,n) from unnest(array[1,2,15,16])n) and reason_code='venue_capacity' and status='open')
 and not exists(select 1 from public.arrangement_review_flags where venue_booking_id in
 (select pg_temp.s48_id(4,n) from unnest(array[2,16])n) and reason_code='venue_retired'
 and (status<>'resolved' or resolved_by is distinct from pg_temp.s48_id(1,3) or replacement_booking_id is null)),
 'AC-048.6.12: only blocked/retired reasons resolve with authenticated staff/replacement audit; independent reasons stay open');
-- Reject and withdraw remain non-destructive in both stages.
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
set role authenticated;
select public.decide_venue_replacement(id,version,'rejected','Not suitable') from s48_requests where n in(3,17);
reset role;
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,2)::text,false);
set role authenticated;
select public.decide_venue_replacement(id,version,'withdrawn','Withdraw proposal') from s48_requests where n in(4,18);
reset role;
select pg_temp.s48_assert((select count(*)=4 from public.venue_bookings where id in
 (select pg_temp.s48_id(4,n) from unnest(array[3,4,17,18])n) and status='confirmed')
 and (select count(*)=4 from public.venue_booking_flags where booking_id in
 (select pg_temp.s48_id(4,n) from unnest(array[3,4,17,18])n) and status='open' and replacement_booking_id is null),
 'AC-048.5.3: rejected/withdrawn requests retain originals and open Needs replacement reasons in both safety stages');
-- Target closure covers only setup, never the event itself.
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
select public.block_venue(pg_temp.s48_id(2,3),date '2049-01-01'+n*2,date '2049-01-01'+n*2,
 array['T0945'],'Target setup blocked') from unnest(array[5,19])n;
create temp table s48_before_failure as select pg_temp.s48_snapshot() value;
update s48_requests set version=public.venue_replacement_version(id) where n in(5,19);
grant select on s48_requests to authenticated;
set role authenticated;
select pg_temp.s48_assert(pg_temp.s48_refused(format('select public.decide_venue_replacement(%L,%L,%L,%L)',
 id,version,'approved','Blocked target'),'23514'),
 'AC-048.6.13: setup-only block refuses approval in each safety stage') from s48_requests where n in(5,19);
reset role;
select pg_temp.s48_assert((select value=pg_temp.s48_snapshot() from s48_before_failure),
 'AC-048.6.14: failed safety-stage approval preserves exact events, claims, reviews, requests and safety history');
-- Changing the event invalidates both displayed consent and the underlying proposal source.
select set_config('request.jwt.claim.sub','',false);
update public.events set expected_attendance=51 where id in(select pg_temp.s48_id(3,n) from unnest(array[7,21])n);
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
do $$ declare r record; begin for r in select * from s48_requests where n in(7,21) loop
 perform pg_temp.s48_assert(pg_temp.s48_refused(format('select public.decide_venue_replacement(%L,%L,%L,%L)',
 r.id,r.version,'approved','Old consent'),'40001') and pg_temp.s48_refused(format(
 'select public.decide_venue_replacement(%L,%L,%L,%L)',r.id,public.venue_replacement_version(r.id),'approved','Reloaded consent'),'40001'),
 'AC-048.3.11: stale event/proposal source cannot be bypassed by refreshing only the decision version');
end loop; end $$;
-- A fresh ordinary booking still cannot be approved in either stage.
create temp table s48_ordinary as select n,public.venue_booking_review_version(pg_temp.s48_id(4,n)) version from unnest(array[9,23])n;
grant select on s48_ordinary to authenticated;
set role authenticated;
select pg_temp.s48_assert(pg_temp.s48_refused(format('select public.approve_venue_booking(%L,%L)',
 pg_temp.s48_id(4,n),version),'22023'),
 'AC-048.3.12: added approval access is restricted to linked replacements, not ordinary safety-stage bookings') from s48_ordinary;
reset role;
-- Force a late failure in review resolution, after target approval has run.
create function pg_temp.s48_break_resolution() returns trigger language plpgsql as $$
begin if new.booking_id in(pg_temp.s48_id(4,14),pg_temp.s48_id(4,28)) and new.status='resolved' then
 raise exception 'Forced US48 resolution failure' using errcode='P0001'; end if; return new; end $$;
create trigger s48_break_resolution before update on public.venue_booking_flags
for each row execute function pg_temp.s48_break_resolution();
update s48_before_failure set value=pg_temp.s48_snapshot();
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,3)::text,false);
set role authenticated;
select pg_temp.s48_assert(pg_temp.s48_refused(format('select public.decide_venue_replacement(%L,%L,%L,%L)',
 id,version,'approved','Force final rollback'),'P0001'),
 'AC-048.6.18: a late resolution failure rolls back an approved target in both safety stages') from s48_requests where n in(14,28);
reset role;
select pg_temp.s48_assert((select value=pg_temp.s48_snapshot() from s48_before_failure),
 'AC-048.6.19: late rollback retains exact originals, claims, reviews and history with no replacement side effects');
drop trigger s48_break_resolution on public.venue_booking_flags;
-- Out-of-scope stages must still refuse proposals even with freshly read consent.
select set_config('request.jwt.claim.sub',pg_temp.s48_id(1,2)::text,false);
do $$ declare n integer; begin for n in 29..31 loop
 perform pg_temp.s48_assert(pg_temp.s48_refused(format('select public.propose_venue_replacement(%L,%L,%L,%L)',
 pg_temp.s48_id(4,n),pg_temp.s48_id(2,3),public.venue_replacement_source_version(pg_temp.s48_id(4,n)),'Excluded stage'),'22023'),
 'AC-048.3.14: Safety changes requested and terminal stages do not gain replacement permission');
end loop; end $$;
-- Preserve populated data and consent when 0116 is replayed by the runner.
create temp table s48_before_replay as select pg_temp.s48_snapshot() value,
 (select jsonb_object_agg(id,public.venue_replacement_version(id)) from public.venue_replacement_requests) versions;
select set_config('request.jwt.claim.sub','',false);
