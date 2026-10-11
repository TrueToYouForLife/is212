-- US12 Block Venue Availability (SCRUM-14). Disposable runner only: synthetic users, real RLS.
-- Fixtures use the b12a prefix so they never collide with other stories' rows.
--
-- Slices 1 and 2 are independent refusals, listed in ID order. From slice 3 on, tests
-- build on earlier state (a saved block, a flagged booking), so each slice adds a new
-- section at the end in the order things happen.

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as owner)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
 ('b12a0000-0000-0000-0000-000000000001', 'venue12@example.test', '{"full_name":"Vera Venue"}');
update public.profiles set role = 'venue_staff'
 where id = 'b12a0000-0000-0000-0000-000000000001';

insert into public.venues (id, name, location, capacity, layout, status) values
 ('b12a0000-0000-0000-0000-0000000000f1', 'Blocks Hall',  'Level 1', 200, 'Theatre',   'active'),
 ('b12a0000-0000-0000-0000-0000000000f2', 'Retired Room', 'Level 2',  40, 'Boardroom', 'retired');

-- An existing block, for the direct update and delete checks.
insert into public.venue_closures (id, venue_id, starts_on, ends_on, reason, created_by) values
 ('b12a0000-0000-0000-0000-0000000000c1', 'b12a0000-0000-0000-0000-0000000000f1',
  '2040-06-01', '2040-06-01', 'Fixture block', 'b12a0000-0000-0000-0000-000000000001');

create or replace function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false);
$$;

set role authenticated;

-- ===== AC-012.1 Only Venue Staff can block, and only through block_venue =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'Coordinator attempt')$q$, '42501',
  'AC-012.1.1: a coordinator cannot block a venue');

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'Organiser attempt')$q$, '42501',
  'AC-012.1.2: an organiser cannot block a venue');

select pg_temp.as_user('');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'No session')$q$, '42501',
  'AC-012.1.3: a request without a signed-in user cannot block a venue');

-- Venue Staff themselves cannot skip block_venue by writing rows directly. The direct
-- insert uses a different date from the fixture block, so 0018's overlap rule can't be
-- what refuses it.
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.venue_closures (venue_id, starts_on, ends_on, reason, created_by)
  values ('b12a0000-0000-0000-0000-0000000000f1','2040-05-01','2040-05-01','Direct insert',
          'b12a0000-0000-0000-0000-000000000001')$q$, '42501',
  'AC-012.1.4: venue staff cannot create a block row directly');
select pg_temp.expect_error($q$insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, closure_id)
  values ('b12a0000-0000-0000-0000-0000000000f1','2040-06-01','AM','maintenance',
          'b12a0000-0000-0000-0000-0000000000c1')$q$, '42501',
  'AC-012.1.5: venue staff cannot write a blocked cell directly');
select pg_temp.expect_error($q$delete from public.venue_closures
  where id = 'b12a0000-0000-0000-0000-0000000000c1'$q$, '42501',
  'AC-012.1.6: venue staff cannot delete a block row directly');
select pg_temp.expect_error($q$update public.venue_closures set reason = 'Edited directly'
  where id = 'b12a0000-0000-0000-0000-0000000000c1'$q$, '42501',
  'AC-012.1.7: venue staff cannot change a block row directly');

-- ===== AC-012.2 One or more slots, on one date or a range: what is refused =====
-- Still as Venue Staff. Each request is valid except for the one field under test.
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['EVENING'],'Bad slot')$q$, '22023',
  'AC-012.2.3: an unknown slot code is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array[]::text[],'No slots')$q$, '22023',
  'AC-012.2.4: a block with no slots is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-02','2040-05-01',array['AM'],'Backwards')$q$, '22023',
  'AC-012.2.5: a block ending before it starts is refused');
-- 1 May 2040 to 2 May 2041 is 367 days, one over the limit.
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2041-05-02',array['AM'],'Too long')$q$, '22023',
  'AC-012.2.6: a single block longer than 366 days is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f2',
  '2040-05-01','2040-05-01',array['AM'],'Retired')$q$, '22023',
  'AC-012.2.9: a retired venue cannot be blocked');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000ff',
  '2040-05-01','2040-05-01',array['AM'],'Missing venue')$q$, 'P0002',
  'AC-012.2.10: an unknown venue is reported as not found');

