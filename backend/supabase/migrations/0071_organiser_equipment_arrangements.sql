-- US42: organiser-safe equipment outcomes; reservation writes remain owned by US14.
begin;

create or replace function public.get_organiser_equipment_arrangements(p_event_id uuid)
returns table (
  requirement_id uuid,
  equipment_name text,
  quantity_requested integer,
  quantity_reserved integer,
  status text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  -- Match the venue read boundary; organisation-wide access belongs to US31.
  if auth.uid() is null
    or public.current_user_role() is distinct from 'organiser'
    or not exists (select 1 from public.events e
      where e.id = p_event_id and e.organiser_id = auth.uid()) then
    raise exception 'Event arrangements unavailable' using errcode = '42501';
  end if;

  return query
  select r.id, t.name, r.quantity,
    case when r.status = 'pending_review' then 0
      else coalesce(l.quantity_reserved, 0) end,
    r.status
  from public.event_equipment_requirements r
  join public.equipment_types t on t.id = r.type_id
  left join public.equipment_booking_lines l on l.id = r.booking_line_id
  where r.event_id = p_event_id
  order by t.name, r.id;
  -- Read the current requirement link, not historical lines or suggested alternatives.
  -- No technical notes, allocation identities, staff details or audit fields leave here.
end;
$$;

revoke all on function public.get_organiser_equipment_arrangements(uuid) from public, anon;
grant execute on function public.get_organiser_equipment_arrangements(uuid) to authenticated;
commit;
