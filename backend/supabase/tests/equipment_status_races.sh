#!/usr/bin/env bash
set -euo pipefail
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
staff='a1050000-0000-0000-0001-000000000001'
unit2='a1050000-0000-0000-0004-000000000002'
unit3='a1050000-0000-0000-0004-000000000003'
unit4='a1050000-0000-0000-0004-000000000004'
req12='a1050000-0000-0000-0009-000000000012'
req13='a1050000-0000-0000-0009-000000000013'
race() {
 local first="$1" second="$2" expected="$3" label="$4"
 sql <<SQL &
begin;
set application_name='us27-status-first';
set local role authenticated;
select set_config('request.jwt.claim.sub','$staff',true);
$first
select pg_sleep(2);
commit;
SQL
 local first_pid=$! ready=false output
 for attempt in {1..50}; do
  if [ "$(echo "select count(*) from pg_stat_activity where application_name='us27-status-first' and wait_event='PgSleep';" | sql)" = 1 ]; then ready=true; break; fi
  sleep 0.1
 done
 if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: US27 race barrier not reached'; exit 1; fi
 if output=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set statement_timeout='10s';
set role authenticated;
select set_config('request.jwt.claim.sub','$staff',false);
$second
SQL
 ); then
  wait "$first_pid"
  if [ "$expected" != ok ]; then echo 'FAIL: competing operation unexpectedly succeeded'; exit 1; fi
 else
  wait "$first_pid"
  if [ "$expected" = ok ] || [[ "$output" != *"$expected"* ]]; then echo "$output"; exit 1; fi
 fi
 echo "PASS: $label"
}
race "select public.set_equipment_status('$unit2','needs_repair','First staff edit',0);" \
 "select public.set_equipment_status('$unit2','unavailable','Stale staff edit',0);" '40001' \
 'AC-027.8.4: simultaneous staff decisions permit one versioned change and one audit'
race "select public.set_equipment_status('$unit3','under_repair','Before reservation',0);" \
 "select public.reserve_equipment('$req12',1);" '23P01' \
 'AC-027.6.4: status change wins type lock; waiting reservation rechecks and refuses unusable stock'
race "select public.reserve_equipment('$req13',1);" \
 "select public.set_equipment_status('$unit4','unavailable','After reservation',0);" ok \
 'AC-027.7.6: reservation wins type lock; waiting status change sees and flags it without losing the reservation'
sql <<SQL
do \$\$ begin
 if (select count(*) from public.equipment_status_changes where item_id='$unit2')<>1
 or (select status_version from public.equipment_items where id='$unit2')<>1
 or exists(select 1 from public.equipment_allocations where item_id='$unit3')
 or (select status from public.event_equipment_requirements where id='$req12')<>'pending_review'
 or (select count(*) from public.equipment_allocations where item_id='$unit4' and status='reserved')<>1
 or (select count(*) from public.arrangement_review_flags f join public.equipment_status_changes c
 on c.id=f.equipment_status_change_id where c.item_id='$unit4' and f.status='open')<>1 then
 raise exception 'US27 concurrent final state mismatch'; end if;
end \$\$;
SQL
