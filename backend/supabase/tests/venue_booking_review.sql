-- US10 / SCRUM-17, AC8: mandatory rejection reasons. Disposable runner only.
-- .9-.12 avoid the existing tentative-hold story's AC-010.8.4-.8 allocations.
-- No new RPC or production stub: exercise the existing Venue Staff UPDATE policy.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, email, raw_user_meta_data) values
 ('b10a0000-0000-0000-0000-000000000001', 'review10@example.test', '{"full_name":"US10 Venue Staff"}'),
 ('b10a0000-0000-0000-0000-000000000002', 'owner10@example.test', '{"full_name":"US10 Organiser"}');
-- Self sign-up creates Attendees since US29 (0042), so organisers are assigned like other roles.
update public.profiles set role='organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001'
 where id='b10a0000-0000-0000-0000-000000000002';
update public.profiles set role='venue_staff'
 where id='b10a0000-0000-0000-0000-000000000001';
insert into public.venues (id,name,location,capacity,layout,status) values
 ('b10a0000-0000-0000-0000-000000000003','US10 Review Hall','Test',100,'Theatre','active');
insert into public.events (id,organiser_id,status)
select ('b10a0000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 'b10a0000-0000-0000-0000-000000000002','draft' from generate_series(101,110) n;
insert into public.venue_bookings (id,event_id,venue_id,requested_by,status)
select ('b10a0000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 ('b10a0000-0000-0000-0000-' || lpad((n-100)::text,12,'0'))::uuid,
 'b10a0000-0000-0000-0000-000000000003',
 'b10a0000-0000-0000-0000-000000000002','pending_approval'
from generate_series(201,210) n;

-- AC10 fixtures: event/setup/turnaround cells plus an unrelated pending booking.
insert into public.venue_slot_claims (venue_id,slot_date,slot,kind,booking_id) values
 ('b10a0000-0000-0000-0000-000000000003','2030-10-12','AM','buffer','b10a0000-0000-0000-0000-000000000204'),
 ('b10a0000-0000-0000-0000-000000000003','2030-10-12','PM','event','b10a0000-0000-0000-0000-000000000204'),
 ('b10a0000-0000-0000-0000-000000000003','2030-10-12','NIGHT','buffer','b10a0000-0000-0000-0000-000000000204'),
 ('b10a0000-0000-0000-0000-000000000003','2030-10-13','PM','event','b10a0000-0000-0000-0000-000000000201');

create temp table us10_results (label text, passed boolean);
grant insert, select on us10_results to authenticated;
create function pg_temp.check_rejection(booking_id uuid, reason text, should_refuse boolean, label text)
returns void language plpgsql as $$
declare
  refused boolean := false;
  changed integer;
  passed boolean;
begin
  begin
    update public.venue_bookings set status='rejected', review_note=reason,
      reviewed_by=auth.uid(), reviewed_at=now() where id=booking_id;
    get diagnostics changed = row_count;
    if changed <> 1 then
      raise exception 'Fixture/access failure: expected one visible pending booking, got %', changed;
    end if;
  exception when check_violation or invalid_parameter_value then
    refused := true;
  end;
  if should_refuse then
    passed := refused and exists(select 1 from public.venue_bookings
      where id=booking_id and status='pending_approval' and review_note is null);
  else
    passed := not refused and exists(select 1 from public.venue_bookings
      where id=booking_id and status='rejected' and review_note=reason);
  end if;
  insert into us10_results values(label,passed);
  raise notice '%: %', case when passed then 'PASS' else 'FAIL' end, label;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000201',null,true,
 'AC-010.8.9: missing rejection reason is refused and request remains pending');
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000202','',true,
 'AC-010.8.10: empty rejection reason is refused and request remains pending');
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000203',E' \t\n ',true,
 'AC-010.8.11: whitespace-only rejection reason is refused and request remains pending');
select pg_temp.check_rejection('b10a0000-0000-0000-0000-000000000204','Venue unsuitable',false,
 'AC-010.8.12: Venue Staff can reject with a recorded nonblank reason');
