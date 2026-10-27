#!/usr/bin/env bash
set -euo pipefail
# Called only with the disposable conversion-runner container.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
staff='47750000-0000-0000-0000-000000000500'
coordinator='47750000-0000-0000-0000-000000000001'
sql <<'SQL'
insert into auth.users(id,email) values('47750000-0000-0000-0000-000000000500','us47-race-staff@example.test');
update public.profiles set role='venue_staff' where id='47750000-0000-0000-0000-000000000500';
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000001','47750000-0000-0000-0000-000000000001',
 'approved','Approval concurrency','2047-11-10 10:00+08'::timestamptz+((n-400)/2)*interval '1 day',
 '2047-11-10 12:00+08'::timestamptz+((n-400)/2)*interval '1 day',10
from generate_series(400,406) n;
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status)
select ('47750000-0000-0000-0000-'||lpad((n+10)::text,12,'0'))::uuid,
 ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000002','47750000-0000-0000-0000-000000000001','pending_approval'
from unnest(array[400,401,402,404,406]) n;
SQL
approve() { echo "select public.approve_venue_booking('$1',public.get_venue_booking_review('$1')->>'reviewVersion');"; }
hold() { echo "select public.hold_venue('$1','47750000-0000-0000-0000-000000000002');"; }
race() {
 local first_user="$1" first="$2" second_user="$3" second="$4" expected="$5"
 sql <<SQL &
set application_name='us47-approval-first';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$first_user',true);
$first
select pg_sleep(4);
commit;
SQL
 local pid=$! ready=false result
 for attempt in {1..30}; do
  if [ "$(echo "select count(*) from pg_stat_activity where application_name='us47-approval-first' and wait_event='PgSleep';" | sql)" = 1 ]; then ready=true; break; fi
  sleep 0.1
 done
 if [ "$ready" != true ]; then wait "$pid"; echo 'FAIL: approval race setup'; exit 1; fi
 if result=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set statement_timeout='10s';
set role authenticated;
select set_config('request.jwt.claim.sub','$second_user',false);
$second
SQL
 ); then
  wait "$pid"; echo 'FAIL: competing operation unexpectedly succeeded'; exit 1
 fi
 wait "$pid"
 echo "$result"
 if [[ "$result" != *"$expected"* ]]; then echo 'FAIL: unexpected race error'; exit 1; fi
}
race "$staff" "$(approve 47750000-0000-0000-0000-000000000410)" "$staff" "$(approve 47750000-0000-0000-0000-000000000411)" 23505
race "$staff" "$(approve 47750000-0000-0000-0000-000000000412)" "$coordinator" "$(hold 47750000-0000-0000-0000-000000000403)" 23505
race "$coordinator" "$(hold 47750000-0000-0000-0000-000000000405)" "$staff" "$(approve 47750000-0000-0000-0000-000000000414)" 23505
# Simulate the trusted database write from an approved change request. Normal
# browser edits remain prohibited. Approval must recheck its old version
# after waiting. The version below is captured before the edit commits.
stale_version=$(echo "select public.venue_booking_review_version('47750000-0000-0000-0000-000000000416');" | sql)
race "$coordinator" "reset role; select set_config('request.jwt.claim.sub','',true); update public.events set expected_attendance=11 where id='47750000-0000-0000-0000-000000000406';" "$staff" "select public.approve_venue_booking('47750000-0000-0000-0000-000000000416','$stale_version');" 40001
sql <<'SQL'
do $$ begin
 if (select count(*) from public.venue_bookings where id='47750000-0000-0000-0000-000000000410' and status='confirmed')<>1
 or (select count(*) from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000410')<>13
 or not exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000411' and status='pending_approval')
 or exists(select 1 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000411') then
 raise exception 'FAIL: overlapping approval final state'; end if;
 raise notice 'PASS: AC-047.2.18: overlapping approvals retain one confirmed winner and no partial loser';
 if not exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000412' and status='confirmed')
 or exists(select 1 from public.venue_bookings where event_id='47750000-0000-0000-0000-000000000403')
 or (select count(*) from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000412')<>13
 or not exists(select 1 from public.venue_bookings where event_id='47750000-0000-0000-0000-000000000405' and status='held')
 or (select count(*) from public.venue_slot_claims c join public.venue_bookings b on b.id=c.booking_id where b.event_id='47750000-0000-0000-0000-000000000405')<>13
 or not exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000414' and status='pending_approval')
 or exists(select 1 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000414') then
 raise exception 'FAIL: approval versus hold final state'; end if;
 raise notice 'PASS: AC-047.2.19: approval and hold races preserve the winner in both orderings';
 if not exists(select 1 from public.venue_bookings where id='47750000-0000-0000-0000-000000000416' and status='pending_approval')
 or exists(select 1 from public.venue_slot_claims where booking_id='47750000-0000-0000-0000-000000000416') then
 raise exception 'FAIL: stale approval final state'; end if;
 raise notice 'PASS: AC-047.2.20: concurrent event edit invalidates approval without reserving cells';
end $$;
SQL