-- ===== AC-012.3 A reason is required =====
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],'   ')$q$, '22023',
  'AC-012.3.1: a blank reason is refused');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-05-01','2040-05-01',array['AM'],null)$q$, '22023',
  'AC-012.3.2: a missing reason is refused');

-- ===== Slice 3: a saved block, and its cells in the slot ledger =====
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2040-04-01', '2040-04-01',
  array['PM'], 'Deep clean');
select pg_temp.assert_true(
  exists (select 1 from public.venue_closures
          where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
            and starts_on = '2040-04-01' and ends_on = '2040-04-01'
            and slots = array['PM'] and reason = 'Deep clean'),
  'AC-012.2.1: blocking one slot on one date saves a block for that date and slot');
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b12a0000-0000-0000-0000-0000000000e' || n)::uuid,
       '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
       'Block fixture', 'Block event ' || n, 'EVT-B12-' || n,
       '2040-01-01 01:00+00', '2040-01-01 02:00+00', 50, 'approved'
from generate_series(1, 5) n;

-- Places a booking the way holdVenue does. cells: [{"date":..,"slot":..,"kind":..}]
create or replace function pg_temp.hold(booking uuid, venue uuid, event uuid, cells jsonb)
returns void language sql as $$
  insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
  values (booking, event, venue, auth.uid(), 'held', now() + interval '2 days');
  insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id)
  select venue, (c->>'date')::date, c->>'slot', c->>'kind', booking
  from jsonb_array_elements(cells) c;
$$;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
-- 1 Apr PM is blocked (Deep clean), so an event in that slot must be refused.
select pg_temp.expect_error($q$select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b1',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e1',
  '[{"date":"2040-04-01","slot":"AM","kind":"buffer"},{"date":"2040-04-01","slot":"PM","kind":"event"},
    {"date":"2040-04-01","slot":"NIGHT","kind":"buffer"}]')$q$, '23505',
  'AC-012.5.1: a booking whose event slot is blocked is refused');
-- These pass on first run: the cell insert is general, and 0018's ledger key already
-- refuses any second claim on a cell.
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2040-04-05', '2040-04-07',
  array['AM','PM','NIGHT'], 'Carpet replacement');
select pg_temp.assert_true(
  (select count(*) = 9 from public.venue_slot_claims c
   join public.venue_closures vc on vc.id = c.closure_id
   where vc.reason = 'Carpet replacement' and c.kind = 'maintenance'),
  'AC-012.2.2: a full-day block across three dates blocks all nine cells');

-- 1 Jan 2042 to 1 Jan 2043 is exactly 366 days.
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2042-01-01', '2043-01-01',
  array['NIGHT'], 'Year-long night closure');
select pg_temp.assert_true(
  (select count(*) = 366 from public.venue_slot_claims c
   join public.venue_closures vc on vc.id = c.closure_id
   where vc.reason = 'Year-long night closure'),
  'AC-012.2.7: a block of exactly 366 days is accepted');

select pg_temp.assert_true(
  (select vc.reason = 'Carpet replacement' from public.venue_slot_claims c
   join public.venue_closures vc on vc.id = c.closure_id
   where c.venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
     and c.slot_date = '2040-04-06' and c.slot = 'AM'),
  'AC-012.4.1: venue staff can read a blocked cell with the reason for the block');

select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  (select kind = 'maintenance' from public.venue_slot_claims
   where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
     and slot_date = '2040-04-06' and slot = 'PM'),
  'AC-012.4.2: a coordinator sees a blocked cell as blocked when checking availability');

-- Setup Night 7 Apr is inside the block; the event itself (8 Apr AM) is not.
select pg_temp.expect_error($q$select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b2',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e2',
  '[{"date":"2040-04-07","slot":"NIGHT","kind":"buffer"},{"date":"2040-04-08","slot":"AM","kind":"event"},
    {"date":"2040-04-08","slot":"PM","kind":"buffer"}]')$q$, '23505',
  'AC-012.5.2: a booking whose setup slot falls in a block is refused');

