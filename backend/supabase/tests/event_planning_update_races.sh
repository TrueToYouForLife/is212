#!/usr/bin/env bash
set -euo pipefail
# Only invoked with the disposable test container; no project connection or .env.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
event='20020000-0000-0000-0000-000000000002'
actor='20010000-0000-0000-0000-000000000002'
version=$(echo "select md5(to_jsonb(e)::text) from public.events e where id='$event';" | sql)
sql <<SQL &
set application_name='us20-first-editor';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$actor',true);
select public.update_event_planning('$event','$version','{"name":"First editor wins"}');
select pg_sleep(2);
commit;
SQL
first_pid=$!
ready=false
for attempt in {1..30}; do
  if [ "$(echo "select count(*) from pg_stat_activity where application_name='us20-first-editor' and wait_event='PgSleep';" | sql)" = '1' ]; then
    ready=true
    break
  fi
  sleep 0.1
done
if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: race setup did not become ready'; exit 1; fi
if output=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set role authenticated;
select set_config('request.jwt.claim.sub','$actor',false);
select public.update_event_planning('$event','$version','{"name":"Lost update"}');
SQL
); then
  wait "$first_pid"
  echo 'FAIL: concurrent stale edit succeeded'
  exit 1
fi
wait "$first_pid"
if [[ "$output" != *'40001'* ]]; then echo "$output"; exit 1; fi
sql <<SQL
do \$\$ begin
 if not exists(select 1 from public.events where id='$event' and name='First editor wins')
 or (select count(*) from public.event_planning_updates where event_id='$event' and changes ? 'name')<>1 then
  raise exception 'Concurrent update or history was lost';
 end if;
 raise notice 'PASS: AC-020.1.17: concurrent editors have one winner and exactly one audit entry';
end \$\$;
SQL
