#!/usr/bin/env bash
set -euo pipefail
# Both agreed safety stages: real concurrent PostgreSQL sessions, inherited fixtures.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
coordinator='48160000-0000-0000-0001-000000000002'
staff='48160000-0000-0000-0001-000000000003'
target='48160000-0000-0000-0002-000000000003'
race() {
 local actor="$1" first="$2" second="$3" expected="$4" label="$5"
 sql <<SQL &
begin;
set application_name='us48-safety-race-winner';
set local role authenticated;
select set_config('request.jwt.claim.sub','$actor',true);
$first
select pg_sleep(2);
commit;
SQL
 local first_pid=$! ready=false output
 for attempt in {1..50}; do
  if [ "$(echo "select count(*) from pg_stat_activity where application_name='us48-safety-race-winner' and wait_event='PgSleep';" | sql)" = '1' ]; then ready=true; break; fi
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

for offset in 0 14; do
 booking=$(printf '48160000-0000-0000-0004-%012d' "$((10+offset))")
 source=$(echo "select public.venue_replacement_source_version('$booking');" | sql)
 proposal="select public.propose_venue_replacement('$booking','$target','$source','Safety race proposal');"
 race "$coordinator" "$proposal" "$proposal" '23505' \
  'AC-048.3.13: concurrent safety-stage proposals permit exactly one pending request'
 request=$(echo "select id from public.venue_replacement_requests where original_booking_id='$(printf '48160000-0000-0000-0004-%012d' "$((11+offset))")';" | sql)
 version=$(echo "select public.venue_replacement_version('$request');" | sql)
 race "$staff" "select public.decide_venue_replacement('$request','$version','approved','Safety race approval');" \
  "select public.decide_venue_replacement('$request','$version','rejected','Safety race rejection');" '40001' \
  'AC-048.6.16: concurrent safety-stage approval/rejection has one winner'
 first_booking=$(printf '48160000-0000-0000-0004-%012d' "$((12+offset))")
 second_booking=$(printf '48160000-0000-0000-0004-%012d' "$((13+offset))")
 first=$(echo "select id from public.venue_replacement_requests where original_booking_id='$first_booking';" | sql)
 second=$(echo "select id from public.venue_replacement_requests where original_booking_id='$second_booking';" | sql)
 first_version=$(echo "select public.venue_replacement_version('$first');" | sql)
 second_version=$(echo "select public.venue_replacement_version('$second');" | sql)
 race "$staff" "select public.decide_venue_replacement('$first','$first_version','approved','Safety target race first');" \
  "select public.decide_venue_replacement('$second','$second_version','approved','Safety target race second');" '23505' \
  'AC-048.6.17: competing safety-stage replacements cannot double-book a target'
 sql <<SQL
do \$\$ begin
 if (select count(*) from public.venue_replacement_requests where original_booking_id='$booking' and status='pending')<>1
 or not exists(select 1 from public.venue_replacement_requests where id='$request' and status='approved' and decided_by='$staff')
 or not exists(select 1 from public.venue_replacement_requests where id='$first' and status='approved')
 or not exists(select 1 from public.venue_replacement_requests where id='$second' and status='pending' and replacement_booking_id is null)
 or not exists(select 1 from public.venue_bookings where id='$second_booking' and status='confirmed')
 or (select count(*) from public.venue_slot_claims where booking_id='$second_booking')<>4
 or not exists(select 1 from public.venue_booking_flags where booking_id='$second_booking' and status='open' and replacement_booking_id is null)
 then raise exception 'Safety-stage race corrupted reservation, pending request or audit'; end if;
end \$\$;
SQL
done
