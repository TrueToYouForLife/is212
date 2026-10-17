-- US16 (SCRUM-21 epic): Attendees join a waiting list for a full event. Disposable PostgreSQL
-- only; run through the database test runner, after registration_setting.sql (it reuses
-- pg_temp.us14_race). Not wrapped in a transaction: AC-016.1.7 and AC-016.5.5 race two real
-- sessions (dblink), which can only see committed fixtures.
-- Fixtures are this file's own (ids start 16), so no earlier story's state is assumed.
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Act as a signed-in user, or as the database owner, without repeating the two set_config lines.
create function pg_temp.act(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', u, false);
end $$;
create function pg_temp.owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
-- The active waiting-list entry of an attendee on an event, looked up as the owner.
create function pg_temp.entry(ev text, att text) returns uuid language sql security definer as $$
  select id from public.event_waitlist_entries
   where event_id = ev::uuid and attendee_id = att::uuid and status in ('waiting', 'offered')
   order by joined_at desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT)
-- ---------------------------------------------------------------------------
-- Users: 01-06 A1-A6 attendees; 07 O1 organiser; 08-09 A7-A8 attendees (the race).
insert into auth.users (id, email, raw_user_meta_data) values
  ('16000000-0000-0000-0000-000000000001', 'a1-us16@example.test', '{"full_name":"Ann One"}'),
  ('16000000-0000-0000-0000-000000000002', 'a2-us16@example.test', '{"full_name":"Ben Two"}'),
  ('16000000-0000-0000-0000-000000000003', 'a3-us16@example.test', '{"full_name":"Cal Three"}'),
  ('16000000-0000-0000-0000-000000000004', 'a4-us16@example.test', '{"full_name":"Dee Four"}'),
  ('16000000-0000-0000-0000-000000000005', 'a5-us16@example.test', '{"full_name":"Eli Five"}'),
  ('16000000-0000-0000-0000-000000000006', 'a6-us16@example.test', '{"full_name":"Fay Six"}'),
  ('16000000-0000-0000-0000-000000000007', 'o1-us16@example.test', '{"full_name":"Olive Org"}'),
  ('16000000-0000-0000-0000-000000000008', 'a7-us16@example.test', '{"full_name":"Gus Seven"}'),
  ('16000000-0000-0000-0000-000000000009', 'a8-us16@example.test', '{"full_name":"Hana Eight"}');
-- New accounts are Attendees since US29; every other role is assigned by an administrator.
update public.profiles set role = 'organiser' where id = '16000000-0000-0000-0000-000000000007';

-- Events. Capacity is expected_attendance. All start in 2035 unless the name says otherwise.
-- 01 E-FLOW cap 2, the main story          02 E-ROOM cap 5, never full
-- 03 E-CLOSED cap 1, registration off      04 E-SOON cap 1, starts in 12 hours
-- 05 E-GROW cap 1, capacity raised later   06 E-SWITCH cap 1, registration switched off and on
-- 07 E-RACE cap 1, simultaneous requests   08 E-APPROVED cap 1, not Confirmed
-- 09 E-NEAR cap 1, starts in 36 hours      10 E-LEAVE cap 1, an offer is handed back
insert into public.events (id, organiser_id, name, purpose, event_type, proposed_start, proposed_end,
  expected_attendance, registration_required, status)
