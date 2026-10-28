-- Code-first US24 PostgreSQL integration cases; simulated Auth, real grants/transactions.
-- Roll back mutations so the separate race sessions begin from the same fixture.
begin;
reset role;
create function pg_temp.us24_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.us24_refused(command text,expected text) returns boolean language plpgsql as $$
begin execute command; return false; exception when others then
 if sqlstate=expected then return true; end if; raise; end $$;
create function pg_temp.us24_snapshot() returns jsonb language sql as $$
 select jsonb_build_array(
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_defect_reports t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_return_inspections t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_status_changes t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_notifications t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.notification_outbox t)); $$;
create temp table us24_original_allocations as select to_jsonb(a)-'inspection_version' value from public.equipment_allocations a;
create temp table us24_original_events as select * from public.events;
create temp table us24_original_locations as select id,home_venue_id,current_venue_id from public.equipment_items;
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us24_id(1,1)::text,false);
select public.get_equipment_return_inspections() as queue \gset
select pg_temp.us24_assert(
 (:'queue'::jsonb->'out') @> jsonb_build_array(jsonb_build_object('allocationId',pg_temp.us24_id(8,3)))
 and not ((:'queue'::jsonb->'pendingChecks') @> jsonb_build_array(jsonb_build_object('allocationId',pg_temp.us24_id(8,3))))
 and (:'queue'::jsonb->'pendingChecks') @> jsonb_build_array(jsonb_build_object('allocationId',pg_temp.us24_id(8,1)))
 and not ((:'queue'::jsonb->'out') @> jsonb_build_array(jsonb_build_object('allocationId',pg_temp.us24_id(8,4))))
 and not ((:'queue'::jsonb->'pendingChecks') @> jsonb_build_array(jsonb_build_object('allocationId',pg_temp.us24_id(8,5))))
 and (select asset->>'assetTag'='US24-2' from jsonb_array_elements(:'queue'::jsonb->'pendingChecks') asset
  where asset->>'allocationId'=pg_temp.us24_id(8,9)::text),
 'AC-024.1.1: saved Singapore collection/return dates classify out and pending; future/cancelled excluded; actual allocated asset shown');
reset role;
select public.equipment_return_version(pg_temp.us24_id(8,1)) as first_version \gset
set role authenticated;
select public.inspect_equipment_return(pg_temp.us24_id(8,1),:'first_version','good') as good_receipt \gset
select pg_temp.us24_assert((:'good_receipt'::jsonb->>'statusChanged')::boolean=false
 and not exists(select 1 from public.equipment_return_inspections where allocation_id=pg_temp.us24_id(8,1) and defect_report_id is not null)
 and not exists(select 1 from jsonb_array_elements(public.get_equipment_return_inspections()->'pendingChecks') a
  where a->>'allocationId'=pg_temp.us24_id(8,1)::text)
 and exists(select 1 from public.equipment_return_inspections where allocation_id=pg_temp.us24_id(8,1)
  and inspected_by=auth.uid() and inspected_by_name='US24 Staff 1' and inspected_at is not null),
 'AC-024.1.2: no-issue inspection records real staff/time, leaves status unchanged and completes only that allocation');
select pg_temp.us24_assert(pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''good'')',
 pg_temp.us24_id(8,1),:'first_version'),'40001'),
 'AC-024.1.3: stale duplicate save is refused rather than creating another inspection');
reset role;
select public.equipment_return_version(pg_temp.us24_id(8,2)) as damage_version \gset
create temp table us24_before_invalid as select pg_temp.us24_snapshot() value;
set role authenticated;
select pg_temp.us24_assert(pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''damage'',''  '',''needs_repair'')',pg_temp.us24_id(8,2),:'damage_version'),'22023')
 and pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''good'',null,''needs_repair'')',pg_temp.us24_id(8,2),:'damage_version'),'22023')
 and pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''missing'',''Not found'',''operational'')',pg_temp.us24_id(8,2),:'damage_version'),'22023')
 and pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''unsupported'')',pg_temp.us24_id(8,2),:'damage_version'),'22023')
 and pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''damage'',''Crack'',''retired'')',pg_temp.us24_id(8,2),:'damage_version'),'22023')
 and pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''good'')',pg_temp.us24_id(8,3),:'damage_version'),'40001')
 and pg_temp.us24_refused('select public.inspect_equipment_return(''00000000-0000-0000-0000-000000000000'',''x'',''good'')','22023'),
 'AC-024.1.4: blank issues, invalid findings/status, wrong allocation version and unknown allocations refuse');
reset role;
select pg_temp.us24_assert((select value=pg_temp.us24_snapshot() from us24_before_invalid),
 'AC-024.1.4: rejected input preserves exact data snapshots');
select public.equipment_return_version(pg_temp.us24_id(8,3)) as today_version \gset
set role authenticated;
select pg_temp.us24_assert(pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''good'')',
 pg_temp.us24_id(8,3),:'today_version'),'22023'),
 'AC-024.1.5: return day remains Out through its Singapore end; inspection starts the following day');
