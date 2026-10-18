#!/usr/bin/env bash
set -euo pipefail
# Disposable database only. Two staff decisions on one pending proposal.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
request=$(echo "select id from public.venue_replacement_requests where original_booking_id='20653000-0000-0000-0000-000000000007' and status='pending';" | sql)
version=$(echo "select public.venue_replacement_version('$request');" | sql)
sql <<SQL &
set application_name='us20-replacement-winner';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',true);
select public.decide_venue_replacement('$request','$version','approved','Agreed replacement');
select pg_sleep(2);
commit;
SQL
first_pid=$!
ready=false
for attempt in {1..30}; do
 if [ "$(echo "select count(*) from pg_stat_activity where application_name='us20-replacement-winner' and wait_event='PgSleep';" | sql)" = '1' ]; then ready=true; break; fi
 sleep 0.1
done
if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: race not ready'; exit 1; fi
if output=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set role authenticated;
select set_config('request.jwt.claim.sub','20650000-0000-0000-0000-000000000003',false);
select public.decide_venue_replacement('$request','$version','rejected','Competing decision');
SQL
); then wait "$first_pid"; echo 'FAIL: both decisions succeeded'; exit 1; fi
wait "$first_pid"
if [[ "$output" != *'40001'* ]]; then echo "$output"; exit 1; fi
sql <<SQL
do \$\$ begin
 if (select count(*) from public.venue_bookings where event_id='20652000-0000-0000-0000-000000000007' and status='confirmed')<>1
 or not exists(select 1 from public.venue_replacement_requests where id='$request' and status='approved') then
  raise exception 'Replacement race corrupted bookings or decision';
 end if;
 raise notice 'PASS: AC-020.3.18: concurrent approval/rejection has one winner and one confirmed replacement';
end \$\$;
SQL