values
  ('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000007', 'US16 Flow Workshop',
   'Workshop', 'Workshop', '2035-03-10 01:00+00', '2035-03-10 09:00+00', 2, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000007', 'US16 Room Talk',
   'Talk', 'Talk', '2035-03-11 01:00+00', '2035-03-11 09:00+00', 5, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000007', 'US16 Closed Seminar',
   'Seminar', 'Seminar', '2035-03-12 01:00+00', '2035-03-12 09:00+00', 1, false, 'confirmed'),
  ('16100000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000007', 'US16 Soon Meetup',
   'Meetup', 'Meetup', now() + interval '12 hours', now() + interval '20 hours', 1, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000005', '16000000-0000-0000-0000-000000000007', 'US16 Grow Forum',
   'Forum', 'Forum', '2035-03-13 01:00+00', '2035-03-13 09:00+00', 1, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000006', '16000000-0000-0000-0000-000000000007', 'US16 Switch Fair',
   'Fair', 'Fair', '2035-03-14 01:00+00', '2035-03-14 09:00+00', 1, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000007', '16000000-0000-0000-0000-000000000007', 'US16 Race Gala',
   'Gala', 'Gala', '2035-03-15 01:00+00', '2035-03-15 09:00+00', 1, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000008', '16000000-0000-0000-0000-000000000007', 'US16 Approved Expo',
   'Expo', 'Expo', '2035-03-16 01:00+00', '2035-03-16 09:00+00', 1, true, 'approved'),
  ('16100000-0000-0000-0000-000000000009', '16000000-0000-0000-0000-000000000007', 'US16 Near Summit',
   'Summit', 'Summit', now() + interval '36 hours', now() + interval '44 hours', 1, true, 'confirmed'),
  ('16100000-0000-0000-0000-000000000010', '16000000-0000-0000-0000-000000000007', 'US16 Leave Clinic',
   'Clinic', 'Clinic', '2035-03-17 01:00+00', '2035-03-17 09:00+00', 1, true, 'confirmed');

-- Starting registrations, inserted as the owner so each event begins exactly full.
insert into public.event_registrations (id, event_id, attendee_id, phone) values
  ('16400000-0000-0000-0000-000000000001', '16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', '91234567'),
  ('16400000-0000-0000-0000-000000000002', '16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', '92234567'),
  ('16400000-0000-0000-0000-000000000011', '16100000-0000-0000-0000-000000000005', '16000000-0000-0000-0000-000000000001', '91234567'),
  ('16400000-0000-0000-0000-000000000012', '16100000-0000-0000-0000-000000000006', '16000000-0000-0000-0000-000000000001', '91234567'),
  ('16400000-0000-0000-0000-000000000013', '16100000-0000-0000-0000-000000000009', '16000000-0000-0000-0000-000000000001', '91234567'),
  ('16400000-0000-0000-0000-000000000014', '16100000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000001', '91234567'),
  ('16400000-0000-0000-0000-000000000015', '16100000-0000-0000-0000-000000000010', '16000000-0000-0000-0000-000000000001', '91234567'),
  ('16400000-0000-0000-0000-000000000016', '16100000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000001', '91234567');

-- ---------------------------------------------------------------------------
-- AC-016.1: a full event offers the waiting list instead of registration
-- ---------------------------------------------------------------------------
select pg_temp.act('16000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
  $q$select public.register_for_event('16100000-0000-0000-0000-000000000001', '93234567', null, null, false)$q$,
  '53000', 'AC-016.1.1: registering for a full event is refused (53000), not silently accepted');

select public.join_waitlist('16100000-0000-0000-0000-000000000001');
select pg_temp.act('16000000-0000-0000-0000-000000000004');
select public.join_waitlist('16100000-0000-0000-0000-000000000001');
select pg_temp.act('16000000-0000-0000-0000-000000000005');
select public.join_waitlist('16100000-0000-0000-0000-000000000001');
select pg_temp.owner();

select pg_temp.assert_true(
  (select count(*) = 3 and bool_and(status = 'waiting') from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000001'),
  'AC-016.1.2: attendees join the waiting list of a full event');

select pg_temp.act('16000000-0000-0000-0000-000000000006');
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000002')$q$,
  '55000', 'AC-016.1.3: an event that still has places refuses the waiting list');
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000003')$q$,
  '22000', 'AC-016.1.4: an event with registration switched off refuses it');
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000008')$q$,
  '22000', 'AC-016.1.4: so does an event that is not Confirmed');
select pg_temp.owner();

select pg_temp.act('16000000-0000-0000-0000-000000000007');
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000001')$q$,
  '42501', 'AC-016.1.5: an Organiser cannot join a waiting list');
select pg_temp.owner();
reset role;
set role anon;
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000001')$q$,
  '42501', 'AC-016.1.5: nor a visitor who is not signed in');
reset role;

