-- US9 AC8: Venue Staff are notified when a booking request is submitted.
--
-- The trigger venue_bookings_notify_staff (0035) owns this, writing one
-- venue_booking_notifications row per Venue Staff member in the same transaction as the
-- submission. These checks are the database half of AC-009.8; the frontend cases in
-- venueBookingService.test.ts only prove the client never writes the row itself, which
-- is what makes this trigger the single source of it.
--
-- Covers the trigger's three guards (status must be pending_approval, a re-save must not
-- re-notify, the unique index absorbs a retry), who the recipients are, and the grants
-- and policies that stop a browser forging or reading someone else's notification.

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Two Venue Staff, one coordinator, one organiser. 0042 makes every new account an
-- attendee, so each role is set explicitly afterwards, as administrator.
insert into auth.users (id, email, raw_user_meta_data) values
 ('b9080000-0000-0000-0000-000000000001', 'vbn-staff-1@example.test', '{}'),
 ('b9080000-0000-0000-0000-000000000002', 'vbn-staff-2@example.test', '{}'),
 ('b9080000-0000-0000-0000-000000000003', 'vbn-coord@example.test', '{}'),
 ('b9080000-0000-0000-0000-000000000004', 'vbn-organiser@example.test', '{}');
update public.profiles set role = 'venue_staff'
 where id in ('b9080000-0000-0000-0000-000000000001', 'b9080000-0000-0000-0000-000000000002');
update public.profiles set role = 'coordinator' where id = 'b9080000-0000-0000-0000-000000000003';
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001'   where id = 'b9080000-0000-0000-0000-000000000004';

insert into public.venues (id, name, location, capacity, layout, status)
values ('b9080000-0000-0000-0000-000000000010', 'Notify Hall', 'Level 9', 150, 'Theatre', 'active');

insert into public.events (id, organiser_id, coordinator_id, purpose, name, reference,
                           proposed_start, proposed_end, expected_attendance, status)
select ('b9080000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b9080000-0000-0000-0000-000000000004',
       'b9080000-0000-0000-0000-000000000003',
       'Notification fixture', 'Notify event ' || n, 'EVT-VBN-' || n,
       '2045-03-01T13:00:00+08'::timestamptz + (n - 101) * interval '2 days',
       '2045-03-01T16:00:00+08'::timestamptz + (n - 101) * interval '2 days',
       80, 'approved'
from generate_series(101, 103) n;

-- How many Venue Staff exist in total, including any the earlier suites created. The
-- recipient count is asserted against this rather than against the literal 2, so another
-- suite adding a Venue Staff account cannot silently break these checks.
create temporary table vbn_staff as
 select id from public.profiles where role = 'venue_staff';

-- 201 starts held, so the held -> pending_approval transition can be exercised.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('b9080000-0000-0000-0000-000000000201', 'b9080000-0000-0000-0000-000000000101',
        'b9080000-0000-0000-0000-000000000010', 'b9080000-0000-0000-0000-000000000003',
        'held', now() + interval '1 hour');

-- 203 also starts held, and is cancelled rather than submitted.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status, hold_expires_at)
values ('b9080000-0000-0000-0000-000000000203', 'b9080000-0000-0000-0000-000000000103',
        'b9080000-0000-0000-0000-000000000010', 'b9080000-0000-0000-0000-000000000003',
        'held', now() + interval '1 hour');

select pg_temp.assert_true(
 not exists (select 1 from public.venue_booking_notifications
             where venue_booking_id = 'b9080000-0000-0000-0000-000000000201'),
 'AC-009.8.4: holding a venue notifies nobody — a hold is not yet a request to review');

-- The submission itself.
update public.venue_bookings set status = 'pending_approval'
 where id = 'b9080000-0000-0000-0000-000000000201';

select pg_temp.assert_true(
 (select count(*) from public.venue_booking_notifications
  where venue_booking_id = 'b9080000-0000-0000-0000-000000000201')
 = (select count(*) from vbn_staff),
 'AC-009.8.5: submitting a request notifies every Venue Staff member, one row each');

select pg_temp.assert_true(
 exists (select 1 from public.venue_booking_notifications
         where venue_booking_id = 'b9080000-0000-0000-0000-000000000201'
           and recipient_id = 'b9080000-0000-0000-0000-000000000001'
           and venue_id = 'b9080000-0000-0000-0000-000000000010'
           and created_at is not null
           and read_at is null),
 'AC-009.8.6: the notification carries the booking''s venue and starts unread');

select pg_temp.assert_true(
 not exists (select 1 from public.venue_booking_notifications n
             join public.profiles p on p.id = n.recipient_id
             where n.venue_booking_id = 'b9080000-0000-0000-0000-000000000201'
               and p.role <> 'venue_staff'),
 'AC-009.8.7: no one outside Venue Staff is made a recipient');

