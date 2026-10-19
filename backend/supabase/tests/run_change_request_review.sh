#!/usr/bin/env bash
set -euo pipefail

# Never targets a configured Supabase project: no .env, ports or host volumes.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="is212-review-test-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null

ready=false
for attempt in {1..30}; do
  # -h 127.0.0.1: the image's temporary setup server answers only on its socket, so
  # waiting on TCP waits for the real server and avoids a restart race.
  if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Temporary database did not become ready.' >&2; exit 1; fi

{
  cat "$repo_root/supabase/tests/bootstrap.sql"
  for migration in "$repo_root"/supabase/migrations/*.sql; do cat "$migration"; printf '\n'; done
  cat "$repo_root/supabase/tests/change_request_review.sql"
  cat "$repo_root/supabase/migrations/0008_change_request_review.sql"
  # Restore the current assignment rules after the historical migration replay.
  cat "$repo_root/supabase/migrations/0038_coordinator_lead_assignment.sql"
  cat "$repo_root/supabase/migrations/0039_coordinator_reassignment.sql"
  # Replay later replacements too: replaying 0008 alone would restore an old RPC.
  cat "$repo_root/supabase/migrations/0010_change_request_field_clarification.sql"
  # ... and 0010 alone restores the string-only RPC, which refuses the code lists the
  # requirement fields now hold. Same reason as the 0038/0039 restore above: a historical
  # replay must not leave an obsolete function in place for the tests that follow.
  cat "$repo_root/supabase/migrations/0013_change_request_replies.sql"
  cat "$repo_root/supabase/migrations/0055_change_request_structured_requirements.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_change_requests except select * from requests_before_repeat)
    union all (select * from requests_before_repeat except select * from public.event_change_requests)),
  'AC-007.13.3: rerunning migration preserves saved review decisions');
SQL
  cat "$repo_root/supabase/tests/change_request_field_clarification.sql"
  cat "$repo_root/supabase/migrations/0010_change_request_field_clarification.sql"
  cat "$repo_root/supabase/migrations/0013_change_request_replies.sql"
  cat "$repo_root/supabase/migrations/0055_change_request_structured_requirements.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_change_requests except select * from field_reviews_before_repeat)
    union all (select * from field_reviews_before_repeat except select * from public.event_change_requests)),
  'AC-007.13.5: rerunning field clarification migration preserves existing and provisional decisions');
SQL
  # Reproduce the shared table's differently named legacy constraint. NOT VALID
  # allows existing reviewed fixtures but still rejects new updates to these states.
  cat <<'SQL'
alter table public.event_change_requests add constraint event_change_requests_status_valid
  check (status in ('submitted','approved','rejected','withdrawn')) not valid;
do $$ begin
  begin
    update public.event_change_requests set status='clarification_requested'
      where id='20000000-0000-0000-0000-000000000001';
  exception when check_violation then return;
  end;
  raise exception 'Legacy constraint fixture did not reproduce the failure';
end $$;
SQL
  cat "$repo_root/supabase/migrations/0011_change_request_legacy_status_constraint.sql"
  cat "$repo_root/supabase/migrations/0011_change_request_legacy_status_constraint.sql"
  cat "$repo_root/supabase/tests/change_request_legacy_status_constraint.sql"
  cat "$repo_root/supabase/tests/direct_event_review.sql"
  cat "$repo_root/supabase/migrations/0013_change_request_replies.sql"
  cat "$repo_root/supabase/migrations/0055_change_request_structured_requirements.sql"
  cat "$repo_root/supabase/tests/change_request_replies.sql"
  echo 'create temp table replies_before_repeat as select * from public.event_change_requests;'
  cat "$repo_root/supabase/migrations/0013_change_request_replies.sql"
  cat "$repo_root/supabase/migrations/0055_change_request_structured_requirements.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_change_requests except select * from replies_before_repeat)
    union all (select * from replies_before_repeat except select * from public.event_change_requests)),
  'AC-007.13.8: replaying the reply migration preserves versions questions and answer history');
SQL
  cat "$repo_root/supabase/tests/change_request_revalidation.sql"
  echo 'create temp table revalidation_before_repeat as select * from public.event_change_revalidations;'
  cat "$repo_root/supabase/migrations/0015_change_request_revalidation.sql"
  # 0015 restores the revalidation trigger without facilityRequirements in its significant
  # list, so put the current one back â€” same reason as the 0038/0039 and 0013 restores.
  cat "$repo_root/supabase/migrations/0055_change_request_structured_requirements.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_change_revalidations except select * from revalidation_before_repeat)
    union all (select * from revalidation_before_repeat except select * from public.event_change_revalidations)),
  'AC-007.12.19: replaying the hook migration preserves existing pending checks');
SQL
  cat "$repo_root/supabase/tests/change_request_notifications.sql"
  echo 'create temp table notifications_before_repeat as select * from public.change_request_notifications;'
  echo 'create temp table notification_settings_before_repeat as select * from public.change_request_notification_settings;'
  cat "$repo_root/supabase/migrations/0016_change_request_notifications.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.change_request_notifications except select * from notifications_before_repeat)
    union all (select * from notifications_before_repeat except select * from public.change_request_notifications))
  and not exists ((select * from public.change_request_notification_settings except select * from notification_settings_before_repeat)
    union all (select * from notification_settings_before_repeat except select * from public.change_request_notification_settings)),
  'AC-007.1.18: migration replay preserves notifications and channel settings');
SQL
  cat "$repo_root/supabase/tests/change_request_review_history.sql"
  echo 'create temp table history_before_replay as select * from public.event_change_review_history;'
  cat "$repo_root/supabase/migrations/0017_change_request_review_history.sql"
  cat <<'SQL'
select pg_temp.assert_true(not exists(
 (select * from public.event_change_review_history except select * from history_before_replay)
 union all (select * from history_before_replay except select * from public.event_change_review_history)),
 'AC-007.13.26: migration replay preserves review history');
SQL
  # Equipment (SCRUM-19) first; venue_suitability.sql resets the test user itself.
  cat "$repo_root/supabase/tests/equipment_requirements.sql"
  cat "$repo_root/supabase/tests/equipment_reservations.sql"
  # US18 venue suitability: tests, then replay each migration and check nothing changed.
  cat "$repo_root/supabase/tests/venue_suitability.sql"
  cat "$repo_root/supabase/migrations/0020_venue_accessibility_array.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.venues except select * from venues_before_replay)
    union all (select * from venues_before_replay except select * from public.venues)),
  'AC-018.3.4: replaying the accessibility migration changes no venue');
SQL
  cat "$repo_root/supabase/migrations/0021_layout_types.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.layout_types except select * from layout_types_before_replay)
    union all (select * from layout_types_before_replay except select * from public.layout_types)),
  'AC-018.3.10: replaying the layout catalogue migration changes nothing');
SQL
  cat "$repo_root/supabase/migrations/0022_venue_layouts.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  (select array_agg(venue_id::text || ':' || layout || ':' || capacity) from
     (select * from public.venue_layouts except select * from venue_layouts_before_replay) added)
   = array['b18a0000-0000-0000-0000-0000000000f9:boardroom:25'],
  'AC-018.3.20: the migration fills in the primary layout of a venue that existed before it');
select pg_temp.assert_true(
  not exists (select * from venue_layouts_before_replay except select * from public.venue_layouts),
  'AC-018.3.21: replaying the layout migration changes no existing capacity');
SQL
  cat "$repo_root/supabase/migrations/0023_event_venue_requirements.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.event_venue_requirements except select * from requirements_before_replay)
    union all (select * from requirements_before_replay except select * from public.event_venue_requirements)),
  'AC-018.3.25: replaying the requirements migration changes no saved requirements');
SQL
  cat "$repo_root/supabase/tests/venue_shape_repair.sql"
  cat "$repo_root/supabase/migrations/0019a_reconcile_venue_columns.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  (select data_type = 'text' from information_schema.columns
   where table_schema = 'public' and table_name = 'venues' and column_name = 'layout')
  and (select layout::text = 'Hall' from public.venues where id = 'b18a0000-0000-0000-0000-0000000000d1'),
  'AC-018.3.35: a venue''s layout list becomes its first listed layout, as text');
select pg_temp.assert_true(
  (select data_type = 'jsonb' from information_schema.columns
   where table_schema = 'public' and table_name = 'venues' and column_name = 'facility')
  and (select to_jsonb(facility) = '{"projector": true, "wifi": true}'::jsonb from public.venues
       where id = 'b18a0000-0000-0000-0000-0000000000d1'),
  'AC-018.3.36: a list of facility names becomes the catalogue codes the app matches on');
select pg_temp.assert_true(
  (select layout::text = 'unspecified' and to_jsonb(facility) = '{}'::jsonb from public.venues
   where id = 'b18a0000-0000-0000-0000-0000000000d2')
  and (select is_nullable = 'NO' from information_schema.columns
       where table_schema = 'public' and table_name = 'venues' and column_name = 'layout'),
  'AC-018.3.37: an empty layout list becomes "unspecified" and layout is required again');
create temp table venues_after_repair as select * from public.venues;
SQL
  cat "$repo_root/supabase/migrations/0019a_reconcile_venue_columns.sql"
  cat "$repo_root/supabase/migrations/0022_venue_layouts.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.venues except select * from venues_after_repair)
    union all (select * from venues_after_repair except select * from public.venues)),
  'AC-018.3.38: running the repair on a table already in shape changes nothing');
select pg_temp.assert_true(
  exists (select 1 from public.venue_layouts
          where venue_id = 'b18a0000-0000-0000-0000-0000000000d1' and layout = 'hall' and capacity = 200),
  'AC-018.3.39: after the repair, 0022 records the repaired venue''s layout with its capacity');
SQL
  # US12 venue blocks: tests, then replay every US12 migration and check nothing changed.
  cat "$repo_root/supabase/tests/venue_blocks.sql"
  for n in 0026 0027 0028 0029 0030 0031 0032 0033 0034; do
    cat "$repo_root"/supabase/migrations/${n}_*.sql
  done
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.venue_closures except select * from blocks_before_replay)
    union all (select * from blocks_before_replay except select * from public.venue_closures))
  and not exists ((select * from public.venue_booking_flags except select * from flags_before_replay)
    union all (select * from flags_before_replay except select * from public.venue_booking_flags))
  and not exists ((select * from public.venue_slot_claims except select * from claims_before_replay)
    union all (select * from claims_before_replay except select * from public.venue_slot_claims)),
  'AC-012.10.4: replaying the US12 migrations preserves blocks, flags and blocked cells');
SQL
  cat "$repo_root/supabase/tests/coordinator_assignment.sql"
  # US15 after US14: AC-015.5.4 reuses equipment_reservations.sql's pg_temp.us14_race.
  cat "$repo_root/supabase/tests/event_registrations.sql"
  # US23 straight after US15: AC-023.5.7 reuses the same pg_temp.us14_race helper.
  cat "$repo_root/supabase/tests/withdraw_registration.sql"
  # US52 after US15/US23: it registers Attendees through register_for_event and reads their lists.
  cat "$repo_root/supabase/tests/registration_setting.sql"
  # US16 after US52: it reuses pg_temp.us14_race and registers Attendees on its own events.
  cat "$repo_root/supabase/tests/waiting_list.sql"
  # US16 SCRUM-154 straight after: it reuses the pg_temp helpers waiting_list.sql defines.
  cat "$repo_root/supabase/tests/waitlist_override.sql"
  # US16 SCRUM-153 after the override: it reuses the same pg_temp helpers.
  cat "$repo_root/supabase/tests/waitlist_expiry_job.sql"
  # US17 AC4 names (0061) last of this group: it reuses the same pg_temp helpers.
  cat "$repo_root/supabase/tests/event_coordinator_names.sql"
  # US29 near the end: it commits its accounts so that replaying 0042 can be compared with them.
  cat "$repo_root/supabase/tests/attendee_signup.sql"
  cat "$repo_root/supabase/migrations/0042_attendee_self_signup.sql"
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select * from public.profiles except select * from profiles_before_us29_replay)
    union all (select * from profiles_before_us29_replay except select * from public.profiles)),
  'AC-029.3.13: replaying 0042 changes no existing profile');
SQL
  # US20 before the venue booking tests: 0063's replay resets arrangement_review_flags'
  # source check to two sources, so it must run before US10's approval tests retire a venue
  # and 0070 records venue-change reviews (a third source, from 0067).
  cat "$repo_root/supabase/tests/event_planning_updates.sql"
  cat "$repo_root/supabase/migrations/0063_event_planning_updates.sql"
  cat <<'SQL'
select pg_temp.assert_true(not exists(
 (select * from public.event_planning_updates except select * from us20_history_before_replay)
 union all (select * from us20_history_before_replay except select * from public.event_planning_updates)),
 'AC-020.2.4: replaying 0063 preserves history without backfilling');
SQL
  # 0063's replay also restores its two-source check and nine reasons, so put back the venue
  # reviews of 0067 and 0070 (same reason as the 0038/0039 and 0055 restores above).
  cat "$repo_root/supabase/migrations/0067_venue_edit_review.sql"
  cat "$repo_root/supabase/migrations/0070_venue_retirement.sql"
  cat "$repo_root/supabase/tests/venue_booking_review.sql"
  cat "$repo_root/supabase/tests/venue_booking_review_details.sql"
  cat "$repo_root/supabase/tests/venue_booking_conflicts.sql"
  # US9 AC8: the trigger from 0035 that notifies Venue Staff of a new request.
  cat "$repo_root/supabase/tests/venue_booking_request_notifications.sql"
    # US22: withdrawing a submitted request (0066).
  cat "$repo_root/supabase/tests/withdraw_submitted_request.sql"
  cat <<'SQL'
create temporary table w22_before_replay as
 select id, status, reviewed_by from public.events where id::text like 'b2200000-%';
SQL
  cat "$repo_root/supabase/migrations/0066_withdraw_submitted_request.sql"
  cat <<'SQL'
select pg_temp.assert_true(
 not exists (
   select 1 from w22_before_replay b join public.events e on e.id = b.id
    where e.status is distinct from b.status
       or e.reviewed_by is distinct from b.reviewed_by)
 and (select count(*) = 2 from public.event_review_decisions where decision = 'withdrawn'),
 'AC-022.2.18: replaying 0066 changes no withdrawn event and logs no extra decision');
SQL
  cat "$repo_root/supabase/tests/venue_booking_approval.sql"
  cat "$repo_root/supabase/migrations/0045_venue_booking_approval.sql"
  cat <<'SQL'
select pg_temp.assert_true(
 not exists((select * from public.venue_bookings except select * from approval_bookings_before_replay)
 union all (select * from approval_bookings_before_replay except select * from public.venue_bookings))
 and not exists((select * from public.venue_slot_claims except select * from approval_claims_before_replay)
 union all (select * from approval_claims_before_replay except select * from public.venue_slot_claims)),
 'AC-010.5.19: replaying migration 0045 preserves existing bookings and claims');
SQL
  # US17 notifications, then replay 0046 against populated records/settings.
  cat "$repo_root/supabase/tests/coordinator_assignment_notifications.sql"
  cat "$repo_root/supabase/migrations/0046_coordinator_assignment_notifications.sql"
  cat "$repo_root/supabase/tests/coordinator_assignment_notifications_replay.sql"
  # US17/US11 handover coverage (integration agreement pending before merge).
  cat "$repo_root/supabase/tests/coordinator_assignment_venue_access.sql"
  cat "$repo_root/supabase/tests/coordinator_assignment_equipment_access.sql"
  # 0049: coordinators cannot hold venues for unassigned events (US17 AC1).
  cat "$repo_root/supabase/tests/venue_booking_assignment.sql"
  cat "$repo_root/supabase/tests/venue_booking_decision_notifications.sql"
  cat "$repo_root/supabase/migrations/0051_venue_booking_decision_notifications.sql"
  cat <<'SQL'
select pg_temp.assert_true(not exists(
 (select * from public.venue_booking_decision_notifications except select * from decisions_before_replay)
 union all (select * from decisions_before_replay except select * from public.venue_booking_decision_notifications)),
 'AC-010.14.19: migration replay preserves notices and does not backfill historical decisions');
SQL
  # US8 structured requirements: catalogues, the equipment code trigger and the
  # array-aware review RPC, then replay 0054-0056 against populated events.
  cat "$repo_root/supabase/tests/structured_event_requirements.sql"
  echo 'create temp table requirement_events_before_replay as select id, layout_preference, accessibility_requirements, facility_requirements, equipment_requirements from public.events;'
  for n in 0054 0055 0056; do
    cat "$repo_root"/supabase/migrations/${n}_*.sql
  done
  cat <<'SQL'
select pg_temp.assert_true(
  not exists ((select id, layout_preference, accessibility_requirements, facility_requirements,
                      equipment_requirements from public.events
               except select * from requirement_events_before_replay)
    union all (select * from requirement_events_before_replay
               except select id, layout_preference, accessibility_requirements,
                             facility_requirements, equipment_requirements from public.events)),
  'AC-002.1.26: replaying the requirement migrations changes no stored requirement');
SQL
  # US46 slice 1: 0022 is replayed above and restores its Operations Manager layout policy, so
  # 0064 is replayed here first, which also shows it is safe to replay.
  cat "$repo_root/supabase/migrations/0064_venue_management.sql"
  cat "$repo_root/supabase/tests/venue_management.sql"
  # US46 slice 2: the 0064 replay above restores the history triggers without the booking
  # review, so 0067 is replayed before its tests, which also shows it is safe to replay.
  cat "$repo_root/supabase/migrations/0067_venue_edit_review.sql"
  cat "$repo_root/supabase/tests/venue_edit.sql"
  # US46 slice 3: the 0067 replay above restores its versions of the review functions, so
  # 0070 is replayed before its tests, which also shows it is safe to replay.
  cat "$repo_root/supabase/migrations/0070_venue_retirement.sql"
  cat "$repo_root/supabase/tests/venue_retire.sql"
  cat "$repo_root/supabase/tests/organiser_venue_arrangements.sql"
  cat "$repo_root/supabase/tests/organiser_equipment_arrangements.sql"
  cat "$repo_root/supabase/tests/retired_venue_replacement.sql"
  cat "$repo_root/supabase/migrations/0065_retired_venue_replacement.sql"
  cat <<'SQL'
select pg_temp.assert_true(not exists(
 (select * from public.venue_replacement_requests except select * from us20s2_requests_before_replay)
 union all (select * from us20s2_requests_before_replay except select * from public.venue_replacement_requests))
 and not exists((select * from public.venue_bookings except select * from us20s2_bookings_before_replay)
 union all(select * from us20s2_bookings_before_replay except select * from public.venue_bookings)),
 'AC-020.3.17: replaying 0065 preserves proposals, decisions and bookings');
SQL
  # US32 slice 1: one feed of each user's own notifications, from every source.
  cat "$repo_root/supabase/tests/notification_feed.sql"
  # US47: the additive foundation must also preserve populated booking state on replay.
  cat <<'SQL'
create temp table us47_bookings_before as select * from public.venue_bookings;
create temp table us47_claims_before as select * from public.venue_slot_claims;
create temp table us47_venues_before as select * from public.venues;
SQL
  cat "$repo_root/supabase/migrations/0074_venue_buffer_foundation.sql"
  cat <<'SQL'
select pg_temp.assert_true(
 not exists((select * from public.venue_bookings except select * from us47_bookings_before)
 union all (select * from us47_bookings_before except select * from public.venue_bookings))
 and not exists((select * from public.venue_slot_claims except select * from us47_claims_before)
 union all (select * from us47_claims_before except select * from public.venue_slot_claims))
 and not exists((select * from public.venues except select * from us47_venues_before)
 union all (select * from us47_venues_before except select * from public.venues)),
 'AC-047.4.2: foundation replay preserves existing venues, bookings and occupied cells');
SQL
  cat "$repo_root/supabase/tests/venue_buffer_foundation.sql"
  # US31 slice 1: organisation ownership, then replay 0069 against assigned Organisers.
  # The replay matters more here than usual: the backfill writes to profiles, so a replay
  # that re-ran it would drag hand-corrected Organisers back to the default organisation.
  cat "$repo_root/supabase/tests/client_organisations.sql"
  echo 'create temp table us31_assignments_before_replay as
          select id, client_org_id from public.profiles where client_org_id is not null;'
  cat "$repo_root/supabase/migrations/0069_client_organisations.sql"
  cat <<'SQL'
select pg_temp.assert_true(not exists(
 (select id, client_org_id from public.profiles where client_org_id is not null
  except select * from us31_assignments_before_replay)
 union all (select * from us31_assignments_before_replay
            except select id, client_org_id from public.profiles where client_org_id is not null)),
 'AC-031.4.16: replaying 0069 preserves assignments and does not re-run the backfill');
SQL
  # US31 slice 2: the organisation read path, then replay 0078 to show it is idempotent.
  cat "$repo_root/supabase/tests/organisation_event_access.sql"
  cat "$repo_root/supabase/migrations/0078_organisation_event_access.sql"
  cat <<'SQL'
-- organisation_event_access.sql ends with the session reset, so a caller is needed again:
-- the projections answer per signed-in user, and with nobody signed in they are empty,
-- which would make this assertion pass for the wrong reason.
set role authenticated;
select set_config('request.jwt.claim.sub', '31100000-0000-0000-0000-000000000003', false);
select pg_temp.assert_true(
 (select count(*) = 1 from public.list_organisation_events()
   where id = '31100000-1111-0000-0000-000000000003'),
 'AC-031.3.8: replaying 0078 leaves the projections answering exactly as before');
reset role;
select set_config('request.jwt.claim.sub', '', false);
SQL
  # US5: each event's readiness summary for its assigned Coordinator.
  cat "$repo_root/supabase/tests/event_readiness.sql"
  # US33 slice 1: each user's notification channel choices, per type.
  cat "$repo_root/supabase/tests/notification_preferences.sql"
  # US33 slice 2a: delivering notices only through each person's chosen channels.
  cat "$repo_root/supabase/tests/notification_delivery.sql"
  # US33 slice 2b: each feature moved onto the sending helper. Re-apply each one's migration
  # (named on its test's first line; replays above restore older versions) and check it.
  for notice_test in "$repo_root"/supabase/tests/notice_channels_*.sql; do
    [ -e "$notice_test" ] || continue
    cat "$repo_root/supabase/migrations/$(sed -n '1s/^-- Migration: //p' "$notice_test")"
    cat "$notice_test"
  done
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
bash "$repo_root/supabase/tests/venue_booking_approval_races.sh" "$container"
bash "$repo_root/supabase/tests/event_planning_update_races.sh" "$container"
bash "$repo_root/supabase/tests/retired_venue_replacement_races.sh" "$container"
