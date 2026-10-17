-- US16 SCRUM-154: the assigned Coordinator overrides the waiting-list order. Disposable PostgreSQL
-- only; run through the database test runner, straight after waiting_list.sql, whose helpers
-- (pg_temp.act, pg_temp.owner, pg_temp.entry) it reuses. Fixtures are this file's own (ids start 18).
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------------
-- Fixtures (database owner, no JWT)
-- ---------------------------------------------------------------------------
-- Users: 01-06 A1-A6 attendees; 07 O1 organiser; 08 C1 coordinator (assigned);
-- 09 C2 coordinator (not assigned); 10 L1 coordinator lead.
insert into auth.users (id, email, raw_user_meta_data) values
  ('18000000-0000-0000-0000-000000000001', 'a1-us16o@example.test', '{"full_name":"Ann One"}'),
  ('18000000-0000-0000-0000-000000000002', 'a2-us16o@example.test', '{"full_name":"Ben Two"}'),
  ('18000000-0000-0000-0000-000000000003', 'a3-us16o@example.test', '{"full_name":"Cal Three"}'),
  ('18000000-0000-0000-0000-000000000004', 'a4-us16o@example.test', '{"full_name":"Dee Four"}'),
  ('18000000-0000-0000-0000-000000000005', 'a5-us16o@example.test', '{"full_name":"Eli Five"}'),
  ('18000000-0000-0000-0000-000000000006', 'a6-us16o@example.test', '{"full_name":"Fay Six"}'),
  ('18000000-0000-0000-0000-000000000007', 'o1-us16o@example.test', '{"full_name":"Olive Org"}'),
  ('18000000-0000-0000-0000-000000000008', 'c1-us16o@example.test', '{"full_name":"Cory Coord"}'),
  ('18000000-0000-0000-0000-000000000009', 'c2-us16o@example.test', '{"full_name":"Cleo Coord"}'),
  ('18000000-0000-0000-0000-000000000010', 'l1-us16o@example.test', '{"full_name":"Lena Lead"}');
update public.profiles set role = 'organiser' where id = '18000000-0000-0000-0000-000000000007';
update public.profiles set role = 'coordinator'
 where id in ('18000000-0000-0000-0000-000000000008', '18000000-0000-0000-0000-000000000009');
update public.profiles set role = 'coordinator_lead' where id = '18000000-0000-0000-0000-000000000010';

-- 01 E-ORDER confirmed, capacity 1, assigned to C1       02 E-APPROVED approved, assigned to C1
insert into public.events (id, organiser_id, coordinator_id, name, purpose, event_type, proposed_start,
  proposed_end, expected_attendance, registration_required, status)
values
  ('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000007', '18000000-0000-0000-0000-000000000008',
   'US16 Order Workshop', 'Workshop', 'Workshop', '2035-04-10 01:00+00', '2035-04-10 09:00+00', 1, true, 'confirmed'),
  ('18100000-0000-0000-0000-000000000002', '18000000-0000-0000-0000-000000000007', '18000000-0000-0000-0000-000000000008',
   'US16 Approved Fair', 'Fair', 'Fair', '2035-04-11 01:00+00', '2035-04-11 09:00+00', 1, true, 'approved');

-- A1 holds the only place of E-ORDER; A2 to A5 then join the full event in that order.
insert into public.event_registrations (id, event_id, attendee_id, phone) values
  ('18400000-0000-0000-0000-000000000001', '18100000-0000-0000-0000-000000000001',
   '18000000-0000-0000-0000-000000000001', '91234567');

select pg_temp.act('18000000-0000-0000-0000-000000000002');
select public.join_waitlist('18100000-0000-0000-0000-000000000001');
select pg_temp.act('18000000-0000-0000-0000-000000000003');
select public.join_waitlist('18100000-0000-0000-0000-000000000001');
select pg_temp.act('18000000-0000-0000-0000-000000000004');
select public.join_waitlist('18100000-0000-0000-0000-000000000001');
select pg_temp.act('18000000-0000-0000-0000-000000000005');
select public.join_waitlist('18100000-0000-0000-0000-000000000001');
select pg_temp.owner();