select pg_temp.act('16000000-0000-0000-0000-000000000006');
select pg_temp.assert_true(
  (select "full" and waitlist_entry_id is null from public.get_open_event('16100000-0000-0000-0000-000000000001'))
  and (select not "full" from public.get_open_event('16100000-0000-0000-0000-000000000002')),
  'AC-016.1.6: the event page reports a full event as full, and an event with places as not full');
select pg_temp.owner();

-- Two real sessions take the last place of E-RACE at once. The race runs as its own statement: a
-- statement cannot see writes made by functions it calls, so counting in the same one reads 0.
create temp table us16_place_race as
select * from pg_temp.us14_race(
  '16000000-0000-0000-0000-000000000008',
  $q$select public.register_for_event('16100000-0000-0000-0000-000000000007', '71234567', null, null, false)::text$q$,
  '16000000-0000-0000-0000-000000000009',
  $q$select public.register_for_event('16100000-0000-0000-0000-000000000007', '72234567', null, null, false)::text$q$);

select pg_temp.assert_true(
  (select (first_error is null) <> (second_error is null) from us16_place_race)
  and (select count(*) = 1 from public.event_registrations
        where event_id = '16100000-0000-0000-0000-000000000007' and status = 'registered'),
  'AC-016.1.7: two simultaneous requests for the last place give it to one person; capacity is never exceeded');

-- ---------------------------------------------------------------------------
-- AC-016.5: no joining twice, and not while registered (before any offer is made)
-- ---------------------------------------------------------------------------
select pg_temp.act('16000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000001')$q$,
  '23505', 'AC-016.5.1: an attendee who is already registered cannot join the waiting list');
select pg_temp.owner();

select pg_temp.assert_true(
  (select count(*) = 0 from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000001'),
  'AC-016.5.1: and no entry was created for them');

select pg_temp.act('16000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000001')$q$,
  '23505', 'AC-016.5.2: an attendee already on the waiting list cannot join it again');
select pg_temp.expect_error(
  $q$select public.register_for_event('16100000-0000-0000-0000-000000000001', '93234567', null, null, false)$q$,
  '23505', 'AC-016.5.3: and cannot register directly while waitlisted');
select pg_temp.owner();

select pg_temp.assert_true(
  (select count(*) = 1 from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000003'),
  'AC-016.5.2: and still has exactly one entry');

select pg_temp.expect_error(
  $q$insert into public.event_waitlist_entries (event_id, attendee_id)
     values ('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003')$q$,
  '23505', 'AC-016.5.4: the database itself refuses a second active entry, whatever calls it');

-- Two real sessions join the same full event as the same attendee.
create temp table us16_join_race as
select * from pg_temp.us14_race(
  '16000000-0000-0000-0000-000000000001',
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000007')::text$q$,
  '16000000-0000-0000-0000-000000000001',
  $q$select public.join_waitlist('16100000-0000-0000-0000-000000000007')::text$q$);

select pg_temp.assert_true(
  (select (first_error is null) <> (second_error is null) from us16_join_race)
  and (select count(*) = 1 from public.event_waitlist_entries
        where event_id = '16100000-0000-0000-0000-000000000007'
          and attendee_id = '16000000-0000-0000-0000-000000000001'),
  'AC-016.5.5: two simultaneous joins by one attendee create one entry');

-- ---------------------------------------------------------------------------
-- AC-016.2: first come, first served
-- ---------------------------------------------------------------------------
select pg_temp.act('16000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  (select waitlist_position = 1 from public.get_open_event('16100000-0000-0000-0000-000000000001')),
  'AC-016.2.1: the attendee who joined first is at position 1');
select pg_temp.act('16000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  (select waitlist_position = 2 from public.get_open_event('16100000-0000-0000-0000-000000000001')),
  'AC-016.2.1: the next is at position 2');
select pg_temp.act('16000000-0000-0000-0000-000000000005');
select pg_temp.assert_true(
  (select waitlist_position = 3 from public.get_open_event('16100000-0000-0000-0000-000000000001')),
  'AC-016.2.1: and the next at position 3');
select pg_temp.owner();

-- Entries are the attendee's own: nobody reads or writes anyone else's.
select pg_temp.act('16000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(attendee_id = '16000000-0000-0000-0000-000000000004')
     from public.event_waitlist_entries where event_id = '16100000-0000-0000-0000-000000000001'),
  'AC-016.5.6: an attendee can read only their own waiting-list entries');
