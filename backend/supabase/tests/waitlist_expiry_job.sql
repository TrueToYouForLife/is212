-- US16 SCRUM-153: the scheduled job that expires waiting-list offers. Disposable PostgreSQL only; run
-- through the database test runner, after waitlist_override.sql, whose helpers (pg_temp.act,
-- pg_temp.owner, pg_temp.entry) it reuses. The cron schedule itself needs the pg_cron extension, which
-- the disposable database does not have, so these tests call the function the schedule runs.
-- Fixtures are this file's own (ids start 19).
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Users: 01-03 A1-A3 attendees; 04 O1 organiser.
insert into auth.users (id, email, raw_user_meta_data) values
  ('19000000-0000-0000-0000-000000000001', 'a1-us16j@example.test', '{"full_name":"Ann One"}'),
  ('19000000-0000-0000-0000-000000000002', 'a2-us16j@example.test', '{"full_name":"Ben Two"}'),
  ('19000000-0000-0000-0000-000000000003', 'a3-us16j@example.test', '{"full_name":"Cal Three"}'),
  ('19000000-0000-0000-0000-000000000004', 'o1-us16j@example.test', '{"full_name":"Olive Org"}');
update public.profiles set role = 'organiser', client_org_id = '0c0a0000-0000-4000-8000-000000000001' where id = '19000000-0000-0000-0000-000000000004';

-- 01 E-JOB and 02 E-OFF: both Confirmed with capacity 1, A1 holding the only place.
insert into public.events (id, organiser_id, name, purpose, event_type, proposed_start, proposed_end,
  expected_attendance, registration_required, status)
values
  ('19100000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000004', 'US16 Job Workshop',
   'Workshop', 'Workshop', '2035-05-10 01:00+00', '2035-05-10 09:00+00', 1, true, 'confirmed'),
  ('19100000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000004', 'US16 Off Seminar',
   'Seminar', 'Seminar', '2035-05-11 01:00+00', '2035-05-11 09:00+00', 1, true, 'confirmed');
insert into public.event_registrations (id, event_id, attendee_id, phone) values
  ('19400000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', '91234567'),
  ('19400000-0000-0000-0000-000000000002', '19100000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001', '91234567');

-- A2 then A3 join both full events. A1 withdraws, so A2 is offered the place on each.
select pg_temp.act('19000000-0000-0000-0000-000000000002');
select public.join_waitlist('19100000-0000-0000-0000-000000000001');
select public.join_waitlist('19100000-0000-0000-0000-000000000002');
select pg_temp.act('19000000-0000-0000-0000-000000000003');
select public.join_waitlist('19100000-0000-0000-0000-000000000001');
select public.join_waitlist('19100000-0000-0000-0000-000000000002');
select pg_temp.owner();
update public.event_registrations set status = 'withdrawn', withdrawn_at = now()
 where id in ('19400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- AC-016.4: the timer passes a lapsed offer on with nobody touching the event
-- ---------------------------------------------------------------------------
-- Nothing has lapsed yet, so the job has nothing to do.
create temp table us16_job_idle as select public.process_overdue_waitlists() as processed;
select pg_temp.assert_true(
  (select processed = 0 from us16_job_idle)
  and (select status = 'offered' from public.event_waitlist_entries
        where event_id = '19100000-0000-0000-0000-000000000001' and attendee_id = '19000000-0000-0000-0000-000000000002'),
  'AC-016.4.19: with no offer past its deadline the job does nothing and leaves open offers alone');

-- E-OFF has registration switched off while its offer is still open. (Done before the offers lapse:
-- switching it off runs the expiry rules at once, which would clear a lapsed offer before the job.)
update public.events set registration_required = false where id = '19100000-0000-0000-0000-000000000002';

-- The 3 days pass on both events, and nobody opens either page.
update public.event_waitlist_entries set offered_at = now() - interval '4 days',
       offer_expires_at = now() - interval '1 day'
 where status = 'offered' and event_id in ('19100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000002');

create temp table us16_job_run as select public.process_overdue_waitlists() as processed;

select pg_temp.assert_true(
  (select processed = 2 from us16_job_run)
  and (select status = 'expired' from public.event_waitlist_entries
        where event_id = '19100000-0000-0000-0000-000000000001' and attendee_id = '19000000-0000-0000-0000-000000000002')
  and (select status = 'offered' and offer_expires_at > now() + interval '2 days' from public.event_waitlist_entries
        where event_id = '19100000-0000-0000-0000-000000000001' and attendee_id = '19000000-0000-0000-0000-000000000003'),
  'AC-016.4.20: the job expires a lapsed offer and offers the place to the next person, with a fresh 3 days');

select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_outbox
    where recipient_email = 'a2-us16j@example.test' and subject like 'Your offer has expired for%US16 Job Workshop')
  and (select count(*) = 1 from public.notification_outbox
        where recipient_email = 'a3-us16j@example.test' and subject like 'A place is available for%US16 Job Workshop'),
  'AC-016.4.21: the job queues both emails, so the person who lost the place and the next person are told');

select pg_temp.assert_true(
  (select status = 'expired' from public.event_waitlist_entries
    where event_id = '19100000-0000-0000-0000-000000000002' and attendee_id = '19000000-0000-0000-0000-000000000002')
  and (select status = 'waiting' and offered_at is null from public.event_waitlist_entries
        where event_id = '19100000-0000-0000-0000-000000000002' and attendee_id = '19000000-0000-0000-0000-000000000003'),
  'AC-016.4.22: for an event whose registration is off, the lapsed offer is expired but nobody new is offered');

-- Running it again straight away changes nothing: the next person's offer is not touched.
create temp table us16_job_again as select public.process_overdue_waitlists() as processed;
select pg_temp.assert_true(
  (select processed = 0 from us16_job_again)
  and (select status = 'offered' from public.event_waitlist_entries
        where event_id = '19100000-0000-0000-0000-000000000001' and attendee_id = '19000000-0000-0000-0000-000000000003')
  and (select count(*) = 1 from public.notification_outbox
        where recipient_email = 'a3-us16j@example.test' and subject like 'A place is available for%US16 Job Workshop'),
  'AC-016.4.23: running the job again is safe: it finds nothing, and sends no second email');

-- The job is for the database's timer, not for the browser.
select pg_temp.act('19000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($q$select public.process_overdue_waitlists()$q$,
  '42501', 'AC-016.4.24: an attendee cannot call the job directly');
select pg_temp.owner();
reset role;
set role anon;
select pg_temp.expect_error($q$select public.process_overdue_waitlists()$q$,
  '42501', 'AC-016.4.24: nor a visitor who is not signed in');
reset role;
