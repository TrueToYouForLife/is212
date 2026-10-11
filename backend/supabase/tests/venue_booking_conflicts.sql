-- Real slot-ledger/block integration, including half-open timing boundaries.
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.events set proposed_start='2032-10-12T13:00:00+08:00',proposed_end='2032-10-12T16:00:00+08:00'
 where id='b10a0000-0000-0000-0000-000000000106';
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('b10a0000-0000-0000-0000-000000000003','2032-10-12','AM','buffer','b10a0000-0000-0000-0000-000000000206'),
 ('b10a0000-0000-0000-0000-000000000003','2032-10-12','PM','event','b10a0000-0000-0000-0000-000000000206');
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts'
 @> '[{"slot":"AM","kind":"buffer","source":"confirmed_booking"}]',
 'AC-010.3.1: confirmed booking conflicts with the setup buffer');
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts'
 @> '[{"slot":"PM","kind":"event","source":"confirmed_booking"}]',
 'AC-010.3.2: confirmed booking conflicts with the event cell');
select public.block_venue('b10a0000-0000-0000-0000-000000000003','2032-10-12','2032-10-12',array['NIGHT'],'AC3 maintenance');
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts'
 @> '[{"slot":"NIGHT","kind":"buffer","source":"blocked_period","description":"AC3 maintenance"}]',
 'AC-010.3.3: active block conflicts with the turnaround buffer');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(
 public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000206')->'conflicts') c
 where c->>'source'='confirmed_booking'),
 'AC-010.3.4: a booking does not conflict with its own claims');
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.venue_bookings set status='pending_approval' where id='b10a0000-0000-0000-0000-000000000206';
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(
 public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts') c
 where c->>'source'='confirmed_booking'),
 'AC-010.3.5: pending claims are not mislabelled as confirmed-booking conflicts');
select public.remove_venue_block((select id from public.venue_closures
 where venue_id='b10a0000-0000-0000-0000-000000000003' and reason='AC3 maintenance'));
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts'='[]'::jsonb,
 'AC-010.3.6: a removed block no longer creates a conflict');
reset role;
select set_config('request.jwt.claim.sub','',false);
update public.venue_bookings set status='confirmed' where id='b10a0000-0000-0000-0000-000000000206';
update public.events set proposed_start='2032-10-12T07:00:00+08:00',proposed_end='2032-10-12T13:00:00+08:00'
 where id='b10a0000-0000-0000-0000-000000000102';
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('b10a0000-0000-0000-0000-000000000003','2032-10-12','NIGHT','buffer','b10a0000-0000-0000-0000-000000000206');
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'requestedCells'
 @> '[{"date":"2032-10-12","slot":"AM","kind":"event"},{"date":"2032-10-12","slot":"PM","kind":"buffer"}]'
 and not exists(select 1 from jsonb_array_elements(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'requestedCells') c
 where c->>'slot'='PM' and c->>'kind'='event'),
 'AC-010.3.7: an end exactly at PM start does not occupy PM as an event cell');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(
 public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts') c
 where c->>'date'='2032-10-12' and c->>'slot'='NIGHT'),
 'AC-010.3.8: occupied cells outside the event and buffers do not create false conflicts');
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'requestedCells'
 @> '[{"date":"2032-10-11","slot":"NIGHT","kind":"buffer"}]',
 'AC-010.3.9: morning setup uses the previous Singapore days final slot');
select pg_temp.assert_true(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000203')
 @> '{"conflictCheckAvailable":false,"requestedCells":[]}',
 'AC-010.3.10: missing event timing is unavailable rather than a successful no-conflict result');
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.venues(id,name,location,capacity,layout,status) values
 ('b10a0000-0000-0000-0000-000000000004','Other review hall','Test',100,'Theatre','active');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status) values
 ('b10a0000-0000-0000-0000-000000000211','b10a0000-0000-0000-0000-000000000106',
 'b10a0000-0000-0000-0000-000000000004','b10a0000-0000-0000-0000-000000000002','confirmed');
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('b10a0000-0000-0000-0000-000000000004','2032-10-12','AM','event','b10a0000-0000-0000-0000-000000000211');
set role authenticated;
select set_config('request.jwt.claim.sub','b10a0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(jsonb_array_length(public.get_venue_booking_review('b10a0000-0000-0000-0000-000000000202')->'conflicts')=2,
 'AC-010.3.11: another venues occupied cells do not appear as conflicts');
reset role;