-- Turnaround AM 5 Apr is inside the block; the event itself (4 Apr Night) is not.
select pg_temp.expect_error($q$select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b3',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e3',
  '[{"date":"2040-04-04","slot":"PM","kind":"buffer"},{"date":"2040-04-04","slot":"NIGHT","kind":"event"},
    {"date":"2040-04-05","slot":"AM","kind":"buffer"}]')$q$, '23505',
  'AC-012.5.3: a booking whose turnaround slot falls in a block is refused');

-- Checked as owner, so RLS can't hide a leftover row and make this pass by accident.
reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.venue_bookings
              where id in ('b12a0000-0000-0000-0000-0000000000b1',
                           'b12a0000-0000-0000-0000-0000000000b2',
                           'b12a0000-0000-0000-0000-0000000000b3')),
  'AC-012.5.5: a refused booking leaves no booking row behind');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b4',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e4',
  '[{"date":"2040-04-08","slot":"AM","kind":"buffer"},{"date":"2040-04-08","slot":"PM","kind":"event"},
    {"date":"2040-04-08","slot":"NIGHT","kind":"buffer"}]');
select pg_temp.assert_true(
  (select count(*) = 3 from public.venue_slot_claims
   where booking_id = 'b12a0000-0000-0000-0000-0000000000b4'),
  'AC-012.6.1: the day after a block can be booked in full');

-- 1 Apr has only PM blocked. A booking that needs only the Night slot goes ahead.
select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b5',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e5',
  '[{"date":"2040-04-01","slot":"NIGHT","kind":"event"}]');
select pg_temp.assert_true(
  exists (select 1 from public.venue_slot_claims
          where booking_id = 'b12a0000-0000-0000-0000-0000000000b5'),
  'AC-012.6.2: a slot the block leaves free on the same date can still be booked');
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2040-04-10', '2040-04-10',
  array['NIGHT','AM','AM'], 'Unordered slots');
select pg_temp.assert_true(
  (select slots = array['AM','NIGHT'] from public.venue_closures where reason = 'Unordered slots')
  and (select count(*) = 2 from public.venue_slot_claims c
       join public.venue_closures vc on vc.id = c.closure_id
       where vc.reason = 'Unordered slots'),
  'AC-012.2.8: repeated and unordered slots are stored once each, in time order');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2040-04-01', '2040-04-01',
  array['AM'], 'Morning inspection');
select pg_temp.assert_true(
  (select vc.reason = 'Morning inspection' from public.venue_slot_claims c
   join public.venue_closures vc on vc.id = c.closure_id
   where c.venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
     and c.slot_date = '2040-04-01' and c.slot = 'AM'),
  'AC-012.2.11: a different slot on an already partly blocked date can be blocked separately');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f1', '2040-04-12', '2040-04-12',
  array['AM'], '  Electrical safety check  ');
select pg_temp.assert_true(
  exists (select 1 from public.venue_closures
          where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
            and starts_on = '2040-04-12' and reason = 'Electrical safety check'),
  'AC-012.3.3: the reason is stored without surrounding spaces');
select pg_temp.assert_true(
  (select created_by = 'b12a0000-0000-0000-0000-000000000001'
          and created_by_name = 'Vera Venue' and created_at is not null
   from public.venue_closures where reason = 'Deep clean'),
  'AC-012.10.1: a block records the staff member who created it, their name and the time');

-- ===== Slice 4: preview before saving (AC-012.7, AC-012.9.2) =====
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select count(*) = 3
   from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f1',
          '2040-04-08', '2040-04-08', array['AM','PM','NIGHT']) p
   where p.overlap_type = 'booking' and p.event_reference = 'EVT-B12-4'
     and p.booking_status = 'held')
  and exists (
   select 1
   from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f1',
          '2040-04-08', '2040-04-08', array['AM','PM','NIGHT']) p
   where p.slot = 'PM' and p.claim_kind = 'event'),
  'AC-012.7.1: preview lists each overlapping booking cell with its event and booking status');
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
values ('b12a0000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000003', 'Block fixture', 'Block event 6', 'EVT-B12-6',
        '2040-01-01 01:00+00', '2040-01-01 02:00+00', 50, 'approved');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b6',
  'b12a0000-0000-0000-0000-0000000000f1', 'b12a0000-0000-0000-0000-0000000000e6',
  '[{"date":"2040-04-15","slot":"AM","kind":"buffer"},{"date":"2040-04-15","slot":"PM","kind":"event"},
    {"date":"2040-04-15","slot":"NIGHT","kind":"buffer"}]');
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.venue_bookings set hold_expires_at = now() - interval '1 day'
 where id = 'b12a0000-0000-0000-0000-0000000000b6';
