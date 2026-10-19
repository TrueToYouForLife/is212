-- US10 Slice 3: real database approval checks, isolated fixtures.
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.venues(id,name,location,capacity,layout,status)
values('b10c0000-0000-0000-0000-000000000001','Approval Hall','Test',200,'Theatre','active');
insert into public.events(id,organiser_id,coordinator_id,purpose,name,reference,proposed_start,proposed_end,expected_attendance,status)
select ('b10c0000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'b10a0000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 'Approval fixture','Approval event '||n,'EVT-APP-'||n,
 '2042-10-12T13:00:00+08'::timestamptz+(n-101)*interval '2 days',
 '2042-10-12T16:00:00+08'::timestamptz+(n-101)*interval '2 days',50,'approved'
from generate_series(101,112) n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
select ('b10c0000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('b10c0000-0000-0000-0000-'||lpad((n-100)::text,12,'0'))::uuid,
 'b10c0000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','pending_approval'
from generate_series(201,212) n;
create temp table approval_versions as select id,public.venue_booking_review_version(id) version
 from public.venue_bookings where id::text like 'b10c%';
grant select on approval_versions to authenticated;
create temp table approval_events_before as select * from public.events where id::text like 'b10c%';
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(public.approve_venue_booking('b10c0000-0000-0000-0000-000000000201',
 (select version from approval_versions where id='b10c0000-0000-0000-0000-000000000201'))='b10c0000-0000-0000-0000-000000000201',
 'AC-010.5.14: unchanged pending booking is approved');
select pg_temp.assert_true((select status='confirmed' from public.venue_bookings where id='b10c0000-0000-0000-0000-000000000201'),
 'AC-010.5.15: successful approval persists confirmed status');
select pg_temp.assert_true((select reviewed_by=auth.uid() and reviewed_at between now()-interval '1 minute' and clock_timestamp()
 from public.venue_bookings where id='b10c0000-0000-0000-0000-000000000201'),
 'AC-010.13.6: approval stamps authenticated reviewer and server time');
select pg_temp.assert_true((select count(*)=3 and count(*) filter(where kind='buffer')=2
 from public.venue_slot_claims where booking_id='b10c0000-0000-0000-0000-000000000201'),
 'AC-010.7.2: approval owns event and both buffer slots');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000201',(select version from approval_versions where id='b10c0000-0000-0000-0000-000000000201'))$q$,'40001','AC-010.12.18: repeating the approved decision is refused');
select pg_temp.expect_error($q$update public.venue_bookings set status='confirmed', reviewed_by=auth.uid() where id='b10c0000-0000-0000-0000-000000000202'$q$,'42501','AC-010.4.18: staff cannot bypass atomic approval with a direct update');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000202',NULL)$q$,'40001','AC-010.11.1: missing review version is refused');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$delete from public.venue_slot_claims where booking_id='b10c0000-0000-0000-0000-000000000201'$q$,'23514','AC-010.7.3: requester cannot release approved slots');
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.assert_true(not exists((select * from public.events where id::text like 'b10c%') except select * from approval_events_before),'AC-010.11.2: approval leaves all event fields unchanged');
update public.events set expected_attendance=51 where id='b10c0000-0000-0000-0000-000000000102';
set role authenticated; select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000202',(select version from approval_versions where id='b10c0000-0000-0000-0000-000000000202'))$q$,'40001','AC-010.11.3: changed request details require reload');
select public.block_venue('b10c0000-0000-0000-0000-000000000001','2042-10-16','2042-10-16',array['AM'],'Setup blocked after read');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000203',(select version from approval_versions where id='b10c0000-0000-0000-0000-000000000203'))$q$,'23514','AC-010.6.12: a block arriving after review prevents approval');
select pg_temp.assert_true((select status='pending_approval' and reviewed_at is null from public.venue_bookings where id='b10c0000-0000-0000-0000-000000000203'),'AC-010.6.13: refused approval leaves the decision pending');
reset role; select set_config('request.jwt.claim.sub','',false);
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values('b10c0000-0000-0000-0000-000000000001','2042-10-18','PM','event','b10c0000-0000-0000-0000-000000000201');
set role authenticated; select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000204',(select version from approval_versions where id='b10c0000-0000-0000-0000-000000000204'))$q$,'23505','AC-010.6.14: another bookings occupied slot prevents approval');
select pg_temp.assert_true(not exists(select 1 from public.venue_slot_claims where booking_id='b10c0000-0000-0000-0000-000000000204'),'AC-010.6.15: conflicting insert rolls back newly claimed buffers');
reset role; select set_config('request.jwt.claim.sub','',false);
do $$ declare role_name text; n integer:=19; refused boolean; begin
 foreach role_name in array array['organiser','coordinator','coordinator_lead','operations_manager','tech_support','attendee',''] loop
  perform set_config('request.jwt.claim.sub','',false);
  if role_name<>'' then update public.profiles set role=role_name where id='b10a0000-0000-0000-0000-000000000002'; end if;
  perform set_config('request.jwt.claim.sub',case when role_name='' then '' else 'b10a0000-0000-0000-0000-000000000002' end,false);
  execute 'set local role authenticated';
  refused:=false;
  begin perform public.approve_venue_booking('b10c0000-0000-0000-0000-000000000202','ignored');
  exception when insufficient_privilege then refused:=true; end;
  execute 'reset role';
  perform pg_temp.assert_true(refused,format('AC-010.4.%s: %s cannot approve',n,coalesce(nullif(role_name,''),'signed-out caller')));
  n:=n+1;
 end loop;
 perform set_config('request.jwt.claim.sub','',false);
 update public.profiles set role='organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id='b10a0000-0000-0000-0000-000000000002';
end $$;

-- Requirement edits and missing requests cannot silently approve a stale view.
insert into public.event_venue_requirements(event_id,facilities,accessibility,updated_by)
values('b10c0000-0000-0000-0000-000000000105',array['projector'],'{}','b10a0000-0000-0000-0000-000000000001');
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000205',
 (select version from approval_versions where id='b10c0000-0000-0000-0000-000000000205'))$q$,'40001',
 'AC-010.11.7: requirements added after viewing invalidate approval');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000999','missing')$q$,'P0002',
 'AC-010.5.18: missing booking is unavailable');
