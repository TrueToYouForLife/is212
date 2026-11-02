-- AC-041.1.3: run after each replay in the populated fixture's psql session.
-- Compare every column in both directions, including IDs, timestamps, source links,
-- independent reasons, resolution methods/notes/actors and notification attribution.
reset role;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.us41_replay_assert(
 not exists(
  (select * from public.arrangement_review_flags except all select * from us41_replay_flags_before)
  union all
  (select * from us41_replay_flags_before except all select * from public.arrangement_review_flags))
 and not exists(
  (select * from public.arrangement_review_notifications except all select * from us41_replay_notices_before)
  union all
  (select * from us41_replay_notices_before except all select * from public.arrangement_review_notifications)));
