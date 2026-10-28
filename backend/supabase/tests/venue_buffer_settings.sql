-- Isolated settings, preservation, conflict and notification checks; rolled back.
begin;
insert into auth.users(id,email) values
 ('47980000-0000-0000-0000-000000000001','buffer-staff@example.test'),
 ('47980000-0000-0000-0000-000000000002','buffer-coordinator@example.test');
update public.profiles set role='venue_staff' where id='47980000-0000-0000-0000-000000000001';
update public.profiles set role='coordinator' where id='47980000-0000-0000-0000-000000000002';
insert into public.venues(id,name,location,capacity,layout,opens_at,closes_at)
values('47980000-0000-0000-0000-000000000003','Buffer settings hall','Test',100,'theatre','00:00','24:00');
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('47980000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47980000-0000-0000-0000-000000000002','47980000-0000-0000-0000-000000000002',
 'approved','Buffer settings test',
 case n when 10 then '2047-10-25 10:00+08'::timestamptz else '2047-10-25 11:30+08'::timestamptz end,
 case n when 10 then '2047-10-25 11:00+08'::timestamptz else '2047-10-25 12:30+08'::timestamptz end,10
 from generate_series(10,11) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','47980000-0000-0000-0000-000000000002',true);
select public.hold_venue('47980000-0000-0000-0000-000000000010','47980000-0000-0000-0000-000000000003');
select public.hold_venue('47980000-0000-0000-0000-000000000011','47980000-0000-0000-0000-000000000003');
do $$ begin
 begin
  perform public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003','x',15,30);
  raise exception 'Coordinator changed settings';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
create temp table buffer_claims_before as select * from public.venue_slot_claims;
create temp table buffer_bookings_before as select * from public.venue_bookings;
set local role authenticated;
select set_config('request.jwt.claim.sub','47980000-0000-0000-0000-000000000001',true);
create temp table buffer_version as select public.get_venue_buffer_settings('47980000-0000-0000-0000-000000000003') settings;
select pg_temp.us47_assert((select settings->>'setupMinutes'='0' and settings->>'turnaroundMinutes'='0' from buffer_version),
 'AC-047.4.3: new venues expose independent zero defaults');
do $$ begin
 begin
  perform public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003',(select settings->>'version' from buffer_version),-15,0);
  raise exception 'Negative duration accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003',(select settings->>'version' from buffer_version),0,16);
  raise exception 'Non-quarter duration accepted';
 exception when invalid_parameter_value then null; end;
 begin
  update public.venues set setup_minutes=15 where id='47980000-0000-0000-0000-000000000003';
  raise exception 'Direct edit bypassed review';
 exception when insufficient_privilege then null; end;
end $$;
-- Neither 15-minute expansion touches the other saved booking, but 30-minute
-- turnaround plus 15-minute setup now overlap each other in the original gap.
create temp table buffer_result as select public.update_venue_buffer_settings(
 '47980000-0000-0000-0000-000000000003',(select settings->>'version' from buffer_version),15,30) result;
select pg_temp.us47_assert((select result->>'setupMinutes'='15' and result->>'turnaroundMinutes'='30' and result->>'reviewCount'='2' from buffer_result),
 'AC-047.1.3: Venue Staff save independent durations and detect conflicts between extended buffers');
do $$ begin
 begin
  perform public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003',(select settings->>'version' from buffer_version),0,0);
  raise exception 'Stale edit accepted';
 exception when serialization_failure then null; end;
end $$;
reset role;
select pg_temp.us47_assert(
 not exists((select * from public.venue_slot_claims where booking_id is not null except select * from buffer_claims_before where booking_id is not null)
 union all(select * from buffer_claims_before where booking_id is not null except select * from public.venue_slot_claims where booking_id is not null))
 and not exists((select * from public.venue_bookings except select * from buffer_bookings_before)
 union all(select * from buffer_bookings_before except select * from public.venue_bookings))
 and (select count(*)=2 from public.arrangement_review_flags where event_id in ('47980000-0000-0000-0000-000000000010','47980000-0000-0000-0000-000000000011') and reason_code='venue_time_conflict' and status='open')
 and (select count(*)=2 from public.user_notifications where type_code='venue_buffer_review' and recipient_id='47980000-0000-0000-0000-000000000002')
 and (select count(*)=2 from public.user_notifications where recipient_id='47980000-0000-0000-0000-000000000001' and type_code='venue_buffer_review'),
 'AC-047.3.1: conflicting holds retain every saved row and notify the Coordinator and Venue Staff');
