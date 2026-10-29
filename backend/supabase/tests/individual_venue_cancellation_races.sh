#!/usr/bin/env bash
set -euo pipefail
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
coordinator='49020000-0000-0000-0001-000000000002'
staff='49020000-0000-0000-0001-000000000003'
booking=$(echo "select id from public.venue_bookings where event_id='49020000-0000-0000-0003-000000000001' and status='pending_approval';" | sql)
version=$(echo "select public.venue_booking_review_version('$booking');" | sql)
sql <<SQL &
set application_name='us49-cancel-first';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$coordinator',true);
select public.cancel_individual_venue_booking('$booking','Race cancellation','$version');
select pg_sleep(3);
commit;
SQL
pid=$!; ready=false
for attempt in {1..40}; do
 if [ "$(echo "select count(*) from pg_stat_activity where application_name='us49-cancel-first' and wait_event='PgSleep';" | sql)" = 1 ]; then ready=true; break; fi
 sleep 0.1
done
if [ "$ready" != true ]; then wait "$pid"; echo 'FAIL: cancellation race setup'; exit 1; fi
if result=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set statement_timeout='10s';
set role authenticated;
select set_config('request.jwt.claim.sub','$staff',false);
select public.approve_venue_booking('$booking','$version');
SQL
); then wait "$pid"; echo 'FAIL: approval overwrote cancellation'; exit 1; fi
wait "$pid"
if [[ "$result" != *40001* ]]; then echo "$result"; exit 1; fi
sql <<SQL
do \$\$ begin
 if not exists(select 1 from public.venue_bookings where id='$booking' and status='cancelled')
 or exists(select 1 from public.venue_slot_claims where booking_id='$booking')
 or (select count(*) from public.venue_booking_cancellations where booking_id='$booking')<>1 then
 raise exception 'FAIL: cancellation race final state'; end if;
 raise notice 'PASS: AC-049.7.9: concurrent approval cannot overwrite cancellation or recreate claims';
end \$\$;
SQL