set role authenticated;
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  exists (select 1 from public.venue_slot_claims
          where booking_id = 'b12a0000-0000-0000-0000-0000000000b6')
  and not exists (
   select 1
   from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f1',
          '2040-04-15', '2040-04-15', array['AM','PM','NIGHT']) p
   where p.event_reference = 'EVT-B12-6'),
  'AC-012.7.2: preview leaves out a hold that has already lapsed');
select pg_temp.assert_true(
  (select count(*) = 2
   from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f1',
          '2040-04-01', '2040-04-01', array['AM','PM']) p
   where p.overlap_type = 'existing_block'
     and ((p.slot = 'AM' and p.block_reason = 'Morning inspection')
       or (p.slot = 'PM' and p.block_reason = 'Deep clean'))),
  'AC-012.9.2: preview reports the existing blocks that a new one would overlap');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select * from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f1',
  '2040-04-08','2040-04-08',array['AM'])$q$, '42501',
  'AC-012.7.4: only venue staff can preview a block');
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select * from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f1',
  '2040-04-09','2040-04-08',array['AM'])$q$, '22023',
  'AC-012.7.5: preview applies the same checks as saving');
select pg_temp.assert_true(
  not exists (select 1 from public.venue_closures
              where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
                and ('2040-04-08' between starts_on and ends_on
                     or '2040-04-15' between starts_on and ends_on))
  and not exists (select 1 from public.venue_slot_claims
                  where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
                    and kind = 'maintenance'
                    and slot_date in ('2040-04-08', '2040-04-15')),
  'AC-012.7.3: previewing a block saves nothing');

-- ===== Slice 5: blocking over bookings flags them (AC-012.8, 9.1, 10.3) =====
-- Guard first: today the ledger key refuses a same-slot overlap. The next change lets the
-- cell insert skip held cells, so this keeps that refusal from quietly disappearing.
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.block_venue('b12a0000-0000-0000-0000-0000000000f1',
  '2040-04-01','2040-04-01',array['PM'],'Overlapping')$q$, '23505',
  'AC-012.9.1: a block overlapping an active block on the same slot is refused');
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.venues (id, name, location, capacity, layout, status) values
 ('b12a0000-0000-0000-0000-0000000000f3', 'Second Hall', 'Level 3', 120, 'Classroom', 'active');
-- E7 and E9 are assigned to coordinator 3; E8 is unassigned (Week 7 change 5 queue).
insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b12a0000-0000-0000-0000-0000000000e' || n)::uuid,
       '00000000-0000-0000-0000-000000000001',
       case when n = 8 then null else '00000000-0000-0000-0000-000000000003'::uuid end,
       'Block fixture', 'Block event ' || n, 'EVT-B12-' || n,
       '2040-01-01 01:00+00', '2040-01-01 02:00+00', 50, 'approved'
from generate_series(7, 9) n;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
-- B7: AM event on 10 Mar, setup Night 9 Mar, turnaround PM 10 Mar. Confirmed below.
select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b7',
  'b12a0000-0000-0000-0000-0000000000f3', 'b12a0000-0000-0000-0000-0000000000e7',
  '[{"date":"2040-03-09","slot":"NIGHT","kind":"buffer"},{"date":"2040-03-10","slot":"AM","kind":"event"},
    {"date":"2040-03-10","slot":"PM","kind":"buffer"}]');
-- B9: PM event on 11 Mar. Its hold is made to lapse below.
select pg_temp.hold('b12a0000-0000-0000-0000-0000000000b9',
  'b12a0000-0000-0000-0000-0000000000f3', 'b12a0000-0000-0000-0000-0000000000e9',
  '[{"date":"2040-03-11","slot":"AM","kind":"buffer"},{"date":"2040-03-11","slot":"PM","kind":"event"},
    {"date":"2040-03-11","slot":"NIGHT","kind":"buffer"}]');