select pg_temp.expect_error(
  $q$insert into public.event_waitlist_entries (event_id, attendee_id)
     values ('16100000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000004')$q$,
  '42501', 'AC-016.5.7: attendees cannot write entries directly');
select pg_temp.expect_error(
  $q$update public.event_waitlist_entries set joined_at = '2000-01-01'$q$,
  '42501', 'AC-016.5.7: nor change their place in the queue');
select pg_temp.expect_error(
  $q$delete from public.event_waitlist_entries$q$,
  '42501', 'AC-016.5.7: nor delete an entry');
select pg_temp.owner();

-- Joining queues one email for each person.
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox
    where event_id = '16100000-0000-0000-0000-000000000001'
      and recipient_email = 'a3-us16@example.test' and subject like 'You are on the waiting list for%US16 Flow Workshop'),
  'AC-016.3.3: joining the waiting list queues a confirmation email');

-- ---------------------------------------------------------------------------
-- AC-016.3 and AC-016.2: A1 withdraws, so a place opens and the first in line is offered it
-- ---------------------------------------------------------------------------
select pg_temp.act('16000000-0000-0000-0000-000000000001');
select public.withdraw_registration('16400000-0000-0000-0000-000000000001');
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'offered' and offered_at is not null
      and offer_expires_at between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour'
     from public.event_waitlist_entries where id = pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003')),
  'AC-016.3.1: a withdrawal offers the place to the first person waiting, with 3 days to accept');

select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox
    where recipient_email = 'a3-us16@example.test' and subject like 'A place is available for%US16 Flow Workshop'
      and body like '%Accept it under My registrations before%'),
  'AC-016.3.2: they are emailed the offer with its deadline');

select pg_temp.act('16000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  (select status = 'waiting' and queue_position = 1 from public.list_my_waitlist()
    where event_id = '16100000-0000-0000-0000-000000000001'),
  'AC-016.2.2: only the first was offered; the next person moves up to position 1');
select pg_temp.owner();

select pg_temp.act('16000000-0000-0000-0000-000000000006');
select pg_temp.expect_error(
  $q$select public.register_for_event('16100000-0000-0000-0000-000000000001', '96234567', null, null, false)$q$,
  '53000', 'AC-016.2.3: someone who was not queued cannot take the held place by registering directly');
select public.join_waitlist('16100000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select waitlist_position = 3 from public.get_open_event('16100000-0000-0000-0000-000000000001')),
  'AC-016.2.4: a later joiner goes to the back of the line');
select pg_temp.owner();

