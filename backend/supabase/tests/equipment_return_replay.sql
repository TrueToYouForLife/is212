-- Snapshot helper persists only in the current disposable psql session.
create or replace function pg_temp.us24_replay_snapshot() returns jsonb language sql as $$
select jsonb_build_array(
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_return_inspections t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_defect_reports t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_status_changes t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_bookings t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_booking_lines t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.events t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_notifications t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.notification_outbox t)); $$;
create temp table us24_replay_before as select pg_temp.us24_replay_snapshot() value;
