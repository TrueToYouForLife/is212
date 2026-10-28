#!/usr/bin/env bash
set -euo pipefail
# Uses only the disposable database supplied by the parent runner.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
sql <<'SQL' &
set application_name='continuous-block-first';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0001-000000000003',true);
select public.block_venue_period('10000000-0000-0000-0002-000000000001','2051-10-21 21:00+08','2051-10-22 08:00+08','Concurrent continuous block');
select pg_sleep(3);
commit;
SQL
first_pid=$!
ready=false
for attempt in {1..40}; do
 if [ "$(echo "select count(*) from pg_stat_activity where application_name='continuous-block-first' and wait_event='PgSleep';" | sql)" = 1 ]; then ready=true; break; fi
 sleep 0.1
done
if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: race setup did not become ready'; exit 1; fi
if result=$(sql 2>&1 <<'SQL'
\set VERBOSITY verbose
set statement_timeout='10s';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0001-000000000003',false);
select public.block_venue('10000000-0000-0000-0002-000000000001','2051-10-22','2051-10-22',array['T0745'],'Concurrent legacy block');
SQL
); then
 wait "$first_pid"; echo 'FAIL: concurrent overlapping legacy block succeeded'; exit 1
fi
wait "$first_pid"
echo "$result"
if [[ "$result" != *'23505'* ]]; then echo 'FAIL: unexpected concurrency error'; exit 1; fi
sql <<'SQL'
do $$ begin
 if (select count(*) from public.venue_closures where venue_id='10000000-0000-0000-0002-000000000001' and starts_on='2051-10-21')<>1
 or exists(select 1 from public.venue_closures where reason='Concurrent legacy block')
 or (select count(*) from public.venue_slot_claims where venue_id='10000000-0000-0000-0002-000000000001' and slot_date between '2051-10-21' and '2051-10-22')<>44 then
 raise exception 'FAIL: overlapping race final state incorrect'; end if;
 raise notice 'PASS: AC-012.9.28: continuous and legacy overlapping requests serialize, with one complete winner and no losing block';
end $$;
SQL