-- An entry on an event that is not Confirmed, to show the status rule.
insert into public.event_waitlist_entries (id, event_id, attendee_id) values
  ('18500000-0000-0000-0000-000000000001', '18100000-0000-0000-0000-000000000002', '18000000-0000-0000-0000-000000000002'),
  ('18500000-0000-0000-0000-000000000002', '18100000-0000-0000-0000-000000000002', '18000000-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- AC-016.2: the Coordinator reads the list and overrides its order
-- ---------------------------------------------------------------------------
select pg_temp.act('18000000-0000-0000-0000-000000000008');
select pg_temp.assert_true(
  (select array_agg(attendee_name order by queue_position)
     from public.list_event_waitlist('18100000-0000-0000-0000-000000000001'))
    = array['Ben Two', 'Cal Three', 'Dee Four', 'Eli Five'],
  'AC-016.2.14: the assigned Coordinator sees the waiting list in first-come-first-served order');
select pg_temp.assert_true(
  not exists (select 1 from pg_proc p, unnest(p.proargnames) as arg(name)
               where p.oid = 'public.list_event_waitlist(uuid)'::regprocedure
                 and arg.name in ('email', 'attendee_email', 'attendee_id', 'phone')),
  'AC-016.2.14: and the list shows names only, with no email address or id of the attendee');
select pg_temp.owner();

-- Dee Four to the front, then Eli Five up one, then Dee Four down one.
select pg_temp.act('18000000-0000-0000-0000-000000000008');
select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000004'), 'front');
select pg_temp.assert_true(
  (select array_agg(attendee_name order by queue_position)
     from public.list_event_waitlist('18100000-0000-0000-0000-000000000001') where status = 'waiting')
    = array['Dee Four', 'Ben Two', 'Cal Three', 'Eli Five'],
  'AC-016.2.15: move to front puts that person first and keeps everyone else in order');

select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000005'), 'up');
select pg_temp.assert_true(
  (select array_agg(attendee_name order by queue_position)
     from public.list_event_waitlist('18100000-0000-0000-0000-000000000001') where status = 'waiting')
    = array['Dee Four', 'Ben Two', 'Eli Five', 'Cal Three'],
  'AC-016.2.16: move up swaps with the person directly ahead');

select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000004'), 'down');
select pg_temp.assert_true(
  (select array_agg(attendee_name order by queue_position)
     from public.list_event_waitlist('18100000-0000-0000-0000-000000000001') where status = 'waiting')
    = array['Ben Two', 'Dee Four', 'Eli Five', 'Cal Three'],
  'AC-016.2.17: move down swaps with the person directly behind');

-- The ends of the queue: nothing to do, and nothing breaks.
select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000002'), 'front');
select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000002'), 'up');
select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003'), 'down');
select pg_temp.assert_true(
  (select array_agg(attendee_name order by queue_position)
     from public.list_event_waitlist('18100000-0000-0000-0000-000000000001') where status = 'waiting')
    = array['Ben Two', 'Dee Four', 'Eli Five', 'Cal Three'],
  'AC-016.2.18: moving the first person up or to the front, or the last down, changes nothing and is not an error');
select pg_temp.owner();

-- Attendees see their new place; the true join order is still on record.
select pg_temp.act('18000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  (select waitlist_position = 4 from public.get_open_event('18100000-0000-0000-0000-000000000001')),
  'AC-016.2.19: an attendee sees their new position after the Coordinator moves people');
select pg_temp.act('18000000-0000-0000-0000-000000000005');
select pg_temp.assert_true(
  (select waitlist_position = 3 from public.get_open_event('18100000-0000-0000-0000-000000000001')),
  'AC-016.2.19: and so does everyone else');
select pg_temp.owner();

select pg_temp.assert_true(
  (select array_agg(attendee_id order by joined_at)
     from public.event_waitlist_entries where event_id = '18100000-0000-0000-0000-000000000001')
    = array['18000000-0000-0000-0000-000000000002'::uuid, '18000000-0000-0000-0000-000000000003'::uuid,
            '18000000-0000-0000-0000-000000000004'::uuid, '18000000-0000-0000-0000-000000000005'::uuid],
  'AC-016.2.20: when each person actually joined is unchanged by the moves');

select pg_temp.assert_true(
  (select bool_and(overridden_by = '18000000-0000-0000-0000-000000000008' and overridden_at is not null)
     from public.event_waitlist_entries
    where event_id = '18100000-0000-0000-0000-000000000001'
      and attendee_id in ('18000000-0000-0000-0000-000000000004', '18000000-0000-0000-0000-000000000005'))
  and (select bool_and(overridden_by is null and overridden_at is null)
         from public.event_waitlist_entries
        where event_id = '18100000-0000-0000-0000-000000000001'
          and attendee_id in ('18000000-0000-0000-0000-000000000002', '18000000-0000-0000-0000-000000000003')),
  'AC-016.2.21: each entry that was moved records which Coordinator moved it and when; the others do not');

-- ---------------------------------------------------------------------------
-- AC-016.2: refusals
-- ---------------------------------------------------------------------------
select pg_temp.act('18000000-0000-0000-0000-000000000009');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, 'front')$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '42501', 'AC-016.2.22: a Coordinator who is not assigned to the event cannot reorder its list');
select pg_temp.expect_error(
  $q$select * from public.list_event_waitlist('18100000-0000-0000-0000-000000000001')$q$,
  '42501', 'AC-016.2.22: nor read it');
select pg_temp.act('18000000-0000-0000-0000-000000000010');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, 'front')$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '42501', 'AC-016.2.23: a Coordinator Lead cannot reorder it');
select pg_temp.act('18000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, 'front')$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '42501', 'AC-016.2.23: an attendee cannot move even their own entry');
select pg_temp.act('18000000-0000-0000-0000-000000000007');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, 'front')$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '42501', 'AC-016.2.23: nor the event''s Organiser');
select pg_temp.owner();
reset role;
set role anon;
select pg_temp.expect_error(
  $q$select public.move_waitlist_entry('18500000-0000-0000-0000-000000000001', 'front')$q$,
  '42501', 'AC-016.2.23: nor a visitor who is not signed in');
