-- US47 foundation only: no existing reservation or slot calculation is changed.
begin;

alter table public.venues
  add column if not exists setup_minutes integer not null default 0,
  add column if not exists turnaround_minutes integer not null default 0;

alter table public.venues drop constraint if exists venues_buffer_minutes_valid;
alter table public.venues add constraint venues_buffer_minutes_valid check (
  setup_minutes >= 0 and setup_minutes % 15 = 0
  and turnaround_minutes >= 0 and turnaround_minutes % 15 = 0
);

-- Existing table-level UPDATE grants include newly added columns. Keep browser
-- changes disabled until the booking writers and review workflow use these fields.
-- Invoker security is intentional: trusted migration/RPC owners remain distinguishable.
create or replace function public.guard_venue_buffer_foundation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.setup_minutes <> 0 or new.turnaround_minutes <> 0 then
        raise exception 'Venue buffer configuration is not enabled yet' using errcode = '42501';
      end if;
    elsif new.setup_minutes is distinct from old.setup_minutes
       or new.turnaround_minutes is distinct from old.turnaround_minutes then
      raise exception 'Venue buffer configuration is not enabled yet' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_venue_buffer_foundation() from public, anon, authenticated;
drop trigger if exists venues_guard_buffer_foundation on public.venues;
create trigger venues_guard_buffer_foundation before insert or update on public.venues
  for each row execute function public.guard_venue_buffer_foundation();

-- Pure internal calculation: half-open bounds permit adjacent reservations.
-- Exact event instants are retained; this helper neither rounds times nor allocates cells.
create or replace function public.venue_occupied_period(
  p_start timestamptz, p_end timestamptz,
  p_setup_minutes integer, p_turnaround_minutes integer
)
returns tstzrange language plpgsql immutable set search_path = '' as $$
begin
  if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_end <= p_start then
    raise exception 'A finite event start before its end is required' using errcode = '22023';
  end if;
  if p_setup_minutes is null or p_turnaround_minutes is null
    or p_setup_minutes < 0 or p_turnaround_minutes < 0
    or p_setup_minutes % 15 <> 0 or p_turnaround_minutes % 15 <> 0 then
    raise exception 'Buffer durations must be non-negative multiples of 15 minutes' using errcode = '22023';
  end if;
  return tstzrange(
    p_start - make_interval(mins => p_setup_minutes),
    p_end + make_interval(mins => p_turnaround_minutes), '[)');
end;
$$;
revoke all on function public.venue_occupied_period(timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;

commit;
