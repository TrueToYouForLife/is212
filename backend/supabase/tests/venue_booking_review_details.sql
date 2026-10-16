-- US10 Slice 2. Uses the isolated fixtures from venue_booking_review.sql.
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.events set name='Review conference', proposed_start='2032-10-12T13:00:00+08:00',
 proposed_end='2032-10-12T16:00:00+08:00', expected_attendance=120,
 layout_preference='Theatre', accessibility_requirements='Step-free access'
 where id='b10a0000-0000-0000-0000-000000000102';
insert into public.event_venue_requirements(event_id,facilities,accessibility,updated_by)
 values('b10a0000-0000-0000-0000-000000000102',array['projector'],array['wheelchair_access'],
 'b10a0000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(
 public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'details'
 @> '{"eventName":"Review conference","attendance":120,"layoutPreference":"Theatre","accessibilityNotes":"Step-free access","requirementsRecorded":true,"facilities":["projector"],"accessibility":["wheelchair_access"]}'
 and (public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')#>>'{details,startsAt}')::timestamptz='2032-10-12T13:00:00+08:00'::timestamptz
 and (public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')#>>'{details,endsAt}')::timestamptz='2032-10-12T16:00:00+08:00'::timestamptz,
 'AC-010.2.1: Venue Staff read the booked event timing and requirements');
do $$ begin
 begin
  perform public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000999');
  raise exception 'Missing booking was accepted';
 exception when no_data_found then null;
 end;
 raise notice 'PASS: AC-010.2.2: missing booking is unavailable';
end $$;
reset role;
do $$
declare role_name text; n integer:=3; refused boolean;
begin
 foreach role_name in array array['organiser','coordinator','coordinator_lead','operations_manager','tech_support','attendee',''] loop
  perform set_config('request.jwt.claim.sub','',false);
  if role_name<>'' then
   update public.profiles set role=role_name where id='b10a0000-0000-0000-0000-000000000002';
   perform set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000002',false);
  end if;
  execute 'set local role authenticated';
  refused:=false;
  begin perform public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202');
  exception when insufficient_privilege then refused:=true;
  end;
  execute 'reset role';
  perform pg_temp.assert_true(refused,format('AC-010.2.%s: %s cannot read privileged booking details',n,coalesce(nullif(role_name,''),'signed-out caller')));
  n:=n+1;
 end loop;
 perform set_config('request.jwt.claim.sub','',false);
 update public.profiles set role='organiser' where id='b10a0000-0000-0000-0000-000000000002';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000203')->'details'
 @> '{"requirementsRecorded":false,"attendance":null,"facilities":[]}',
 'AC-010.2.10: missing optional requirements remain explicit');
select pg_temp.assert_true(not exists(select 1 from public.events where id='b10a0000-0000-0000-0000-000000000102'),
 'AC-010.2.11: RPC does not grant direct access to unrelated event fields');
reset role;
