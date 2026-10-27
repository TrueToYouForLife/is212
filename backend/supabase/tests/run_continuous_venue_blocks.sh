#!/usr/bin/env bash
set -euo pipefail
# Continuous venue block checks against a disposable database; never shared Supabase.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="is212-continuous-blocks-$$"
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
 for migration in "$repo_root"/supabase/migrations/*.sql; do case "$migration" in */0100_*) continue ;; esac; cat "$migration"; printf '\n'; done
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
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1

bash "$repo_root/supabase/tests/affected_venue_replacement_races.sh" "$container"

bash "$repo_root/supabase/tests/continuous_venue_block_races.sh" "$container"
