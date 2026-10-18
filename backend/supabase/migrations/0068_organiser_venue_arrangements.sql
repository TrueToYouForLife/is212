-- US42: expose confirmed venue arrangements without exposing staff records.
begin;

create or replace function public.get_organiser_venue_arrangements(p_event_id uuid)
returns table (booking_id uuid, venue_name text, slots jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Keep ownership enforcement in the database, including for direct RPC calls.
  -- Organisation-wide access belongs to US31; this function currently permits the owner.
  if auth.uid() is null
    or public.current_user_role() is distinct from 'organiser'
    or not exists (
      select 1 from public.events e
      where e.id = p_event_id and e.organiser_id = auth.uid()
    ) then
    raise exception 'Event arrangements unavailable' using errcode = '42501';
  end if;

  return query
  select b.id, v.name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', c.slot_date,
        'slot', c.slot,
        'startsAt', t.starts_at,
        'endsAt', t.ends_at,
        'kind', c.kind
      ) order by c.slot_date, t.sort_order, c.slot)
      from public.venue_slot_claims c
      join public.time_slots t on t.code = c.slot
      where c.booking_id = b.id and c.kind in ('event', 'buffer')
    ), '[]'::jsonb)
  from public.venue_bookings b
  join public.venues v on v.id = b.venue_id
  where b.event_id = p_event_id and b.status = 'confirmed'
  order by v.name, b.id;
  -- Read the saved reservation, not proposed event dates that may have changed.
  -- A booking without ledger cells stays visible with an empty slots list.
end;
$$;

revoke all on function public.get_organiser_venue_arrangements(uuid) from public, anon;
grant execute on function public.get_organiser_venue_arrangements(uuid) to authenticated;

commit;