-- A booking created straight into pending_approval, which the trigger also fires on.
insert into public.venue_bookings (id, event_id, venue_id, requested_by, status)
values ('b9080000-0000-0000-0000-000000000202', 'b9080000-0000-0000-0000-000000000102',
        'b9080000-0000-0000-0000-000000000010', 'b9080000-0000-0000-0000-000000000003',
        'pending_approval');

select pg_temp.assert_true(
 (select count(*) from public.venue_booking_notifications
  where venue_booking_id = 'b9080000-0000-0000-0000-000000000202')
 = (select count(*) from vbn_staff),
 'AC-009.8.8: a request inserted directly as pending_approval is notified too, not only an update');

-- Boundary: a status change that is not a submission.
update public.venue_bookings set status = 'cancelled'
 where id = 'b9080000-0000-0000-0000-000000000203';

select pg_temp.assert_true(
 not exists (select 1 from public.venue_booking_notifications
             where venue_booking_id = 'b9080000-0000-0000-0000-000000000203'),
 'AC-009.8.9: a status change other than pending_approval notifies nobody');

-- Idempotency: re-saving a request already under review must not notify again. Two
-- guards cover this — the old.status check short-circuits, and the unique index would
-- absorb it even if that check were removed.
update public.venue_bookings set status = 'pending_approval'
 where id = 'b9080000-0000-0000-0000-000000000201';
update public.venue_bookings set review_note = 'Chasing this up'
 where id = 'b9080000-0000-0000-0000-000000000201';

select pg_temp.assert_true(
 (select count(*) from public.venue_booking_notifications
  where venue_booking_id = 'b9080000-0000-0000-0000-000000000201')
 = (select count(*) from vbn_staff),
 'AC-009.8.10: re-saving a request already under review creates no second notification');

select pg_temp.expect_error(
 $q$insert into public.venue_booking_notifications (venue_booking_id, venue_id, recipient_id)
    values ('b9080000-0000-0000-0000-000000000201', 'b9080000-0000-0000-0000-000000000010',
            'b9080000-0000-0000-0000-000000000001')$q$,
 '23505',
 'AC-009.8.11: the unique index refuses a duplicate notification for the same recipient');

-- RLS and grants. Venue Staff read their own; nobody writes from the browser.
set role authenticated;

select pg_temp.as_user('b9080000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
 (select count(*) from public.venue_booking_notifications
  where venue_booking_id = 'b9080000-0000-0000-0000-000000000201') = 1,
 'AC-009.8.12: a Venue Staff member reads the notification addressed to them');

select pg_temp.assert_true(
 not exists (select 1 from public.venue_booking_notifications
             where recipient_id = 'b9080000-0000-0000-0000-000000000002'),
 'AC-009.8.13: one Venue Staff member cannot read another''s notifications');

select pg_temp.as_user('b9080000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
 not exists (select 1 from public.venue_booking_notifications),
 'AC-009.8.14: a coordinator cannot read Venue Staff notifications');

-- The browser has no write path at all: the trigger is the only author, which is what
-- the frontend cases in venueBookingService.test.ts rely on being true.
select pg_temp.as_user('b9080000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
 $q$insert into public.venue_booking_notifications (venue_booking_id, venue_id, recipient_id)
    values ('b9080000-0000-0000-0000-000000000202', 'b9080000-0000-0000-0000-000000000010',
            'b9080000-0000-0000-0000-000000000001')$q$,
 '42501',
 'AC-009.8.15: a signed-in Venue Staff member cannot insert a notification');

select pg_temp.expect_error(
 $q$delete from public.venue_booking_notifications
    where venue_booking_id = 'b9080000-0000-0000-0000-000000000201'$q$,
 '42501',
 'AC-009.8.16: a notification cannot be deleted from the browser, only marked read');

-- Marking read is the one update Venue Staff may make, and only on their own row.
update public.venue_booking_notifications set read_at = now()
 where venue_booking_id = 'b9080000-0000-0000-0000-000000000201'
   and recipient_id = 'b9080000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
 (select read_at is not null from public.venue_booking_notifications
  where venue_booking_id = 'b9080000-0000-0000-0000-000000000201'
    and recipient_id = 'b9080000-0000-0000-0000-000000000001'),
 'AC-009.8.17: a Venue Staff member can mark their own notification read');

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- The row belongs to the booking: removing the booking removes its notifications rather
-- than leaving Venue Staff a notice pointing at nothing.
delete from public.venue_bookings where id = 'b9080000-0000-0000-0000-000000000202';
select pg_temp.assert_true(
 not exists (select 1 from public.venue_booking_notifications
             where venue_booking_id = 'b9080000-0000-0000-0000-000000000202'),
 'AC-009.8.18: deleting a booking removes its notifications');
