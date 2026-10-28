#!/usr/bin/env bash
set -euo pipefail
# Focused US27 status suite. No shared Supabase connection, port or host volume.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="is212-us27-status-$$"
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
 for migration in "$repo_root"/supabase/migrations/*.sql; do cat "$migration"; printf '\n'; done
 cat "$repo_root/supabase/tests/equipment_status_fixture.sql"
 cat "$repo_root/supabase/tests/equipment_status.sql"
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
bash "$repo_root/supabase/tests/equipment_status_races.sh" "$container"
{
 cat <<'SQL'
create temp table us27_replay_before as select jsonb_build_array(
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_status_changes t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_bookings t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_notifications t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.notification_outbox t)) as snapshot;
SQL
 cat "$repo_root/supabase/migrations/0105_equipment_status_changes.sql"
 cat <<'SQL'
do $$ begin
 if (select snapshot from us27_replay_before) is distinct from jsonb_build_array(
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_items t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_status_changes t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_bookings t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.equipment_allocations t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_flags t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.arrangement_review_notifications t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.notification_outbox t)) then
 raise exception 'Migration replay changed saved data'; end if;
 raise notice 'PASS: AC-027.8.5: replaying 0105 preserves populated units, audit, reservations, reviews and notices';
end $$;
SQL
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