-- B8: Night event on 12 Mar for the unassigned event, requested by coordinator 4. Pending below.
-- Placed by the test administrator, not through RLS: since 0049 no coordinator can hold a
-- venue for an unassigned event. Such bookings can still exist (placed before 0049, or the
-- event lost its coordinator later), and AC-012.8.3 checks how their flags are routed.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('b12a0000-0000-0000-0000-0000000000b8', 'b12a0000-0000-0000-0000-0000000000e8',
        'b12a0000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000004',
        'held', now() + interval '2 days');
insert into public.venue_slot_claims (venue_id, slot_date, slot, kind, booking_id) values
  ('b12a0000-0000-0000-0000-0000000000f3', '2040-03-12', 'PM', 'buffer', 'b12a0000-0000-0000-0000-0000000000b8'),
  ('b12a0000-0000-0000-0000-0000000000f3', '2040-03-12', 'NIGHT', 'event', 'b12a0000-0000-0000-0000-0000000000b8'),
  ('b12a0000-0000-0000-0000-0000000000f3', '2040-03-13', 'AM', 'buffer', 'b12a0000-0000-0000-0000-0000000000b8');


reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.venue_bookings set status = 'confirmed'
 where id = 'b12a0000-0000-0000-0000-0000000000b7';
update public.venue_bookings set status = 'pending_approval'
 where id = 'b12a0000-0000-0000-0000-0000000000b8';
update public.venue_bookings set hold_expires_at = now() - interval '1 day'
 where id = 'b12a0000-0000-0000-0000-0000000000b9';

set role authenticated;
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f3', '2040-03-10', '2040-03-12',
  array['AM','PM','NIGHT'], 'Ceiling repair');

-- Checked as owner, so RLS can't hide anything.
reset role;
select pg_temp.assert_true(
  (select status = 'confirmed' from public.venue_bookings
   where id = 'b12a0000-0000-0000-0000-0000000000b7')
  and (select status = 'pending_approval' from public.venue_bookings
       where id = 'b12a0000-0000-0000-0000-0000000000b8')
  and (select count(*) = 3 from public.venue_slot_claims
       where booking_id = 'b12a0000-0000-0000-0000-0000000000b7')
  and (select count(*) = 3 from public.venue_slot_claims
       where booking_id = 'b12a0000-0000-0000-0000-0000000000b8'),
  'AC-012.8.1: overlapping confirmed and pending bookings keep their status and every cell');
select pg_temp.assert_true(
  coalesce((select recipient_id = '00000000-0000-0000-0000-000000000003'
                   and cause = 'venue_blocked' and status = 'open'
                   and detail = 'Venue blocked: Ceiling repair'
                   and affected_cells = '[{"date":"2040-03-10","slot":"AM","kind":"event"},
                                          {"date":"2040-03-10","slot":"PM","kind":"buffer"}]'::jsonb
            from public.venue_booking_flags
            where booking_id = 'b12a0000-0000-0000-0000-0000000000b7'), false),
  'AC-012.8.2: an overlapping booking is flagged for its assigned coordinator with only the blocked cells');
select pg_temp.assert_true(
  coalesce((select status = 'expired' from public.venue_bookings
            where id = 'b12a0000-0000-0000-0000-0000000000b9'), false)
  and not exists (select 1 from public.venue_booking_flags
                  where booking_id = 'b12a0000-0000-0000-0000-0000000000b9')
  and coalesce((select kind = 'maintenance' from public.venue_slot_claims
                where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'
                  and slot_date = '2040-03-11' and slot = 'PM'), false),
  'AC-012.8.5: a lapsed hold is released rather than flagged, and its cells become blocked');
select pg_temp.assert_true(
  coalesce((select recipient_id is not distinct from '00000000-0000-0000-0000-000000000004'
            from public.venue_booking_flags
            where booking_id = 'b12a0000-0000-0000-0000-0000000000b8'), false),
  'AC-012.8.3: a booking for an unassigned event is flagged for the coordinator who requested it');
select pg_temp.assert_true(
  (select count(*) = 2 and count(distinct recipient_email) = 2
   from public.notification_outbox
   where subject = 'Venue booking needs review: Second Hall'
     and recipient_email in (select email from auth.users
                             where id in ('00000000-0000-0000-0000-000000000003',
                                          '00000000-0000-0000-0000-000000000004'))
     and body like '%Reason: Ceiling repair%'
     and body like '%has not been cancelled%'),
  'AC-012.8.4: an email naming the venue, reason and unchanged booking is queued for each coordinator');
