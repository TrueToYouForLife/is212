-- Quarter-hour operating hours share the catalogue's boundaries.
begin;
update public.venues set opens_at='00:00', closes_at='24:00'
where id='47750000-0000-0000-0000-000000000002';
update public.venues set opens_at='09:15', closes_at='17:45'
where id='47750000-0000-0000-0000-000000000002';
do $$ begin
 begin
  update public.venues set opens_at='09:10' where id='47750000-0000-0000-0000-000000000002';
  raise exception 'Non-quarter-hour opening accepted';
 exception when check_violation then null; end;
 begin
  update public.venues set closes_at='09:15' where id='47750000-0000-0000-0000-000000000002';
  raise exception 'Empty operating period accepted';
 exception when check_violation then null; end;
end $$;
select pg_temp.us47_assert((select opens_at='09:15'::time and closes_at='17:45'::time from public.venues
 where id='47750000-0000-0000-0000-000000000002'),
 'AC-047.2.44: quarter-hour opening hours accept full-day and partial-day bounds, rejecting misaligned and empty periods');
rollback;
