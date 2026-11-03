-- US43 (0123): the safety review is switched on. Run last by both runners, after every earlier
-- suite (written for the switch's old default; those needing it on switch it on themselves).
begin;
create function pg_temp.us43_on_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

select pg_temp.us43_on_assert(
  (select enabled from public.safety_review_settings) and public.safety_review_enabled(),
  'AC-043.1.20: after every migration the safety review is switched on, so events are confirmed only after their safety review');

rollback;
