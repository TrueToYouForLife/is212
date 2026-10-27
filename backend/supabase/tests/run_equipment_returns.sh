#!/usr/bin/env bash
set -euo pipefail
# US24 focused integration/race/replay suite; disposable local PostgreSQL only.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "$#" -gt 0 ]; then
 container="$1"
else
 container="is212-us24-returns-$$"
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
   case "$migration" in */0112_*) continue ;; esac
   cat "$migration"; printf '\n'; done
 } | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
fi
{
 cat "$repo_root/supabase/tests/equipment_return_fixture.sql"
 cat <<'SQL'
create temp table us24_upgrade_before as select jsonb_build_array(
 (select jsonb_agg(to_jsonb(t)-'inspection_version' order by id) from public.equipment_allocations t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_defect_reports t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t)) value;
SQL
 cat "$repo_root/supabase/migrations/0112_equipment_return_inspections.sql"
 cat <<'SQL'
do $$ begin
 if (select value is distinct from jsonb_build_array(
  (select jsonb_agg(to_jsonb(t)-'inspection_version' order by id) from public.equipment_allocations t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_defect_reports t),
  (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t)) from us24_upgrade_before) then
  raise exception 'US24 upgrade rewrote existing rows'; end if;
 raise notice 'PASS: AC-024.3.9: adding return inspections preserves existing allocations, units and legacy defect reports';
end $$;
SQL
 cat "$repo_root/supabase/tests/equipment_return_inspections.sql"
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
bash "$repo_root/supabase/tests/equipment_return_races.sh" "$container"
{
 cat "$repo_root/supabase/tests/equipment_return_replay.sql"
 cat "$repo_root/supabase/migrations/0112_equipment_return_inspections.sql"
 cat <<'SQL'
do $$ begin
 if (select value is distinct from pg_temp.us24_replay_snapshot() from us24_replay_before) then
  raise exception 'US24 replay changed saved data'; end if;
 raise notice 'PASS: AC-024.3.8: migration replay preserves populated inspection, defect, unit, allocation, event and review history';
end $$;
SQL
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
