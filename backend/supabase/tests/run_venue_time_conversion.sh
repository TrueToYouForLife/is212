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
    case "$migration" in */0075_*)
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
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
bash "$repo_root/supabase/tests/venue_time_hold_races.sh" "$container"
bash "$repo_root/supabase/tests/venue_time_approval_races.sh" "$container"
