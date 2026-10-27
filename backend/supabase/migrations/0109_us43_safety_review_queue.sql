-- US43 Operational safety review (SCRUM-239), slice 2: the Safety Officer's review queue.
-- AC-043.4 A Safety Officer sees the events awaiting review, oldest first, each with what the
-- Operational Safety Check needs: expected attendance, the booked venues with their capacity for
-- the chosen layout, accessibility requirements, reserved equipment and any known venue
-- restrictions. Read-only: nothing here changes an event. Apply after 0108 and 0100 (it reads
-- continuous venue blocks); both runners skip it in their first pass and run_venue_time_conversion.sh
-- tests it after 0100. Safe to replay.
--
-- "Known venue restrictions" are the ones the system records: the venue being retired or under
-- maintenance, its opening hours, and any active venue block (US12) on the event's dates.
begin;

create or replace function public.get_safety_review_queue()
returns table (
  event_id uuid, reference text, name text, sent_at timestamptz, proposed_start timestamptz,
  proposed_end timestamptz, expected_attendance integer, accessibility jsonb, venues jsonb, equipment jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'safety_officer' then
    raise exception 'Only a Safety Officer can see the safety review queue' using errcode = '42501';
  end if;

  return query
  select e.id, e.reference, e.name, e.safety_review_requested_at, e.proposed_start, e.proposed_end,
         e.expected_attendance,
         -- The event's accessibility requirements, by label.
         coalesce((select jsonb_agg(coalesce(a.label, req.code) order by coalesce(a.label, req.code))
                   from unnest(coalesce(e.accessibility_requirements, '{}')) as req(code)
                   left join public.accessibility_types a on a.code = req.code), '[]'::jsonb),
         -- Each approved venue booking: the space's layout and attendance (US49, else the event's),
         -- the venue's capacity for that layout, its accessibility, and its known restrictions.
         coalesce((select jsonb_agg(jsonb_build_object(
                     'venue', v.name,
                     'location', v.location,
                     'layout', coalesce(lt.label, coalesce(b.space_layout, e.layout_preference)),
                     'attendance', coalesce(b.space_attendance, e.expected_attendance),
                     'capacity', coalesce(vl.capacity, v.capacity),
                     'accessibility', coalesce((select jsonb_agg(coalesce(a.label, f.code) order by coalesce(a.label, f.code))
                                                from unnest(coalesce(v.accessibility, '{}')) as f(code)
                                                left join public.accessibility_types a on a.code = f.code), '[]'::jsonb),
                     'restrictions', coalesce((
                        select jsonb_agg(r.note order by r.ord) from (
                          select 1 as ord, format('Retired: %s', coalesce(v.retirement_note, 'no reason recorded')) as note
                           where v.status = 'retired'
                          union all
                          select 2, 'Under maintenance' where v.status = 'under_maintenance'
                          union all
                          select 3, format('Open %s to %s', to_char(v.opens_at, 'HH24:MI'), to_char(v.closes_at, 'HH24:MI'))
                           where v.opens_at is not null and not (v.opens_at = '00:00' and v.closes_at = '24:00')
                          union all
                          select 4, format('Blocked on the event''s dates: %s', c.reason)
                            from public.venue_closures c
                           where c.venue_id = v.id and c.removed_at is null
                             and case when c.starts_at is not null
                                      then tstzrange(c.starts_at, c.ends_at) && tstzrange(e.proposed_start, e.proposed_end)
                                      else daterange(c.starts_on, c.ends_on, '[]')
                                           && daterange((e.proposed_start at time zone 'Asia/Singapore')::date,
                                                        (e.proposed_end at time zone 'Asia/Singapore')::date, '[]')
                                 end
                        ) r), '[]'::jsonb)
                   ) order by v.name)
                   from public.venue_bookings b
                   join public.venues v on v.id = b.venue_id
                   left join public.venue_layouts vl on vl.venue_id = v.id and vl.layout = coalesce(b.space_layout, e.layout_preference)
                   left join public.layout_types lt on lt.code = coalesce(b.space_layout, e.layout_preference)
                   where b.event_id = e.id and b.status = 'confirmed'), '[]'::jsonb),
         -- Each equipment request: what, how many, whether essential, its status, and how many
         -- items are actually reserved for it.
         coalesce((select jsonb_agg(jsonb_build_object(
                     'item', t.name,
                     'quantity', r.quantity,
                     'essential', r.essential,
                     'status', r.status,
                     'reserved', (select count(*) from public.equipment_allocations al
                                   where r.booking_line_id is not null and al.line_id = r.booking_line_id
                                     and al.status in ('reserved', 'checked_out'))
                   ) order by r.essential desc, t.name)
                   from public.event_equipment_requirements r
                   join public.equipment_types t on t.id = r.type_id
                   where r.event_id = e.id), '[]'::jsonb)
  from public.events e
  where e.status = 'awaiting_safety_review'
  order by e.safety_review_requested_at nulls last, e.created_at, e.id;
end $$;

revoke all on function public.get_safety_review_queue() from public, anon;
grant execute on function public.get_safety_review_queue() to authenticated;

commit;
