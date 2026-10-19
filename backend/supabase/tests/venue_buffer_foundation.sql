-- US47 code-first foundation checks. Disposable database; fixtures roll back.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users(id,email) values
 ('47740000-0000-0000-0000-000000000001','us47-staff@example.test');
update public.profiles set role='venue_staff'
 where id='47740000-0000-0000-0000-000000000001';
insert into public.venues(id,name,location,capacity,layout) values
 ('47740000-0000-0000-0000-000000000002','US47 Foundation Hall','Test',100,'theatre');
select pg_temp.assert_true((select setup_minutes=0 and turnaround_minutes=0
 from public.venues where id='47740000-0000-0000-0000-000000000002'),
 'AC-047.4.1: a new venue defaults to zero setup and turnaround');

-- Each invalid update must fail for the expected constraint, not an unrelated error.
do $$
declare col text; val integer;
begin
 foreach col in array array['setup_minutes','turnaround_minutes'] loop
  foreach val in array array[-15,1,14,16] loop
   begin
    execute format('update public.venues set %I=$1 where id=$2',col)
      using val,'47740000-0000-0000-0000-000000000002'::uuid;
    raise exception 'Invalid duration accepted';
   exception when check_violation then null;
   end;
  end loop;
  begin
   execute format('update public.venues set %I=null where id=$1',col)
     using '47740000-0000-0000-0000-000000000002'::uuid;
   raise exception 'Null duration accepted';
  exception when not_null_violation then null;
  end;
 end loop;
end $$;
update public.venues set setup_minutes=30,turnaround_minutes=45
 where id='47740000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select setup_minutes=30 and turnaround_minutes=45
 from public.venues where id='47740000-0000-0000-0000-000000000002'),
 'AC-047.1.1: duration storage accepts independent multiples of 15 and rejects negative, fractional-slot and null values');

select pg_temp.assert_true(
 public.venue_occupied_period('2047-03-20 10:00+08','2047-03-20 12:00+08',30,45)
   = tstzrange('2047-03-20 09:30+08','2047-03-20 12:45+08','[)')
 and public.venue_occupied_period('2047-03-20 00:00+08','2047-03-20 23:45+08',15,30)
   = tstzrange('2047-03-19 23:45+08','2047-03-21 00:15+08','[)')
 and public.venue_occupied_period('2047-03-20 10:00+08','2047-03-20 12:00+08',0,0)
   = tstzrange('2047-03-20 10:00+08','2047-03-20 12:00+08','[)')
 and not (public.venue_occupied_period('2047-03-20 10:00+08','2047-03-20 12:00+08',30,45)
   && tstzrange('2047-03-20 12:45+08','2047-03-20 13:00+08','[)')),
 'AC-047.2.1: occupied-period helper covers customer example, zero buffers, cross-day bounds and adjacent periods');
do $$
declare args text;
begin
 foreach args in array array[
  'null,''2047-03-20 12:00+08'',0,0',
  '''2047-03-20 10:00+08'',null,0,0',
  '''2047-03-20 12:00+08'',''2047-03-20 10:00+08'',0,0',
  '''2047-03-20 10:00+08'',''2047-03-20 10:00+08'',0,0',
  '''-infinity'',''infinity'',0,0',
  '''2047-03-20 10:00+08'',''2047-03-20 12:00+08'',null,0',
  '''2047-03-20 10:00+08'',''2047-03-20 12:00+08'',0,null',
  '''2047-03-20 10:00+08'',''2047-03-20 12:00+08'',-15,0',
  '''2047-03-20 10:00+08'',''2047-03-20 12:00+08'',0,-15',
  '''2047-03-20 10:00+08'',''2047-03-20 12:00+08'',1,0',
  '''2047-03-20 10:00+08'',''2047-03-20 12:00+08'',0,1'] loop
  begin
   execute 'select public.venue_occupied_period('||args||')';
   raise exception 'Invalid period accepted';
  exception when invalid_parameter_value then null;
  end;
 end loop;
 raise notice 'PASS: AC-047.2.2: helper rejects invalid times and buffer durations';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','47740000-0000-0000-0000-000000000001',true);
do $$
begin
 begin
  update public.venues set setup_minutes=15 where id='47740000-0000-0000-0000-000000000002';
  raise exception 'Browser changed inactive settings';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.venues(name,location,capacity,layout,turnaround_minutes)
    values('US47 Browser Bypass','Test',100,'theatre',15);
  raise exception 'Browser inserted inactive settings';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.venue_occupied_period('2047-03-20 10:00+08','2047-03-20 12:00+08',30,45);
  raise exception 'Internal function exposed';
 exception when insufficient_privilege then null;
 end;
end $$;
-- Ordinary venue edits remain available; duration values stay unchanged.
update public.venues set name='US47 Foundation Hall Updated'
 where id='47740000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select name='US47 Foundation Hall Updated' and setup_minutes=30 and turnaround_minutes=45
 from public.venues where id='47740000-0000-0000-0000-000000000002')
 and not has_function_privilege('anon','public.venue_occupied_period(timestamptz,timestamptz,integer,integer)','execute'),
 'AC-047.1.2: foundation settings and helper are internal while ordinary venue edits still work');
reset role;
rollback;
