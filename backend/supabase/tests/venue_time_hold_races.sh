#!/usr/bin/env bash
set -euo pipefail
# Only the disposable container supplied by the conversion runner is used.
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
sql <<'SQL'
update public.profiles set role='coordinator' where id='47750000-0000-0000-0000-000000000001';
update public.venues set setup_minutes=30,turnaround_minutes=45 where id='47750000-0000-0000-0000-000000000002';
insert into public.events(id,organiser_id,coordinator_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('47750000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '47750000-0000-0000-0000-000000000001','47750000-0000-0000-0000-000000000001',
 'approved','Concurrent hold','2047-10-26 10:00+08','2047-10-26 12:00+08',10
from generate_series(200,201) n;
SQL
sql <<'SQL' &
set application_name='us47-hold-first';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',true);
select public.hold_venue('47750000-0000-0000-0000-000000000200','47750000-0000-0000-0000-000000000002');
select pg_sleep(4);
commit;
SQL
first_pid=$!
ready=false
for attempt in {1..30}; do
 if [ "$(echo "select count(*) from pg_stat_activity where application_name='us47-hold-first' and wait_event='PgSleep';" | sql)" = 1 ]; then ready=true; break; fi
 sleep 0.1
done
if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: race setup did not become ready'; exit 1; fi
if result=$(sql 2>&1 <<'SQL'
\set VERBOSITY verbose
set statement_timeout='10s';
set role authenticated;
select set_config('request.jwt.claim.sub','47750000-0000-0000-0000-000000000001',false);
select public.hold_venue('47750000-0000-0000-0000-000000000201','47750000-0000-0000-0000-000000000002');
SQL
); then
 wait "$first_pid"
 echo 'FAIL: overlapping concurrent hold succeeded'; exit 1
fi
wait "$first_pid"
echo "$result"
if [[ "$result" != *'23505'* ]]; then echo 'FAIL: unexpected concurrency error'; exit 1; fi
sql <<'SQL'
do $$ begin
 if (select count(*) from public.venue_bookings where event_id='47750000-0000-0000-0000-000000000200' and status='held')<>1
 or exists(select 1 from public.venue_bookings where event_id='47750000-0000-0000-0000-000000000201')
 or (select count(*) from public.venue_slot_claims c join public.venue_bookings b on b.id=c.booking_id
 where b.event_id='47750000-0000-0000-0000-000000000200')<>13 then
 raise exception 'FAIL: concurrent hold final state incorrect'; end if;
 raise notice 'PASS: AC-047.2.13: concurrent overlapping holds have one winner, all 13 occupied cells and no partial losing booking';
end $$;
SQL
