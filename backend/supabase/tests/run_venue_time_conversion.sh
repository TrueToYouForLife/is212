#!/usr/bin/env bash
set -euo pipefail
# Isolated current-schema migration test. Never connects to shared Supabase.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="is212-us47-conversion-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --rm --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Temporary database did not become ready.' >&2; exit 1; fi
{
  cat "$repo_root/supabase/tests/bootstrap.sql"
  # Both upgrade-after-later-migrations and fresh numeric-order installs matter:
  # 0075 was claimed before migrations that have already been deployed.
  mode="${1:-upgrade}"
  for migration in "$repo_root"/supabase/migrations/*.sql; do
    case "$migration" in */0098_*|*/0099_*|*/0100_*|*/0103_*) continue ;;
    */0075_*)
      if [ "$mode" != fresh ]; then continue; fi
      cat "$repo_root/supabase/tests/venue_time_conversion_fixture.sql"
      ;;
    esac
    cat "$migration"; printf '\n'
  done
  if [ "$mode" != fresh ]; then
    cat "$repo_root/supabase/tests/venue_time_conversion_fixture.sql"
    cat "$repo_root/supabase/migrations/0075_venue_booking_time_integration.sql"
  fi
  cat "$repo_root/supabase/tests/venue_time_conversion_verify.sql"
  cat "$repo_root/supabase/migrations/0075_venue_booking_time_integration.sql"
  cat <<'SQL'
select pg_temp.us47_assert(
 not exists((select * from public.time_slots except select * from us47_after_slots)
 union all(select * from us47_after_slots except select * from public.time_slots))
 and not exists((select * from public.venue_slot_claims except select * from us47_after_claims)
 union all(select * from us47_after_claims except select * from public.venue_slot_claims))
 and not exists((select * from public.venue_closures except select * from us47_after_closures)
 union all(select * from us47_after_closures except select * from public.venue_closures)),
 'AC-047.2.5: repeated conversion preserves catalogue, reservations and block definitions');
SQL
  cat "$repo_root/supabase/tests/venue_time_calculations.sql"
  cat "$repo_root/supabase/tests/venue_time_holds.sql"
  cat "$repo_root/supabase/tests/venue_time_approval.sql"
  cat "$repo_root/supabase/tests/venue_time_revalidation.sql"
  cat "$repo_root/supabase/tests/venue_time_operating_hours.sql"
  cat "$repo_root/supabase/migrations/0098_venue_buffer_settings.sql"
  cat <<'SQL'
create temp table settings_replay_claims as select * from public.venue_slot_claims;
create temp table settings_replay_bookings as select * from public.venue_bookings;
SQL
  # Replay must be safe on the populated conversion fixture.
  cat "$repo_root/supabase/migrations/0098_venue_buffer_settings.sql"
  cat <<'SQL'
select pg_temp.us47_assert(
 not exists((select * from public.venue_slot_claims except select * from settings_replay_claims)
 union all(select * from settings_replay_claims except select * from public.venue_slot_claims))
 and not exists((select * from public.venue_bookings except select * from settings_replay_bookings)
 union all(select * from settings_replay_bookings except select * from public.venue_bookings)),
 'AC-047.3.4: replaying settings migration preserves populated bookings and claims');
SQL
  cat "$repo_root/supabase/tests/venue_buffer_settings.sql"
  cat "$repo_root/supabase/tests/venue_time_revalidation.sql"

  # US48 requires current occupancy and must follow historical 0075/0098 replays.
  cat "$repo_root/supabase/migrations/0099_affected_venue_replacement.sql"
  cat "$repo_root/supabase/tests/affected_venue_replacement.sql"
  cat "$repo_root/supabase/migrations/0099_affected_venue_replacement.sql"
  cat <<'SQL'
select pg_temp.us48_assert((select value=pg_temp.us48_snapshot() from us48_replay_before),
 'AC-048.6.8: replaying 0099 preserves events, bookings, claims, reviews and replacement history');
SQL

  cat <<'SQL'
create temp table period_upgrade_before as select pg_temp.us48_snapshot() value,
 (select jsonb_agg(to_jsonb(t)-'starts_at'-'ends_at' order by id) from public.venue_closures t) closures;
SQL
  cat "$repo_root/supabase/migrations/0100_continuous_venue_blocks.sql"
  cat <<'SQL'
select pg_temp.us48_assert((select value=pg_temp.us48_snapshot() and closures=(select jsonb_agg(to_jsonb(t)-'starts_at'-'ends_at' order by id) from public.venue_closures t) from period_upgrade_before),
 'AC-012.10.7: upgrading populated legacy data to 0100 preserves events, reservations, reviews, history and existing block coverage');
SQL
  cat "$repo_root/supabase/tests/continuous_venue_blocks.sql"
  cat "$repo_root/supabase/migrations/0100_continuous_venue_blocks.sql"
  cat <<'SQL'
select pg_temp.period_assert((select value=pg_temp.period_snapshot() from period_before_replay),
 'AC-012.10.8: replaying 0100 preserves events, bookings, claims, reviews, block definitions and replacement history');
SQL
  # US33 (0103): US12 closure alerts follow each person's channel choices; applies after 0100.
  cat "$repo_root/supabase/migrations/0103_us12_venue_block_notice_channels.sql"
  cat "$repo_root/supabase/tests/venue_block_notice_channels.sql"
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
bash "$repo_root/supabase/tests/venue_time_hold_races.sh" "$container"
bash "$repo_root/supabase/tests/venue_time_approval_races.sh" "$container"

bash "$repo_root/supabase/tests/affected_venue_replacement_races.sh" "$container"

bash "$repo_root/supabase/tests/continuous_venue_block_races.sh" "$container"