select public.inspect_equipment_return(pg_temp.us24_id(8,2),:'damage_version','damage','  Cracked lens  ','needs_repair') as damaged \gset
select pg_temp.us24_assert((:'damaged'::jsonb->>'statusChanged')::boolean
 and exists(select 1 from public.equipment_return_inspections h join public.equipment_defect_reports d on d.id=h.defect_report_id
  join public.equipment_status_changes s on s.id=h.status_change_id where h.allocation_id=pg_temp.us24_id(8,2)
  and d.allocation_id=h.allocation_id and d.item_id=pg_temp.us24_id(4,2) and d.description='Cracked lens'
  and d.kind='damage' and d.reported_by=auth.uid() and s.note=d.description and h.resulting_status='needs_repair'),
 'AC-024.2.1: damage is linked to the actual allocation/unit and the reused US27 authenticated status audit');
reset role;
select pg_temp.us24_assert(not exists(select 1 from public.equipment_free_units(pg_temp.us24_id(3,2),pg_temp.us24_id(5,4),current_date+100,current_date+101,null)),
 'AC-024.3.1: damaged unit is immediately excluded even for a free future reservation window');
set role authenticated;
select pg_temp.us24_assert(pg_temp.us24_refused(format('select public.reserve_equipment(%L,1)',pg_temp.us24_id(9,1)),'23P01'),
 'AC-024.3.1: the real reservation operation refuses damaged equipment');
reset role;
select pg_temp.us24_assert(exists(select 1 from public.arrangement_review_flags where equipment_booking_id=pg_temp.us24_id(6,12)
 and reason_code='equipment_non_operational' and status='open')
 and exists(select 1 from public.arrangement_review_flags where id=pg_temp.us24_id(12,1)
  and status='open' and detail='Independent requirement review')
 and (select count(*)=1 from public.arrangement_review_notifications n join public.arrangement_review_flags f on f.id=n.flag_id
 where f.equipment_booking_id=pg_temp.us24_id(6,12) and n.recipient_id=pg_temp.us24_id(1,4)),
 'AC-024.3.2: reused US27 handling retains and flags the upcoming reservation and notifies its assigned Coordinator');
-- A later inspection of another allocation for the same unit uses a fresh unit version.
select public.equipment_return_version(pg_temp.us24_id(8,9)) as other_allocation_version \gset
select public.equipment_return_version(pg_temp.us24_id(8,7)) as already_damaged_version \gset
select public.equipment_return_version(pg_temp.us24_id(8,8)) as legacy_version \gset
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us24_id(1,2)::text,false);
select public.inspect_equipment_return(pg_temp.us24_id(8,9),:'other_allocation_version','defect','Loose connector','needs_repair');
select public.inspect_equipment_return(pg_temp.us24_id(8,7),:'already_damaged_version','good');
select public.inspect_equipment_return(pg_temp.us24_id(8,8),:'legacy_version','good');
select pg_temp.us24_assert((select count(*)=2 from public.equipment_defect_reports where item_id=pg_temp.us24_id(4,2))
 and (select count(*)=1 from public.equipment_status_changes where item_id=pg_temp.us24_id(4,2))
 and exists(select 1 from public.equipment_return_inspections where allocation_id=pg_temp.us24_id(8,7) and resulting_status='needs_repair')
 and exists(select 1 from public.equipment_return_inspections where allocation_id=pg_temp.us24_id(8,8) and resulting_status='retired'),
 'AC-024.2.2: separate allocation findings survive unchanged status; no-issue does not repair damaged or rewrite legacy units');
reset role;
select public.equipment_return_version(pg_temp.us24_id(8,6)) as missing_version \gset
set role authenticated;
select public.inspect_equipment_return(pg_temp.us24_id(8,6),:'missing_version','missing','Not in the returned case') as missing_receipt \gset
select pg_temp.us24_assert((:'missing_receipt'::jsonb->>'resolved')::boolean=false
 and exists(select 1 from jsonb_array_elements(public.get_equipment_return_inspections()->'pendingChecks') a
  where a->>'allocationId'=pg_temp.us24_id(8,6)::text and a->>'lastFinding'='missing'),
 'AC-024.1.6: missing remains unresolved in Pending checks and its report is retained in history');
reset role;
select public.equipment_return_version(pg_temp.us24_id(8,6)) as found_version \gset
select pg_temp.us24_assert((select operational_status='unavailable' from public.equipment_items where id=pg_temp.us24_id(4,6)),
 'AC-024.3.3: missing equipment becomes Unavailable');
set role authenticated;
select public.inspect_equipment_return(pg_temp.us24_id(8,6),:'found_version','good','Located and inspected; no damage','operational');
select pg_temp.us24_assert((select count(*)=2 from public.equipment_return_inspections where allocation_id=pg_temp.us24_id(8,6))
 and not exists(select 1 from jsonb_array_elements(public.get_equipment_return_inspections()->'pendingChecks') a
  where a->>'allocationId'=pg_temp.us24_id(8,6)::text),
 'AC-024.1.6: explicit follow-up resolves a missing inspection without deleting its earlier history');