select pg_temp.assert_true(
  (select count(*) = 2
          and bool_and(created_by = 'b12a0000-0000-0000-0000-000000000001'
                       and created_at is not null)
   from public.venue_booking_flags
   where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'),
  'AC-012.10.3: each flag records which staff member raised it and when');

-- ===== Slice 5b: who can see which flag (AC-012.8.6 to 8.10) =====
set role authenticated;
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select count(*) = 2 from public.venue_booking_flags
   where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'),
  'AC-012.8.10: venue staff can see every flag a block raised');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  coalesce((select array_agg(booking_id::text order by booking_id)
                   = array['b12a0000-0000-0000-0000-0000000000b7']
            from public.venue_booking_flags
            where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'), false),
  'AC-012.8.6: a coordinator sees flags for their own events only');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  coalesce((select array_agg(booking_id::text)
                   = array['b12a0000-0000-0000-0000-0000000000b8']
            from public.venue_booking_flags
            where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'), false),
  'AC-012.8.7: the requesting coordinator sees the flag for an unassigned event');
select pg_temp.expect_error($q$update public.venue_booking_flags set status = 'resolved'
  where booking_id = 'b12a0000-0000-0000-0000-0000000000b8'$q$, '42501',
  'AC-012.8.8: a coordinator cannot clear a flag directly');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  not exists (select 1 from public.venue_booking_flags),
  'AC-012.8.9: an organiser cannot see internal booking flags');

-- ===== Slice 6: keeping blocks honest (AC-012.8.11 to 8.13, 5.4) =====
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.venue_bookings
  set status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now()
  where id = 'b12a0000-0000-0000-0000-0000000000b8'$q$, '23514',
  'AC-012.8.11: venue staff cannot approve a pending booking that a block has flagged');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
delete from public.venue_slot_claims where booking_id = 'b12a0000-0000-0000-0000-0000000000b8';
update public.venue_bookings set status = 'cancelled'
 where id = 'b12a0000-0000-0000-0000-0000000000b8';

reset role;
select pg_temp.assert_true(
  coalesce((select kind = 'maintenance' from public.venue_slot_claims
            where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'
              and slot_date = '2040-03-12' and slot = 'PM'), false)
  and coalesce((select kind = 'maintenance' from public.venue_slot_claims
                where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'
                  and slot_date = '2040-03-12' and slot = 'NIGHT'), false)
  and not exists (select 1 from public.venue_slot_claims
                  where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'
                    and slot_date = '2040-03-13' and slot = 'AM'),
  'AC-012.8.12: cells a cancelled booking releases inside a block become blocked; cells outside become free');
select pg_temp.assert_true(
  coalesce((select status = 'resolved' and resolution = 'Booking cancelled'
                   and resolved_at is not null
            from public.venue_booking_flags
            where booking_id = 'b12a0000-0000-0000-0000-0000000000b8'), false),
  'AC-012.8.13: cancelling a flagged booking resolves its flag with the reason');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select pg_temp.hold('b12a0000-0000-0000-0000-0000000000ba',
  'b12a0000-0000-0000-0000-0000000000f3', 'b12a0000-0000-0000-0000-0000000000e1',
  '[{"date":"2040-03-12","slot":"NIGHT","kind":"event"}]')$q$, '23505',
  'AC-012.5.4: a cell freed by a cancelled booking inside a block cannot be booked');

-- ===== Slice 7: removing a block (AC-012.9, AC-012.10.2) =====
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($q$select public.remove_venue_block(
  (select id from public.venue_closures where reason = 'Ceiling repair'))$q$, '42501',
  'AC-012.9.4: a coordinator cannot remove a block');
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.remove_venue_block(
  (select id from public.venue_closures where reason = 'Ceiling repair'));

reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.venue_slot_claims c
              join public.venue_closures vc on vc.id = c.closure_id
              where vc.reason = 'Ceiling repair')
  and (select count(*) = 3 from public.venue_slot_claims
       where booking_id = 'b12a0000-0000-0000-0000-0000000000b7'),
  'AC-012.9.5: removing a block frees its cells and leaves existing bookings in place');