reset role;
insert into us10_results
select 'AC-010.10.2: rejection releases its event and buffer slots only',
 not exists(select 1 from public.venue_slot_claims
   where booking_id='b10a0000-0000-0000-0000-000000000204')
 and exists(select 1 from public.venue_slot_claims
   where booking_id='b10a0000-0000-0000-0000-000000000201'
     and slot_date='2030-10-13' and slot='PM' and kind='event');
-- AC13: the browser must not be the authority for the decision timestamp.
create temp table us10_decision_window as select clock_timestamp() as started_at;
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
do $$
declare changed integer;
begin
 update public.venue_bookings
 set status='rejected', review_note='Venue unsuitable',
   reviewed_by=auth.uid(), reviewed_at='2000-01-01T00:00:00Z'
 where id='b10a0000-0000-0000-0000-000000000205';
 get diagnostics changed = row_count;
 if changed <> 1 then
   raise exception 'Fixture/access failure: expected one pending booking, got %', changed;
 end if;
end $$;
reset role;
insert into us10_results
select 'AC-010.13.2: rejection records server time instead of a client-supplied timestamp',
 exists(select 1 from public.venue_bookings b cross join us10_decision_window w
   where b.id='b10a0000-0000-0000-0000-000000000205'
     and b.status='rejected' and b.review_note='Venue unsuitable'
     and b.reviewed_by='b10a0000-0000-0000-0000-000000000001'
     and b.reviewed_at between w.started_at and clock_timestamp());

-- AC9 schema contract: a suggested alternative must survive the booking row model.
-- jsonb_populate_record ignores unknown keys, so this is an assertion failure on
-- the old schema, not an undefined-column exception that stops the other tests.
insert into us10_results
select 'AC-010.9.1: booking decision model retains an optional suggested alternative',
 coalesce(to_jsonb(jsonb_populate_record(null::public.venue_bookings,
   '{"review_alternative":"Try the smaller hall on Friday"}'::jsonb))
   ->>'review_alternative' = 'Try the smaller hall on Friday', false);

-- Existing RLS already makes final decisions immutable to Venue Staff.
update public.venue_bookings set status='confirmed', reviewed_by='b10a0000-0000-0000-0000-000000000001',
 reviewed_at=now() where id='b10a0000-0000-0000-0000-000000000206';
set role authenticated;
do $$
declare changed integer;
begin
 update public.venue_bookings set status='rejected', review_note='Second decision'
 where id='b10a0000-0000-0000-0000-000000000206';
 get diagnostics changed = row_count;
 insert into us10_results values('AC-010.12.3: Venue Staff cannot reject a confirmed booking',changed=0);
 update public.venue_bookings set status='confirmed'
 where id='b10a0000-0000-0000-0000-000000000204';
 get diagnostics changed = row_count;
 insert into us10_results values('AC-010.12.4: Venue Staff cannot change a rejected booking',changed=0);
end $$;
update public.venue_bookings set status='rejected', review_note='Unavailable',
 reviewed_by='b10a0000-0000-0000-0000-000000000002'
 where id='b10a0000-0000-0000-0000-000000000207';
reset role;
insert into us10_results
select 'AC-010.13.3: spoofed reviewer is replaced by the authenticated Venue Staff identity',
 exists(select 1 from public.venue_bookings where id='b10a0000-0000-0000-0000-000000000207'
   and status='rejected' and reviewed_by='b10a0000-0000-0000-0000-000000000001');

-- Inject a cleanup failure; a partially saved rejection must never escape.
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('b10a0000-0000-0000-0000-000000000003','2030-10-14','AM','event','b10a0000-0000-0000-0000-000000000208');
create function pg_temp.refuse_test_release() returns trigger language plpgsql as $$
begin
 if old.booking_id='b10a0000-0000-0000-0000-000000000208' then
   raise exception 'Injected cleanup failure' using errcode='P1010';
 end if;
 return old;
end $$;
create trigger us10_test_cleanup_failure before delete on public.venue_slot_claims
 for each row execute function pg_temp.refuse_test_release();
