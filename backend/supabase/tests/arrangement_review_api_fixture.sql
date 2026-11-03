-- Additional API fixtures after arrangement_review_replay_fixture.sql.
-- Synthetic rows only; do not load into shared Supabase.
insert into auth.users(id,email,raw_user_meta_data) values
 ('41910000-0000-0000-0000-000000000003','us41-api-other@example.test','{"full_name":"Other Coordinator"}'),
 ('41910000-0000-0000-0000-000000000004','us41-api-venue@example.test','{"full_name":"Venue Staff"}');
update public.profiles set role='coordinator' where id='41910000-0000-0000-0000-000000000003';
update public.profiles set role='venue_staff' where id='41910000-0000-0000-0000-000000000004';
insert into public.venues(id,name,location,capacity,layout)
values('41930000-0000-0000-0000-000000000002','API Replacement Hall','Test',100,'theatre');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
values('41940000-0000-0000-0000-000000000002','41920000-0000-0000-0000-000000000001',
 '41930000-0000-0000-0000-000000000002','41910000-0000-0000-0000-000000000002','confirmed');
-- Distinct original/replacement names catch accidentally selecting the replacement FK.
update public.arrangement_review_flags
 set replacement_booking_id='41940000-0000-0000-0000-000000000002'
 where change_request_id='41960000-0000-0000-0000-000000000001' and reason_code='venue_capacity';
insert into public.events(id,organiser_id,coordinator_id,name,purpose,status,
 proposed_start,proposed_end,expected_attendance)
values('41920000-0000-0000-0000-000000000002','41910000-0000-0000-0000-000000000001',
 '41910000-0000-0000-0000-000000000002','US41 API empty fixture','Empty reviews','approved',
 '2045-01-11 09:00+08','2045-01-11 11:00+08',50);

-- PostgREST 12 sets request.jwt.claims; legacy SQL runners use request.jwt.claim.sub.
-- Adapt only the disposable Auth stub, retaining real application RLS and functions.
create or replace function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
