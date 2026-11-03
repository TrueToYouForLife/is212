#!/usr/bin/env bash
set -euo pipefail
# Isolated HTTP regression; no live Supabase URL, password or data.
repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
db="is212-us41-api-db-$$"
api="is212-us41-api-http-$$"
network="is212-us41-api-net-$$"
cleanup() {
  docker rm -f "$api" "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
docker run --detach --rm --network "$network" --name "$db" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$db" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Temporary database did not become ready.' >&2; exit 1; fi
{
  cat "$repo_root/backend/supabase/tests/bootstrap.sql"
  for migration in "$repo_root"/backend/supabase/migrations/*.sql; do cat "$migration"; printf '\n'; done
  cat "$repo_root/backend/supabase/tests/arrangement_review_replay_fixture.sql"
  cat "$repo_root/backend/supabase/tests/arrangement_review_api_fixture.sql"
} | docker exec -i "$db" psql -X -U postgres -v ON_ERROR_STOP=1
# postgres is only the disposable authenticator; JWTs select the real authenticated role.
# API published on loopback only; the database has no published port.
docker run --detach --rm --network "$network" --name "$api" -p 127.0.0.1::3000 \
  -e "PGRST_DB_URI=postgres://postgres@$db:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=us41-local-api-test-secret-not-a-live-credential \
  postgrest/postgrest:v12.2.12 >/dev/null
port="$(docker port "$api" 3000/tcp | cut -d: -f2)"
url="http://127.0.0.1:$port"
ready=false
for attempt in {1..30}; do
  if curl --silent --fail "$url/" >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then docker logs "$api"; echo 'Temporary API did not become ready.' >&2; exit 1; fi
node "$repo_root/backend/supabase/tests/arrangement_review_api.mjs" "$url"