-- Readback version must match the same request used by approval.
select pg_temp.assert_true(public.approve_venue_booking('b10c0000-0000-0000-0000-000000000205',
 public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000205')->>'reviewVersion')='b10c0000-0000-0000-0000-000000000205',
 'AC-010.11.8: reload supplies a usable version for the changed requirements');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000201',
 public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000201')->>'reviewVersion')$q$,'22023',
 'AC-010.12.25: even a fresh version cannot approve a final booking twice');
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
select 'b10c0000-0000-0000-0000-000000000001',slot_date,slot,kind,'b10c0000-0000-0000-0000-000000000206'
from public.venue_review_cells('2042-10-22T13:00:00+08','2042-10-22T16:00:00+08');
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000206',
 public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000206')->>'reviewVersion');
select pg_temp.assert_true((select count(*)=3 from public.venue_slot_claims where booking_id='b10c0000-0000-0000-0000-000000000206'),
 'AC-010.7.5: existing pending claims are retained without duplicate inserts');
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id)
values('b10c0000-0000-0000-0000-000000000001','2042-10-25','AM','event','b10c0000-0000-0000-0000-000000000207');
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000207',
 public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000207')->>'reviewVersion')$q$,'40001',
 'AC-010.11.9: mismatching claimed cells require resubmission instead of silent amendment');
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.venues set status='retired' where id='b10c0000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.as_user('b10a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000208',
 public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000208')->>'reviewVersion')$q$,'22023',
 'AC-010.6.18: a venue retired after review cannot be approved');
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.venues set status='active' where id='b10c0000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub','',false);
create temp table approval_bookings_before_replay as select * from public.venue_bookings;
create temp table approval_claims_before_replay as select * from public.venue_slot_claims;