-- Accepting.
select pg_temp.act('16000000-0000-0000-0000-000000000004');
select pg_temp.expect_error(
  format($q$select public.accept_waitlist_offer(%L, '94234567', null, null, false)$q$,
    pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004')),
  '55000', 'AC-016.3.6: someone who has not been offered a place cannot accept one');
select pg_temp.act('16000000-0000-0000-0000-000000000005');
select pg_temp.expect_error(
  format($q$select public.accept_waitlist_offer(%L, '95234567', null, null, false)$q$,
    pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003')),
  'P0002', 'AC-016.3.7: nor accept an offer made to someone else');
select pg_temp.act('16000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
  format($q$select public.accept_waitlist_offer(%L, 'abc', null, null, false)$q$,
    pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003')),
  '22023', 'AC-016.3.4: an invalid phone number is refused');
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'offered' from public.event_waitlist_entries
    where id = pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003'))
  and not exists (select 1 from public.event_registrations
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000003'),
  'AC-016.3.4: and the offer is still open, with no registration made');

select pg_temp.act('16000000-0000-0000-0000-000000000003');
select public.accept_waitlist_offer(
  pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003'),
  '93234567', 'Vegan', null, false);
select pg_temp.owner();

select pg_temp.assert_true(
  (select count(*) = 1 from public.event_registrations
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000003' and status = 'registered'
      and dietary_requirements = 'Vegan')
  and (select status = 'accepted' and resolved_at is not null from public.event_waitlist_entries
        where event_id = '16100000-0000-0000-0000-000000000001'
          and attendee_id = '16000000-0000-0000-0000-000000000003')
  and (select count(*) = 2 from public.event_registrations
        where event_id = '16100000-0000-0000-0000-000000000001' and status = 'registered'),
  'AC-016.3.5: accepting registers them with their answers, and registrations stay at capacity (2 of 2)');

-- Leaving a waiting place moves everyone behind up.
select pg_temp.act('16000000-0000-0000-0000-000000000005');
select public.leave_waitlist(pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000005'));
select pg_temp.act('16000000-0000-0000-0000-000000000006');
select pg_temp.assert_true(
  (select waitlist_position = 2 from public.get_open_event('16100000-0000-0000-0000-000000000001')),
  'AC-016.2.5: when someone ahead leaves, the people behind them move up');
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'left' and resolved_at is not null from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000005'),
  'AC-016.2.5: and the entry is kept as left, not deleted');

-- ---------------------------------------------------------------------------
-- AC-016.4: an offer not accepted in time passes to the next person
-- ---------------------------------------------------------------------------
select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.withdraw_registration('16400000-0000-0000-0000-000000000002');
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'offered' from public.event_waitlist_entries
    where id = pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004')),
  'AC-016.4.1: the next person on the list is offered the place that opened');

-- The 3 days pass without an answer. (Moved into the past directly: the deadline is a stored value.)
update public.event_waitlist_entries set offered_at = now() - interval '4 days',
       offer_expires_at = now() - interval '1 day'
 where id = pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004');

-- Nobody has written anything since; the lapsed offer is dealt with when A4 simply opens the page.
select pg_temp.act('16000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  (select waitlist_entry_id is null from public.get_open_event('16100000-0000-0000-0000-000000000001')),
  'AC-016.4.2: opening the event page after the deadline shows the offer is gone');
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'expired' from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000004')
  and (select status = 'offered' from public.event_waitlist_entries
        where event_id = '16100000-0000-0000-0000-000000000001'
          and attendee_id = '16000000-0000-0000-0000-000000000006'),
  'AC-016.4.2: the lapsed offer is recorded as expired and the place passes to the next person');

select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox
    where recipient_email = 'a4-us16@example.test' and subject like 'Your offer has expired for%US16 Flow Workshop'),
  'AC-016.4.3: the person whose offer lapsed is emailed');
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox
    where recipient_email = 'a6-us16@example.test' and subject like 'A place is available for%US16 Flow Workshop'),
  'AC-016.4.4: and the next person is emailed the offer');

select pg_temp.act('16000000-0000-0000-0000-000000000004');
select pg_temp.assert_true(
  (select status = 'expired' from public.list_my_waitlist() where event_id = '16100000-0000-0000-0000-000000000001'),
  'AC-016.4.5: My registrations still shows them that their offer expired');
select pg_temp.owner();

-- The next person also lets the deadline pass but clicks Accept first, with no page view between.
update public.event_waitlist_entries set offered_at = now() - interval '4 days',
       offer_expires_at = now() - interval '1 day'
 where id = pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000006');

create temp table us16_late_accept (registration_id uuid);
grant all on us16_late_accept to public;
select pg_temp.act('16000000-0000-0000-0000-000000000006');
insert into us16_late_accept
select public.accept_waitlist_offer(
  pg_temp.entry('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000006'),
  '96234567', null, null, false);
select pg_temp.owner();

select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(registration_id is null) from us16_late_accept)
  and (select status = 'expired' from public.event_waitlist_entries
        where event_id = '16100000-0000-0000-0000-000000000001'
          and attendee_id = '16000000-0000-0000-0000-000000000006')
  and not exists (select 1 from public.event_registrations
        where event_id = '16100000-0000-0000-0000-000000000001'
          and attendee_id = '16000000-0000-0000-0000-000000000006'),
  'AC-016.4.6: accepting after the deadline registers nothing, and the expiry is kept (not rolled back)');

