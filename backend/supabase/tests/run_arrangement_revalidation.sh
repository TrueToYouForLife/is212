#!/usr/bin/env bash
set -euo pipefail
# US41 behaviour coverage; synthetic fixtures and disposable PostgreSQL only.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "$#" -gt 0 ]; then
  container="$1"
else
  container="is212-us41-arrangements-$$"
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
      cat "$migration"; printf '\n'
    done
  } | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
fi
{
  cat <<'SQL'
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
-- Use real calculators for the model installed by the parent gate. No production
-- function is replaced: historical AM/PM/Night and quarter-hour gates stay distinct.
create function pg_temp.us41_cells(venue uuid,starts timestamptz,ends timestamptz)
returns table(slot_date date,slot text,kind text) language plpgsql as $$
begin
 if to_regprocedure('public.venue_review_cells(uuid,timestamptz,timestamptz)') is not null then
  return query execute 'select * from public.venue_review_cells($1,$2,$3)' using venue,starts,ends;
 else
  return query select * from public.venue_review_cells(starts,ends);
 end if;
end $$;
SQL
  cat "$repo_root/supabase/tests/arrangement_revalidation.sql"
  cat "$repo_root/supabase/tests/arrangement_layout_capacity.sql"
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