set local role authenticated;
select pg_temp.us47_assert((public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003',(select result->>'version' from buffer_result),15,30)->>'reviewCount')='0',
 'AC-047.1.4: unchanged settings are a no-op; invalid, unauthorised and stale edits are refused');

-- Read projection includes new buffers without rewriting any existing claim.
select pg_temp.us47_assert(exists(select 1 from public.venue_effective_slot_claims
 where venue_id='47980000-0000-0000-0000-000000000003' and slot_date='2047-10-25' and slot='T0945' and kind='buffer'),
 'AC-047.2.45: effective availability includes new setup while preserving saved occupancy');
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
values('47980000-0000-0000-0000-000000000012','47980000-0000-0000-0000-000000000002','47980000-0000-0000-0000-000000000002',
 'approved','Later hold','2047-10-25 09:00+08','2047-10-25 09:30+08',10);
set local role authenticated;
select set_config('request.jwt.claim.sub','47980000-0000-0000-0000-000000000002',true);
do $$ begin
 begin
  perform public.hold_venue('47980000-0000-0000-0000-000000000012','47980000-0000-0000-0000-000000000003');
  raise exception 'New hold ignored changed existing buffers';
 exception when unique_violation then null; end;
end $$;
reset role;
select pg_temp.us47_assert(not exists(select 1 from public.venue_bookings where event_id='47980000-0000-0000-0000-000000000012'),
 'AC-047.2.46: subsequent holds cannot occupy existing bookings new buffers; refused writes roll back');

-- Distinct saves generate fresh notices, while disabled channels remain disabled.
insert into public.notification_preferences(user_id,type_code,in_app,email)
values('47980000-0000-0000-0000-000000000001','venue_buffer_review',false,false);
set local role authenticated;
select set_config('request.jwt.claim.sub','47980000-0000-0000-0000-000000000001',true);
select public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003',
 public.get_venue_buffer_settings('47980000-0000-0000-0000-000000000003')->>'version',30,45);
reset role;
select pg_temp.us47_assert(
 (select count(*)=4 from public.user_notifications where recipient_id='47980000-0000-0000-0000-000000000002' and type_code='venue_buffer_review')
 and (select count(*)=2 from public.user_notifications where recipient_id='47980000-0000-0000-0000-000000000001' and type_code='venue_buffer_review')
 and (select count(*)=2 from public.notification_outbox where recipient_id='47980000-0000-0000-0000-000000000001' and notification_type='venue_buffer_review'),
 'AC-047.3.2: repeated changes notify again, respect staff preferences and queue rather than claim email delivery');
set local role authenticated;
select public.block_venue('47980000-0000-0000-0000-000000000003','2047-10-25','2047-10-25',array['T0930'],'Setup-only maintenance');
reset role;
select pg_temp.us47_assert(exists(select 1 from public.venue_booking_flags
 where event_id='47980000-0000-0000-0000-000000000010' and cause='venue_blocked'),
 'AC-047.2.47: maintenance flags a booking when only its newly required setup overlaps');
set local role authenticated;
select public.update_venue_buffer_settings('47980000-0000-0000-0000-000000000003',
 public.get_venue_buffer_settings('47980000-0000-0000-0000-000000000003')->>'version',0,0);
reset role;
select pg_temp.us47_assert(
 not exists((select * from public.venue_slot_claims where booking_id is not null except select * from buffer_claims_before where booking_id is not null)
 union all(select * from buffer_claims_before where booking_id is not null except select * from public.venue_slot_claims where booking_id is not null))
 and (select count(*)=2 from public.arrangement_review_flags where event_id in ('47980000-0000-0000-0000-000000000010','47980000-0000-0000-0000-000000000011') and status='open'),
 'AC-047.3.3: decreasing to zero preserves reservations and does not silently resolve outstanding reviews');
rollback;