-- Nobody is left waiting, so the free place goes back to ordinary registration.
select pg_temp.act('16000000-0000-0000-0000-000000000004');
select public.register_for_event('16100000-0000-0000-0000-000000000001', '94234567', null, null, false);
select pg_temp.owner();

select pg_temp.assert_true(
  (select count(*) = 2 from public.event_registrations
    where event_id = '16100000-0000-0000-0000-000000000001' and status = 'registered')
  and exists (select 1 from public.event_registrations
    where event_id = '16100000-0000-0000-0000-000000000001'
      and attendee_id = '16000000-0000-0000-0000-000000000004' and status = 'registered'),
  'AC-016.1.8: once nobody is waiting, a free place can be taken by ordinary registration');

-- Handing an offer back passes it on straight away.
select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.join_waitlist('16100000-0000-0000-0000-000000000010');
select pg_temp.act('16000000-0000-0000-0000-000000000003');
select public.join_waitlist('16100000-0000-0000-0000-000000000010');
select pg_temp.owner();
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
 where id = '16400000-0000-0000-0000-000000000015';
select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.leave_waitlist(pg_temp.entry('16100000-0000-0000-0000-000000000010', '16000000-0000-0000-0000-000000000002'));
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'left' from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000010' and attendee_id = '16000000-0000-0000-0000-000000000002')
  and (select status = 'offered' from public.event_waitlist_entries
        where event_id = '16100000-0000-0000-0000-000000000010' and attendee_id = '16000000-0000-0000-0000-000000000003'),
  'AC-016.4.7: leaving with an offer in hand passes the place to the next person');

-- ---------------------------------------------------------------------------
-- AC-016.3: the other ways a place opens, and when no offer is made
-- ---------------------------------------------------------------------------
select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.join_waitlist('16100000-0000-0000-0000-000000000005');
select pg_temp.owner();
update public.events set expected_attendance = 2 where id = '16100000-0000-0000-0000-000000000005';

select pg_temp.assert_true(
  (select status = 'offered' from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000005' and attendee_id = '16000000-0000-0000-0000-000000000002'),
  'AC-016.3.8: raising the event''s capacity offers the new place to the first person waiting');

select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.join_waitlist('16100000-0000-0000-0000-000000000006');
select pg_temp.owner();
update public.events set registration_required = false where id = '16100000-0000-0000-0000-000000000006';
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
 where id = '16400000-0000-0000-0000-000000000012';

select pg_temp.assert_true(
  (select status = 'waiting' and offered_at is null from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000006' and attendee_id = '16000000-0000-0000-0000-000000000002'),
  'AC-016.3.9: no offer is made while registration is switched off, even though a place opened');

update public.events set registration_required = true where id = '16100000-0000-0000-0000-000000000006';

select pg_temp.assert_true(
  (select status = 'offered' from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000006' and attendee_id = '16000000-0000-0000-0000-000000000002'),
  'AC-016.3.9: and switching registration back on makes the offer');

select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.join_waitlist('16100000-0000-0000-0000-000000000004');
select pg_temp.owner();
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
 where id = '16400000-0000-0000-0000-000000000014';

select pg_temp.assert_true(
  (select status = 'waiting' from public.event_waitlist_entries
    where event_id = '16100000-0000-0000-0000-000000000004' and attendee_id = '16000000-0000-0000-0000-000000000002'),
  'AC-016.3.10: no offer is made in the last 24 hours before the event starts');

select pg_temp.act('16000000-0000-0000-0000-000000000002');
select public.join_waitlist('16100000-0000-0000-0000-000000000009');
select pg_temp.owner();
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
 where id = '16400000-0000-0000-0000-000000000013';

select pg_temp.assert_true(
  (select w.status = 'offered' and w.offer_expires_at = e.proposed_start
     from public.event_waitlist_entries w join public.events e on e.id = w.event_id
    where w.event_id = '16100000-0000-0000-0000-000000000009' and w.attendee_id = '16000000-0000-0000-0000-000000000002'),
  'AC-016.3.11: an offer never lasts past the event start, so one made 36 hours out ends at the start, not in 3 days');
