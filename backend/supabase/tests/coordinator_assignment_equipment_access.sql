-- US17 AC4 follow-up: equipment-story owner review required before merging.
-- Run in the disposable database test runner, never in the shared SQL editor.
begin;
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('17600000-0000-0000-0000-000000000001', 'lead-us17-equipment@example.test'),
  ('17600000-0000-0000-0000-000000000002', 'organiser-us17-equipment@example.test'),
  ('17600000-0000-0000-0000-000000000003', 'old-us17-equipment@example.test'),
  ('17600000-0000-0000-0000-000000000004', 'new-us17-equipment@example.test'),
  ('17600000-0000-0000-0000-000000000005', 'other-us17-equipment@example.test');
update public.profiles set role = case id
  when '17600000-0000-0000-0000-000000000001'::uuid then 'coordinator_lead'
  when '17600000-0000-0000-0000-000000000002'::uuid then 'organiser'
  else 'coordinator' end
where id::text like '17600000-%';
insert into public.events (id, organiser_id, coordinator_id, name, purpose,
  proposed_start, proposed_end, expected_attendance, status) values
  ('17610000-0000-0000-0000-000000000001', '17600000-0000-0000-0000-000000000002',
   '17600000-0000-0000-0000-000000000003', 'Equipment handover', 'US17 permission test',
   '2030-01-01 01:00+00', '2030-01-01 02:00+00', 10, 'approved');
insert into public.equipment_types (id, name, category) values
  ('17620000-0000-0000-0000-000000000001', 'US17 test microphone', 'Audio');
-- Existing booking and staff-proposed alternative, before reassignment.
insert into public.equipment_bookings (id, event_id, requested_by, use_from, use_to) values
  ('17630000-0000-0000-0000-000000000001', '17610000-0000-0000-0000-000000000001',
   '17600000-0000-0000-0000-000000000003', '2030-01-01', '2030-01-01');
insert into public.equipment_booking_lines
  (id, booking_id, type_id, quantity_requested, origin, status, substitutes_line_id) values
  ('17640000-0000-0000-0000-000000000001', '17630000-0000-0000-0000-000000000001',
   '17620000-0000-0000-0000-000000000001', 1, 'requested', 'pending', null),
  ('17640000-0000-0000-0000-000000000002', '17630000-0000-0000-0000-000000000001',
   '17620000-0000-0000-0000-000000000001', 1, 'suggested', 'proposed',
   '17640000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '17600000-0000-0000-0000-000000000001', true);
select public.assign_event_coordinator('17610000-0000-0000-0000-000000000001',
  '17600000-0000-0000-0000-000000000004');

do $$
declare actor text; operation text; affected integer; expected integer;
begin
  -- One handover scenario: old and unrelated coordinators lose authority;
  -- the newly assigned coordinator can use the existing coordinator actions.
  foreach actor in array array[
    '17600000-0000-0000-0000-000000000003',
    '17600000-0000-0000-0000-000000000005',
    '17600000-0000-0000-0000-000000000004'
  ] loop
    perform set_config('request.jwt.claim.sub', actor, true);
    expected := case when actor = '17600000-0000-0000-0000-000000000004' then 1 else 0 end;
    foreach operation in array array['cancel', 'accept_alternative', 'decline_alternative', 'create_booking', 'add_line'] loop
      affected := 0;
      begin
        case operation
          when 'cancel' then
            update public.equipment_bookings set status = 'cancelled'
              where id = '17630000-0000-0000-0000-000000000001';
          when 'accept_alternative', 'decline_alternative' then
            update public.equipment_booking_lines
              set status = case when operation = 'accept_alternative' then 'pending' else 'declined' end
              where id = '17640000-0000-0000-0000-000000000002';
          when 'create_booking' then
            insert into public.equipment_bookings (event_id, requested_by, use_from, use_to) values
              ('17610000-0000-0000-0000-000000000001', auth.uid(), '2030-01-01', '2030-01-01');
          when 'add_line' then
            insert into public.equipment_booking_lines (booking_id, type_id, quantity_requested) values
              ('17630000-0000-0000-0000-000000000001', '17620000-0000-0000-0000-000000000001', 1);
        end case;
        get diagnostics affected = row_count;
        if expected = 1 and operation = 'cancel' and not exists (
          select 1 from public.equipment_bookings
          where id = '17630000-0000-0000-0000-000000000001'
            and requested_by = '17600000-0000-0000-0000-000000000003'
            and event_id = '17610000-0000-0000-0000-000000000001'
        ) then
          raise exception 'FAIL: AC-017.4.4: handover must preserve the original requester and event';
        end if;
        -- Undo each successful probe so later operations see the same fixture.
        raise exception using errcode = 'P1701', message = 'rollback permission probe';
      exception
        when sqlstate 'P1701' then null;
        when insufficient_privilege then affected := 0;
      end;
      if affected <> expected then
        raise exception 'FAIL: AC-017.4.4: equipment action % by coordinator % affected % rows; expected % after reassignment',
          operation, actor, affected, expected;
      end if;
    end loop;
  end loop;
  raise notice 'PASS: AC-017.4.4: equipment booking and line management follows the current coordinator after reassignment';
end $$;

-- Additional regression coverage, not a separate red/green cycle.
do $$
declare operation text; denied boolean;
begin
  perform set_config('request.jwt.claim.sub', '17600000-0000-0000-0000-000000000004', true);
  foreach operation in array array['rewrite_requester', 'rewrite_reservation'] loop
    denied := false;
    begin
      if operation = 'rewrite_requester' then
        update public.equipment_bookings set status = 'cancelled', requested_by = auth.uid()
          where id = '17630000-0000-0000-0000-000000000001';
      else
        update public.equipment_booking_lines set status = 'pending', quantity_reserved = 1
          where id = '17640000-0000-0000-0000-000000000002';
      end if;
      raise exception using errcode = 'P1701', message = 'rollback permission probe';
    exception
      when sqlstate 'P1701' then null;
      when insufficient_privilege then denied := true;
    end;
    if not denied then
      raise exception 'FAIL: AC-017.4.5: handover must not permit %', operation;
    end if;
  end loop;
  raise notice 'PASS: AC-017.4.5: handover preserves requester identity and staff reservation quantities';
end $$;
rollback;