reset role;

select pg_temp.act('18000000-0000-0000-0000-000000000008');
select pg_temp.expect_error(
  $q$select public.move_waitlist_entry('18999999-0000-0000-0000-000000000000', 'front')$q$,
  '42501', 'AC-016.2.24: an entry that does not exist is refused the same way, so ids cannot be probed');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, 'sideways')$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '22023', 'AC-016.2.25: a move other than front, up or down is refused');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, null)$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '22023', 'AC-016.2.25: and so is a missing one');
select pg_temp.expect_error(
  $q$select public.move_waitlist_entry('18500000-0000-0000-0000-000000000002', 'front')$q$,
  '22000', 'AC-016.2.26: an event that is not Confirmed cannot have its list reordered');
select pg_temp.owner();

select pg_temp.assert_true(
  (select array_agg(p.full_name order by w.queue_key, w.id)
     from public.event_waitlist_entries w join public.profiles p on p.id = w.attendee_id
    where w.event_id = '18100000-0000-0000-0000-000000000001' and w.status = 'waiting')
    = array['Ben Two', 'Dee Four', 'Eli Five', 'Cal Three'],
  'AC-016.2.27: none of the refused attempts changed the order');

-- ---------------------------------------------------------------------------
-- AC-016.3: the next offer follows the new order
-- ---------------------------------------------------------------------------
-- Cal Three is last. The Coordinator moves them to the front; then A1 withdraws and the place opens.
select pg_temp.act('18000000-0000-0000-0000-000000000008');
select public.move_waitlist_entry(pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003'), 'front');
select pg_temp.owner();
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
 where id = '18400000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  (select status = 'offered' from public.event_waitlist_entries
    where event_id = '18100000-0000-0000-0000-000000000001' and attendee_id = '18000000-0000-0000-0000-000000000003')
  and (select count(*) = 3 and bool_and(status = 'waiting') from public.event_waitlist_entries
        where event_id = '18100000-0000-0000-0000-000000000001'
          and attendee_id <> '18000000-0000-0000-0000-000000000003'),
  'AC-016.3.24: the place that opens goes to whoever the Coordinator moved to the front, not to the earliest joiner');

-- Someone who joins after the override still goes to the back.
select pg_temp.act('18000000-0000-0000-0000-000000000006');
select public.join_waitlist('18100000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select waitlist_position = 4 from public.get_open_event('18100000-0000-0000-0000-000000000001')),
  'AC-016.3.25: a person who joins after the overrides goes to the back of the line');
select pg_temp.owner();

-- Someone who already holds an offered place is not part of the queue and cannot be moved.
select pg_temp.act('18000000-0000-0000-0000-000000000008');
select pg_temp.expect_error(
  format($q$select public.move_waitlist_entry(%L, 'down')$q$,
    pg_temp.entry('18100000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000003')),
  '55000', 'AC-016.3.26: a person who already holds an offered place cannot be moved');
select pg_temp.assert_true(
  (select status = 'offered' and queue_position is null
     from public.list_event_waitlist('18100000-0000-0000-0000-000000000001') where attendee_name = 'Cal Three')
  and (select array_agg(attendee_name order by queue_position)
         from public.list_event_waitlist('18100000-0000-0000-0000-000000000001') where status = 'waiting')
        = array['Ben Two', 'Dee Four', 'Eli Five', 'Fay Six'],
  'AC-016.3.26: the held place is listed apart from the queue, which keeps its order');
select pg_temp.owner();

-- ---------------------------------------------------------------------------
-- AC-016.4: an offer that was not accepted in time, seen from the Coordinator's list
-- ---------------------------------------------------------------------------
update public.event_waitlist_entries set offered_at = now() - interval '4 days',
       offer_expires_at = now() - interval '1 day'
 where event_id = '18100000-0000-0000-0000-000000000001' and attendee_id = '18000000-0000-0000-0000-000000000003';

select pg_temp.act('18000000-0000-0000-0000-000000000008');
select pg_temp.assert_true(
  (select count(*) = 0 from public.list_event_waitlist('18100000-0000-0000-0000-000000000001')
    where attendee_name = 'Cal Three'),
  'AC-016.4.16: opening the Coordinator''s list after the deadline clears the lapsed offer');
select pg_temp.owner();

select pg_temp.assert_true(
  (select status = 'expired' from public.event_waitlist_entries
    where event_id = '18100000-0000-0000-0000-000000000001' and attendee_id = '18000000-0000-0000-0000-000000000003')
  and (select status = 'offered' from public.event_waitlist_entries
        where event_id = '18100000-0000-0000-0000-000000000001' and attendee_id = '18000000-0000-0000-0000-000000000002'),
  'AC-016.4.16: and the place passes to the next person in the Coordinator''s order');
