#!/usr/bin/env bash
set -euo pipefail
# Reuses fixtures from affected_venue_replacement.sql; disposable container only.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
coordinator='48000000-0000-0000-0001-000000000002'
staff='48000000-0000-0000-0001-000000000003'
target='48000000-0000-0000-0002-000000000003'
# Hold the first successful transaction at a visible barrier, then race the second.
race() {
 local actor="$1" first="$2" second="$3" expected="$4" label="$5"
 sql <<SQL &
begin;
set application_name='us48-race-winner';
set local role authenticated;
select set_config('request.jwt.claim.sub','$actor',true);
$first
select pg_sleep(2);
commit;
SQL
 local first_pid=$! ready=false output
 for attempt in {1..50}; do
  if [ "$(echo "select count(*) from pg_stat_activity where application_name='us48-race-winner' and wait_event='PgSleep';" | sql)" = '1' ]; then ready=true; break; fi
  sleep 0.1
 done
 if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: US48 race barrier not reached'; exit 1; fi
 if output=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set role authenticated;
select set_config('request.jwt.claim.sub','$actor',false);
$second
SQL
 ); then wait "$first_pid"; echo "FAIL: both competing actions succeeded: $label"; exit 1; fi
 wait "$first_pid"
 if [[ "$output" != *"$expected"* ]]; then echo "$output"; exit 1; fi
 echo "PASS: $label"
}
booking='48000000-0000-0000-0004-000000000018'
source=$(echo "select public.venue_replacement_source_version('$booking');" | sql)
proposal="select public.propose_venue_replacement('$booking','$target','$source','Race proposal');"
race "$coordinator" "$proposal" "$proposal" '23505' 'AC-048.3.7: simultaneous proposals permit only one pending request'
echo "do \$\$ begin if (select count(*) from public.venue_replacement_requests where original_booking_id='$booking' and status='pending')<>1 then raise exception 'Proposal race duplicated requests'; end if; end \$\$;" | sql
request=$(echo "select id from public.venue_replacement_requests where original_booking_id='48000000-0000-0000-0004-000000000019' and status='pending';" | sql)
version=$(echo "select public.venue_replacement_version('$request');" | sql)
race "$staff" "select public.decide_venue_replacement('$request','$version','approved','Race approval');" \
 "select public.decide_venue_replacement('$request','$version','rejected','Race rejection');" '40001' \
 'AC-048.6.9: simultaneous approval and rejection have one winner'
echo "do \$\$ begin if (select count(*) from public.venue_bookings where event_id='48000000-0000-0000-0003-000000000019' and status='confirmed')<>1 or not exists(select 1 from public.venue_booking_flags where booking_id='48000000-0000-0000-0004-000000000019' and status='resolved' and resolved_by='$staff') then raise exception 'Decision race corrupted bookings or audit'; end if; end \$\$;" | sql
first=$(echo "select id from public.venue_replacement_requests where original_booking_id='48000000-0000-0000-0004-000000000020' and status='pending';" | sql)
second=$(echo "select id from public.venue_replacement_requests where original_booking_id='48000000-0000-0000-0004-000000000024' and status='pending';" | sql)
first_version=$(echo "select public.venue_replacement_version('$first');" | sql)
second_version=$(echo "select public.venue_replacement_version('$second');" | sql)
race "$staff" "select public.decide_venue_replacement('$first','$first_version','approved','Target race first');" \
 "select public.decide_venue_replacement('$second','$second_version','approved','Target race second');" '23505' \
 'AC-048.6.10: competing replacements cannot double-book the target; the loser keeps its original and open review'
sql <<SQL
do \$\$ begin
 if not exists(select 1 from public.venue_replacement_requests where id='$first' and status='approved')
 or not exists(select 1 from public.venue_replacement_requests where id='$second' and status='pending' and replacement_booking_id is null)
 or not exists(select 1 from public.venue_bookings where id='48000000-0000-0000-0004-000000000024' and status='confirmed')
 or (select count(*) from public.venue_slot_claims where booking_id='48000000-0000-0000-0004-000000000024')<>4
 or not exists(select 1 from public.venue_booking_flags where booking_id='48000000-0000-0000-0004-000000000024' and status='open' and resolved_by is null)
 then raise exception 'Target race failed original preservation'; end if;
end \$\$;
SQL
