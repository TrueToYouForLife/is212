#!/usr/bin/env bash
set -euo pipefail
# US48 safety compatibility; disposable local PostgreSQL, never shared Supabase.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "$#" -gt 0 ]; then
 container="$1"
else
 container="is212-us48-safety-$$"
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
  for migration in "$repo_root"/supabase/migrations/*.sql; do
   case "$migration" in */0116_*) continue ;; esac
   cat "$migration"; printf '\n'
  done
 } | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
fi
{
 cat "$repo_root/supabase/migrations/0116_us48_safety_stage_replacements.sql"
 cat "$repo_root/supabase/tests/venue_replacement_safety_stages.sql"
 cat "$repo_root/supabase/migrations/0116_us48_safety_stage_replacements.sql"
 cat <<'SQL'
select pg_temp.s48_assert((select value=pg_temp.s48_snapshot() and versions=
 (select jsonb_object_agg(id,public.venue_replacement_version(id)) from public.venue_replacement_requests)
 from s48_before_replay),
 'AC-048.6.15: replay preserves populated safety-stage events, reservations, reviews, history and consent');
SQL
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
bash "$repo_root/supabase/tests/venue_replacement_safety_races.sh" "$container"