select pg_temp.assert_true(
  coalesce((select removed_by = 'b12a0000-0000-0000-0000-000000000001'
                   and removed_at is not null
            from public.venue_closures where reason = 'Ceiling repair'), false),
  'AC-012.10.2: a removed block keeps its record, with who removed it and when');
select pg_temp.assert_true(
  coalesce((select status = 'resolved' and resolution = 'Block removed'
                   and resolved_at is not null
            from public.venue_booking_flags
            where booking_id = 'b12a0000-0000-0000-0000-0000000000b7'), false),
  'AC-012.9.6: removing a block resolves the flags it raised');
set role authenticated;
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.remove_venue_block(
  (select id from public.venue_closures where reason = 'Ceiling repair'))$q$, 'P0002',
  'AC-012.9.7: a block that has already been removed cannot be removed again');
select pg_temp.assert_true(
  not exists (select 1 from public.venue_closures
              where venue_id = 'b12a0000-0000-0000-0000-0000000000f3' and removed_at is null)
  and exists (select 1 from public.venue_closures
              where venue_id = 'b12a0000-0000-0000-0000-0000000000f3' and reason = 'Ceiling repair')
  and exists (select 1 from public.venue_closures
              where venue_id = 'b12a0000-0000-0000-0000-0000000000f1'
                and reason = 'Deep clean' and removed_at is null),
  'AC-012.9.3: venue staff can list current blocks, which leave out removed ones kept on record');

select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.hold('b12a0000-0000-0000-0000-0000000000bb',
  'b12a0000-0000-0000-0000-0000000000f3', 'b12a0000-0000-0000-0000-0000000000e2',
  '[{"date":"2040-03-12","slot":"NIGHT","kind":"event"}]');
select pg_temp.assert_true(
  exists (select 1 from public.venue_slot_claims
          where booking_id = 'b12a0000-0000-0000-0000-0000000000bb'),
  'AC-012.9.8: the slots of a removed block can be booked again');

-- ===== Slice 7b: removed blocks no longer count (AC-012.9.9 to 9.11, 10.4) =====
select pg_temp.as_user('b12a0000-0000-0000-0000-000000000001');
select public.block_venue('b12a0000-0000-0000-0000-0000000000f3', '2040-03-11', '2040-03-11',
  array['AM'], 'Lighting check');
select pg_temp.assert_true(
  coalesce((select vc.reason = 'Lighting check' from public.venue_slot_claims c
            join public.venue_closures vc on vc.id = c.closure_id
            where c.venue_id = 'b12a0000-0000-0000-0000-0000000000f3'
              and c.slot_date = '2040-03-11' and c.slot = 'AM'), false),
  'AC-012.9.9: the slots of a removed block can be blocked again');
select pg_temp.assert_true(
  exists (select 1 from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f3',
            '2040-03-10', '2040-03-12', array['AM','PM','NIGHT']) p
          where p.overlap_type = 'existing_block' and p.block_reason = 'Lighting check')
  and not exists (select 1 from public.preview_venue_block('b12a0000-0000-0000-0000-0000000000f3',
            '2040-03-10', '2040-03-12', array['AM','PM','NIGHT']) p
          where p.block_reason = 'Ceiling repair'),
  'AC-012.9.10: preview does not report removed blocks');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
delete from public.venue_slot_claims where booking_id = 'b12a0000-0000-0000-0000-0000000000b7';
update public.venue_bookings set status = 'cancelled'
 where id = 'b12a0000-0000-0000-0000-0000000000b7';

reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.venue_slot_claims
              where venue_id = 'b12a0000-0000-0000-0000-0000000000f3'
                and slot_date = '2040-03-10' and slot in ('AM', 'PM')),
  'AC-012.9.11: a cell freed inside a removed block stays free');

-- ===== Snapshot for the replay check (AC-012.10.4), run by the runner after this file =====
reset role;
select set_config('request.jwt.claim.sub', '', false);
create temp table blocks_before_replay as select * from public.venue_closures;
create temp table flags_before_replay as select * from public.venue_booking_flags;
create temp table claims_before_replay as select * from public.venue_slot_claims;
