-- US42 slice 1. Isolated fixtures; reads execute with the browser role.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users(id,email) values
 ('42000000-0000-0000-0000-000000000001','us42-owner@example.test'),
 ('42000000-0000-0000-0000-000000000002','us42-other@example.test'),
 ('42000000-0000-0000-0000-000000000003','us42-staff@example.test');
update public.profiles set role='organiser'
 where id in ('42000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000002');
update public.profiles set role='coordinator' where id='42000000-0000-0000-0000-000000000003';
insert into public.events(id,organiser_id,status,purpose,proposed_start,proposed_end,expected_attendance)
select ('42100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '42000000-0000-0000-0000-000000000001','approved','US42 venue read',
 '2042-02-20 01:00+00','2042-02-20 03:00+00',10
from generate_series(1,2) n;
insert into public.venues(id,name,location,capacity,layout) values
 ('42200000-0000-0000-0000-000000000001','US42 Alpha Hall','Test',100,'theatre'),
 ('42200000-0000-0000-0000-000000000002','US42 Beta Hall','Test',100,'theatre');
insert into public.venue_bookings(id,event_id,venue_id,requested_by,status,hold_expires_at,review_note)
select ('42300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 case when n=3 then '42100000-0000-0000-0000-000000000002'::uuid
 else '42100000-0000-0000-0000-000000000001'::uuid end,
 case when n=2 then '42200000-0000-0000-0000-000000000002'::uuid
 else '42200000-0000-0000-0000-000000000001'::uuid end,
 '42000000-0000-0000-0000-000000000003',
 (array['confirmed','confirmed','held','pending_approval','rejected','cancelled','expired'])[n],
 case when n=3 then now()+interval '1 day' end,'PRIVATE STAFF NOTE'
from generate_series(1,7) n;
-- Deliberately different from the event dates: only actual reserved cells are commitments.
-- Insert out of order to verify chronological ordering, including the midnight boundary.
insert into public.venue_slot_claims(venue_id,slot_date,slot,kind,booking_id) values
 ('42200000-0000-0000-0000-000000000001','2042-02-11','AM','buffer','42300000-0000-0000-0000-000000000001'),
 ('42200000-0000-0000-0000-000000000001','2042-02-10','NIGHT','event','42300000-0000-0000-0000-000000000001'),
 ('42200000-0000-0000-0000-000000000001','2042-02-10','PM','buffer','42300000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','42000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
 (select count(*)=2 from public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000001'))
 and (select venue_name='US42 Alpha Hall' and slots='[
   {"date":"2042-02-10","slot":"PM","startsAt":"13:00:00","endsAt":"18:00:00","kind":"buffer"},
   {"date":"2042-02-10","slot":"NIGHT","startsAt":"19:00:00","endsAt":"24:00:00","kind":"event"},
   {"date":"2042-02-11","slot":"AM","startsAt":"07:00:00","endsAt":"12:00:00","kind":"buffer"}
 ]'::jsonb from public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000001')
 where booking_id='42300000-0000-0000-0000-000000000001'),
 'AC-042.1.1: owner sees only confirmed bookings and their actual ordered event/buffer slots');

select pg_temp.assert_true(
 not exists(select 1 from public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000002'))
 and (select venue_name='US42 Beta Hall' and slots='[]'::jsonb
 from public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000001')
 where booking_id='42300000-0000-0000-0000-000000000002'),
 'AC-042.1.2: empty arrangements and missing ledger cells do not invent bookings or dates');

select pg_temp.assert_true(
 not exists(select 1 from public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000001') r
 where to_jsonb(r)-array['booking_id','venue_name','slots'] <> '{}'::jsonb
 or exists(select 1 from jsonb_array_elements(r.slots) s
   where s-array['date','slot','startsAt','endsAt','kind'] <> '{}'::jsonb))
 and not exists(select 1 from public.venue_bookings where event_id='42100000-0000-0000-0000-000000000001')
 and not exists(select 1 from public.venue_slot_claims where booking_id='42300000-0000-0000-0000-000000000001'),
 'AC-042.3.1: response exposes only permitted fields without granting direct staff-record access');

-- All refusal paths use real authenticated/anonymous roles, not an administrator read.
do $$
declare target uuid; actor text; refused boolean;
begin
 foreach target in array array[null::uuid,'42100000-0000-0000-0000-000000000099'::uuid] loop
  refused:=false;
  begin perform public.get_organiser_venue_arrangements(target);
  exception when insufficient_privilege then refused:=true; end;
  if not refused then raise exception 'AC-042.3.2: invalid event accepted'; end if;
 end loop;
 foreach actor in array array['42000000-0000-0000-0000-000000000002','42000000-0000-0000-0000-000000000003',''] loop
  perform set_config('request.jwt.claim.sub',actor,true);
  refused:=false;
  begin perform public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000001');
  exception when insufficient_privilege then refused:=true; end;
  if not refused then raise exception 'AC-042.3.2: unauthorised caller accepted: %',actor; end if;
 end loop;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform public.get_organiser_venue_arrangements('42100000-0000-0000-0000-000000000001');
  raise exception 'AC-042.3.2: anonymous caller accepted';
 exception when insufficient_privilege then null;
 end;
 raise notice 'PASS: AC-042.3.2: unrelated organiser, staff, signed-out and invalid-event reads are refused';
end $$;
reset role;
rollback;
