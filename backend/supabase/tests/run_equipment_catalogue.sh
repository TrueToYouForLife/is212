#!/usr/bin/env bash
set -euo pipefail
# US27 current-schema integration checks; disposable local PostgreSQL only.
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="is212-us27-catalogue-$$"
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
 cat "$repo_root/supabase/tests/equipment_catalogue.sql"
} | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
