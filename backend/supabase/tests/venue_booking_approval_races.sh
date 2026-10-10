#!/usr/bin/env bash
set -euo pipefail
# Receives only the disposable container created by run_change_request_review.sh.
container="$1"
staff="b10a0000-0000-0000-0000-000000000001"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }

# Two different requests for exactly the same event and buffer cells.
sql <<'SQL'
update public.events set proposed_start='2042-12-01T13:00:00+08',proposed_end='2042-12-01T16:00:00+08'
 where id in ('b10c0000-0000-0000-0000-000000000111','b10c0000-0000-0000-0000-000000000112');
SQL

race() {
  local first="$1" second="$2" expected="$3" label="$4"
  # First transaction holds its locks while the second attempts its decision.
  sql <<SQL &
set application_name='us10-approval-first';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$staff',true);
$first
select pg_sleep(3);
commit;
SQL
  local first_pid=$!
  local ready=false
  for attempt in {1..30}; do
    if [ "$(echo "select count(*) from pg_stat_activity where application_name='us10-approval-first' and wait_event='PgSleep';" | sql)" = "1" ]; then
      ready=true
      break
    fi
    sleep 0.1
  done
  if [ "$ready" != true ]; then wait "$first_pid"; echo 'Race setup failed'; exit 1; fi
  local result
  if result=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set role authenticated;
select set_config('request.jwt.claim.sub','$staff',false);
$second
SQL
  ); then
    echo 'FAIL: competing decision unexpectedly succeeded'
    wait "$first_pid"
    exit 1
  fi
  wait "$first_pid"
  echo "$result"
  if [[ "$result" != *"$expected"* ]]; then echo 'FAIL: unexpected race error'; exit 1; fi
  echo "PASS: $label"
}

race "select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000211',public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000211')->>'reviewVersion');" \
 "select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000212',public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000212')->>'reviewVersion');" \
 '23505' 'AC-010.6.17: concurrent overlapping approvals have only one winner'

race "update public.venue_bookings set status='rejected',review_note='Unavailable' where id='b10c0000-0000-0000-0000-000000000209';" \
 "select public.approve_venue_booking('b10c0000-0000-0000-0000-000000000209',public.get_venue_booking_review('b10c0000-0000-0000-0000-000000000209')->>'reviewVersion');" \
 '40001' 'AC-010.12.24: a concurrent rejection cannot be overwritten by approval'

sql <<'SQL'
do $$ begin
 if (select count(*) from public.venue_bookings where id in
 ('b10c0000-0000-0000-0000-000000000211','b10c0000-0000-0000-0000-000000000212') and status='confirmed')<>1
 or (select count(*) from public.venue_slot_claims where booking_id='b10c0000-0000-0000-0000-000000000211')<>3
 or exists(select 1 from public.venue_slot_claims where booking_id='b10c0000-0000-0000-0000-000000000212')
 or not exists(select 1 from public.venue_bookings where id='b10c0000-0000-0000-0000-000000000209' and status='rejected') then
 raise exception 'Race final state is incorrect'; end if;
 raise notice 'PASS: AC-010.7.4: concurrent loser has no claims and winner retains all three cells';
end $$;
SQL