reset role;
select pg_temp.us24_assert(not exists(
 (select to_jsonb(a)-'inspection_version' from public.equipment_allocations a except select value from us24_original_allocations)
 union all(select value from us24_original_allocations except select to_jsonb(a)-'inspection_version' from public.equipment_allocations a))
 and not exists((select * from public.events except select * from us24_original_events)
 union all(select * from us24_original_events except select * from public.events))
 and not exists((select id,home_venue_id,current_venue_id from public.equipment_items except select * from us24_original_locations)
 union all(select * from us24_original_locations except select id,home_venue_id,current_venue_id from public.equipment_items)),
 'AC-024.3.4: inspection does not rewrite events, allocations, saved windows, checkout/return timestamps or location');
select public.equipment_return_version(pg_temp.us24_id(8,13)) as maintenance_version \gset
select public.equipment_return_version(pg_temp.us24_id(8,5)) as cancelled_version \gset
select public.equipment_return_version(pg_temp.us24_id(8,1)) as closed_version \gset
set role authenticated;
select public.inspect_equipment_return(pg_temp.us24_id(8,13),:'maintenance_version','other','Moisture found','under_repair');
select pg_temp.us24_assert(exists(select 1 from public.equipment_return_inspections where allocation_id=pg_temp.us24_id(8,13)
 and resulting_status='under_repair' and finding='other'),
 'AC-024.2.4: Other findings can record Under Maintenance through the shared status operation');
select pg_temp.us24_assert(pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''good'')',
 pg_temp.us24_id(8,5),:'cancelled_version'),'22023')
 and pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''good'')',
 pg_temp.us24_id(8,1),:'closed_version'),'22023'),
 'AC-024.1.10: fresh versions do not permit inspecting cancelled allocations or reopening completed inspections');
reset role;
-- All roles, including the newly added Safety Officer, are checked at the database boundary.
set role authenticated;
do $$ declare n integer; begin
 for n in 3..9 loop
  perform set_config('request.jwt.claim.sub',pg_temp.us24_id(1,n)::text,false);
  if not pg_temp.us24_refused('select public.get_equipment_return_inspections()','42501')
   or not pg_temp.us24_refused('select public.inspect_equipment_return(null,null,''good'')','42501') then
   raise exception 'Other role admitted'; end if;
  if exists(select 1 from public.equipment_return_inspections) then raise exception 'Other role read internal history'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','',false);
 if not pg_temp.us24_refused('select public.get_equipment_return_inspections()','42501') then raise exception 'Signed out admitted'; end if;
end $$;
reset role;
select pg_temp.us24_assert(not has_function_privilege('anon','public.get_equipment_return_inspections()','execute')
 and not has_function_privilege('anon','public.inspect_equipment_return(uuid,text,text,text,text)','execute'),
 'AC-024.1.7: other roles and signed-out callers cannot read or write inspections; anonymous execution denied');
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.us24_id(1,1)::text,false);
select pg_temp.us24_assert(pg_temp.us24_refused('insert into public.equipment_return_inspections default values','42501')
 and pg_temp.us24_refused('delete from public.equipment_return_inspections','42501')
 and pg_temp.us24_refused('update public.equipment_defect_reports set description=''rewrite''','42501')
 and pg_temp.us24_refused('insert into public.equipment_defect_reports default values','42501')
 and pg_temp.us24_refused('select public.equipment_return_version(null)','42501'),
 'AC-024.1.8: browser writes cannot bypass the checked operation, rewrite audit or invoke the private version helper');
reset role;
-- Deliberate write failure is a rollback check, not a discovered product defect.
create temp table us24_before_failure as select pg_temp.us24_snapshot() value;
select public.equipment_return_version(pg_temp.us24_id(8,11)) as failure_version \gset
create function pg_temp.us24_fail_inspection() returns trigger language plpgsql as $$
begin raise exception 'Injected inspection failure' using errcode='P0099'; end $$;
create trigger us24_fail_inspection before insert on public.equipment_return_inspections
 for each row execute function pg_temp.us24_fail_inspection();
set role authenticated;
select pg_temp.us24_assert(pg_temp.us24_refused(format('select public.inspect_equipment_return(%L,%L,''other'',''Wet case'',''under_repair'')',
 pg_temp.us24_id(8,11),:'failure_version'),'P0099'),
 'AC-024.3.5: injected final inspection-write failure refuses the complete operation');
reset role;
select pg_temp.us24_assert((select value=pg_temp.us24_snapshot() from us24_before_failure),
 'AC-024.3.5: status, version, audit, report, allocation, reviews and notices all roll back');
drop trigger us24_fail_inspection on public.equipment_return_inspections;
rollback;