set role authenticated;
do $$
declare refused boolean := false;
begin
 begin
   update public.venue_bookings set status='rejected',review_note='Unavailable'
   where id='b10a0000-0000-0000-0000-000000000208';
 exception when sqlstate 'P1010' then refused := true;
 end;
 insert into us10_results
 select 'AC-010.10.3: failed slot cleanup rolls back the decision and preserves its claim',
 refused and exists(select 1 from public.venue_bookings
   where id='b10a0000-0000-0000-0000-000000000208' and status='pending_approval'
     and reviewed_by is null and reviewed_at is null and review_note is null)
 and exists(select 1 from public.venue_slot_claims
   where booking_id='b10a0000-0000-0000-0000-000000000208');
end $$;
reset role;
drop trigger us10_test_cleanup_failure on public.venue_slot_claims;

set role authenticated;
update public.venue_bookings set status='rejected',review_note='Unavailable',
 review_alternative='Try the smaller hall on Friday'
 where id='b10a0000-0000-0000-0000-000000000209';
reset role;
insert into us10_results
select 'AC-010.9.2: alternative persists with rejection and may also be omitted',
 exists(select 1 from public.venue_bookings where id='b10a0000-0000-0000-0000-000000000209'
   and status='rejected' and review_alternative='Try the smaller hall on Friday')
 and exists(select 1 from public.venue_bookings where id='b10a0000-0000-0000-0000-000000000204'
   and status='rejected' and review_alternative is null);

-- A released booking cell covered by maintenance stays unavailable.
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('b10a0000-0000-0000-0000-000000000003','2030-10-15','AM','buffer','b10a0000-0000-0000-0000-000000000210');
set role authenticated;
select public.block_venue('b10a0000-0000-0000-0000-000000000003','2030-10-15','2030-10-15',array['AM'],'Maintenance');
update public.venue_bookings set status='rejected', review_note='Maintenance'
 where id='b10a0000-0000-0000-0000-000000000210';
reset role;
insert into us10_results
select 'AC-010.10.4: rejection preserves a covering maintenance block',
 not exists(select 1 from public.venue_slot_claims where booking_id='b10a0000-0000-0000-0000-000000000210')
 and exists(select 1 from public.venue_slot_claims
   where venue_id='b10a0000-0000-0000-0000-000000000003' and slot_date='2030-10-15' and slot='AM'
     and kind='maintenance' and closure_id is not null);

-- Exercise each real role against RLS, not a service mock. Roll back every trial
-- even on an unexpected success so later cases still see the same pending row.
do $$
declare
 role_name text;
 case_number integer := 3;
 changed integer;
 denied boolean;
begin
 foreach role_name in array array['organiser','coordinator','coordinator_lead',
   'operations_manager','tech_support','attendee',''] loop
   perform set_config('request.jwt.claim.sub','',false);
   if role_name <> '' then
     update public.profiles set role=role_name where id='b10a0000-0000-0000-0000-000000000002';
     perform set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000002',false);
   end if;
   execute 'set local role authenticated';
   changed := 0;
   denied := false;
   begin
     update public.venue_bookings set status='rejected',review_note='Unauthorised rejection'
     where id='b10a0000-0000-0000-0000-000000000208';
     get diagnostics changed = row_count;
     raise exception 'Rollback role trial' using errcode='P1040';
   exception
     when insufficient_privilege then denied := true;
     when sqlstate 'P1040' then null;
   end;
   execute 'reset role';
   insert into us10_results
   select format('AC-010.4.%s: %s cannot reject a pending booking',case_number,
     coalesce(nullif(role_name,''),'signed-out caller')),
     (denied or changed=0) and exists(select 1 from public.venue_bookings
       where id='b10a0000-0000-0000-0000-000000000208' and status='pending_approval');
   case_number := case_number + 1;
 end loop;
 perform set_config('request.jwt.claim.sub','',false);
 update public.profiles set role='organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id='b10a0000-0000-0000-0000-000000000002';
end $$;

select label, case when passed then 'PASS' else 'FAIL' end as result from us10_results;
select count(*) as total, count(*) filter(where passed) as passed,
 count(*) filter(where not passed) as failed from us10_results;
do $$ begin
 if exists(select 1 from us10_results where not passed) then
   raise exception 'US10 review assertions failed: inspect the case results above';
 end if;
end $$;
