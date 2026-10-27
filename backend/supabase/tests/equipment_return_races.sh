#!/usr/bin/env bash
set -euo pipefail
container="$1"
sql() { docker exec -i "$container" psql -X -At -U postgres -v ON_ERROR_STOP=1; }
staff='a1120000-0000-0000-0001-000000000001'
unit2='a1120000-0000-0000-0004-000000000002'
unit11='a1120000-0000-0000-0004-000000000011'
allocation2='a1120000-0000-0000-0008-000000000002'
allocation10='a1120000-0000-0000-0008-000000000010'
allocation11='a1120000-0000-0000-0008-000000000011'
allocation13='a1120000-0000-0000-0008-000000000013'
requirement1='a1120000-0000-0000-0009-000000000001'
requirement2='a1120000-0000-0000-0009-000000000002'
version() { echo "select public.equipment_return_version('$1');" | sql; }
race() {
 local first="$1" second="$2" expected="$3" label="$4"
 sql <<SQL &
begin;
set application_name='us24-inspection-first';
set local role authenticated;
select set_config('request.jwt.claim.sub','$staff',true);
$first
select pg_sleep(2);
commit;
SQL
 local first_pid=$! ready=false output
 for attempt in {1..50}; do
  if [ "$(echo "select count(*) from pg_stat_activity where application_name='us24-inspection-first' and wait_event='PgSleep';" | sql)" = 1 ]; then ready=true; break; fi
  sleep 0.1
 done
 if [ "$ready" != true ]; then wait "$first_pid"; echo 'FAIL: US24 race barrier not reached'; exit 1; fi
 if output=$(sql 2>&1 <<SQL
\set VERBOSITY verbose
set statement_timeout='15s';
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
loaded=$(version "$allocation10")
race "select public.inspect_equipment_return('$allocation10','$loaded','good');" \
 "select public.inspect_equipment_return('$allocation10','$loaded','damage','Concurrent inspection','needs_repair');" 40001 \
 'AC-024.1.9: simultaneous inspectors accept one allocation version and one inspection'
loaded=$(version "$allocation11")
race "select public.set_equipment_status('$unit11','needs_repair','Maintenance changed during inspection',0);" \
 "select public.inspect_equipment_return('$allocation11','$loaded','good');" 40001 \
 'AC-024.2.3: a concurrent US27 status change invalidates the displayed inspection consent'
loaded=$(version "$allocation2")
race "select public.reserve_equipment('$requirement1',1);" \
 "select public.inspect_equipment_return('$allocation2','$loaded','damage','Broken on inspection','needs_repair');" ok \
 'AC-024.3.6: reservation wins type lock; inspection retains and flags its newly allocated future unit'
loaded=$(version "$allocation13")
race "select public.inspect_equipment_return('$allocation13','$loaded','damage','Unsafe connector','needs_repair');" \
 "select public.reserve_equipment('$requirement2',1);" 23P01 \
 'AC-024.3.7: inspection wins type lock; waiting reservation rechecks and refuses damaged stock'
sql <<SQL
do \$\$ begin
 if (select count(*) from public.equipment_return_inspections where allocation_id='$allocation10')<>1
 or exists(select 1 from public.equipment_return_inspections where allocation_id='$allocation11')
 or (select count(*) from public.equipment_allocations where item_id='$unit2' and status='reserved')<>4
 or not exists(select 1 from public.arrangement_review_flags f join public.equipment_status_changes c
  on c.id=f.equipment_status_change_id where c.item_id='$unit2' and f.status='open')
 or (select status from public.event_equipment_requirements where id='$requirement2')<>'pending_review' then
 raise exception 'US24 concurrent final state mismatch'; end if;
end \$\$;
SQL
