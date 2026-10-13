-- US41: review records for arrangements affected by approved significant changes.
-- Booking/claim/allocation rows remain unchanged. No historical backfill.
begin;
create table if not exists public.arrangement_review_flags (
 id uuid primary key default gen_random_uuid(),
 change_request_id uuid not null references public.event_change_requests(id),
 event_id uuid not null references public.events(id),
 venue_booking_id uuid references public.venue_bookings(id),
 equipment_booking_id uuid references public.equipment_bookings(id),
 reason_code text not null check (reason_code in ('venue_time_conflict','venue_timing_changed',
   'venue_capacity','venue_layout_review','venue_accessibility_review',
   'equipment_time_conflict','equipment_timing_changed','equipment_requirements_review')),
 detail text not null check (length(btrim(detail))>0),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by uuid references public.profiles(id),
 resolution text,
 resolution_method text check(resolution_method in ('corrected','confirmed_valid')),
 check(num_nonnulls(venue_booking_id,equipment_booking_id)=1),
 check((status='resolved') = (resolved_at is not null and resolved_by is not null
   and nullif(btrim(resolution),'') is not null and resolution_method is not null))
);
create unique index if not exists arrangement_review_venue_reason on public.arrangement_review_flags
 (change_request_id,venue_booking_id,reason_code) where venue_booking_id is not null;
create unique index if not exists arrangement_review_equipment_reason on public.arrangement_review_flags
 (change_request_id,equipment_booking_id,reason_code) where equipment_booking_id is not null;
create index if not exists arrangement_review_event on public.arrangement_review_flags(event_id,status);
alter table public.arrangement_review_flags enable row level security;
revoke all on public.arrangement_review_flags from public,anon,authenticated;
grant select on public.arrangement_review_flags to authenticated;
drop policy if exists arrangement_review_current_coordinator on public.arrangement_review_flags;
create policy arrangement_review_current_coordinator on public.arrangement_review_flags
 for select to authenticated using (public.current_user_role()='coordinator' and exists(
 select 1 from public.events e where e.id=event_id and e.coordinator_id=auth.uid()));

create table if not exists public.arrangement_review_notifications (
 id uuid primary key default gen_random_uuid(),
 flag_id uuid not null unique references public.arrangement_review_flags(id),
 event_id uuid not null references public.events(id),
 recipient_id uuid not null references public.profiles(id),
 detail text not null,
 created_at timestamptz not null default now()
);
alter table public.arrangement_review_notifications enable row level security;
revoke all on public.arrangement_review_notifications from public,anon,authenticated;
grant select on public.arrangement_review_notifications to authenticated;
drop policy if exists arrangement_notice_recipient on public.arrangement_review_notifications;
create policy arrangement_notice_recipient on public.arrangement_review_notifications
 for select to authenticated using (recipient_id=auth.uid() and public.current_user_role()='coordinator'
 and exists(select 1 from public.events e where e.id=event_id and e.coordinator_id=auth.uid()));

-- Internal helper stores one reason per affected arrangement and immutable notice.
create or replace function public.record_arrangement_review(
 p_request uuid,p_event uuid,p_venue_booking uuid,p_equipment_booking uuid,p_code text,p_detail text)
returns void language plpgsql security definer set search_path='' as $$
declare flag uuid; recipient uuid;
begin
 insert into public.arrangement_review_flags(change_request_id,event_id,venue_booking_id,
  equipment_booking_id,reason_code,detail)
 values(p_request,p_event,p_venue_booking,p_equipment_booking,p_code,p_detail)
 on conflict do nothing returning id into flag;
 if flag is null then return; end if;
 select e.coordinator_id into recipient from public.events e join public.profiles p
 on p.id=e.coordinator_id and p.role='coordinator' where e.id=p_event;
 if recipient is not null then
  insert into public.arrangement_review_notifications(flag_id,event_id,recipient_id,detail)
  values(flag,p_event,recipient,p_detail);
 end if;
end $$;
revoke all on function public.record_arrangement_review(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;

-- Run synchronously after US7 inserts its accepted-field record, in the same transaction.
-- The existing queue contract is preserved; checked_at distinguishes evaluated records.
alter table public.event_change_revalidations add column if not exists checked_at timestamptz;
create or replace function public.check_changed_arrangements()
returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events; b record; capacity integer; requested_layout text;
 timing boolean; first_day date; last_day date; conflict_found boolean;
begin
 select * into strict e from public.events where id=new.event_id;
 timing:=new.approved_fields && array['proposedStart','proposedEnd'];
 first_day:=(e.proposed_start at time zone 'Asia/Singapore')::date;
 last_day:=(e.proposed_end at time zone 'Asia/Singapore')::date;
 if new.venue_required then
  for b in select vb.*,v.name as venue_name from public.venue_bookings vb
   join public.venues v on v.id=vb.venue_id where vb.event_id=e.id
   and (vb.status in ('pending_approval','confirmed') or
     (vb.status='held' and vb.hold_expires_at>now())) loop
   if timing then
    select exists(select 1 from public.venue_review_cells(e.proposed_start,e.proposed_end) c
     where exists(select 1 from public.venue_closures x where x.venue_id=b.venue_id
       and x.removed_at is null and c.slot_date between x.starts_on and x.ends_on and c.slot=any(x.slots))
     or exists(select 1 from public.venue_slot_claims s
       left join public.venue_bookings other on other.id=s.booking_id
       where s.venue_id=b.venue_id and s.slot_date=c.slot_date and s.slot=c.slot
       and s.booking_id is distinct from b.id
       and (s.kind='maintenance' or other.status in ('pending_approval','confirmed')
         or (other.status='held' and other.hold_expires_at>now())))) into conflict_found;
    if conflict_found then
     perform public.record_arrangement_review(new.change_request_id,e.id,b.id,null,'venue_time_conflict',
      format('%s: the updated event timing, including setup/turnaround, conflicts with an active booking, hold or venue block.',b.venue_name));
    end if;
    -- A free new interval is not an existing reservation for that interval.
    if not exists(select 1 from public.venue_review_cells(e.proposed_start,e.proposed_end)) or exists(
      (select slot_date,slot,kind from public.venue_review_cells(e.proposed_start,e.proposed_end)
       except select slot_date,slot,kind from public.venue_slot_claims where booking_id=b.id)
      union all
      (select slot_date,slot,kind from public.venue_slot_claims where booking_id=b.id
       except select slot_date,slot,kind from public.venue_review_cells(e.proposed_start,e.proposed_end))) then
     perform public.record_arrangement_review(new.change_request_id,e.id,b.id,null,'venue_timing_changed',
      format('%s: the existing reserved slots do not match the updated event timing. Review or replace this booking; no slots were moved.',b.venue_name));
    end if;
   end if;
   if new.approved_fields && array['expectedAttendance','layoutPreference'] then
    -- A changed event layout takes precedence over an older structured requirement.
    if 'layoutPreference'=any(new.approved_fields) then requested_layout:=public.layout_code(e.layout_preference);
    else
     select coalesce(r.layout,public.layout_code(e.layout_preference)) into requested_layout
      from (select 1) seed left join public.event_venue_requirements r on r.event_id=e.id;
    end if;
    select vl.capacity into capacity from public.venue_layouts vl
     where vl.venue_id=b.venue_id and vl.layout=requested_layout;
    if capacity is null then
     perform public.record_arrangement_review(new.change_request_id,e.id,b.id,null,'venue_layout_review',
      format('%s: capacity for the requested layout (%s) could not be verified. Review the layout and attendance manually.',b.venue_name,coalesce(requested_layout,'unspecified')));
    elsif e.expected_attendance>capacity then
     perform public.record_arrangement_review(new.change_request_id,e.id,b.id,null,'venue_capacity',
      format('%s: updated attendance is %s; capacity for layout %s is %s.',b.venue_name,e.expected_attendance,requested_layout,capacity));
    elsif 'layoutPreference'=any(new.approved_fields) then
     perform public.record_arrangement_review(new.change_request_id,e.id,b.id,null,'venue_layout_review',
      format('%s: requested layout changed to %s. Capacity is sufficient; confirm the existing venue arrangement uses this layout.',b.venue_name,requested_layout));
    end if;
   end if;
   if 'accessibilityRequirements'=any(new.approved_fields) then
    perform public.record_arrangement_review(new.change_request_id,e.id,b.id,null,'venue_accessibility_review',
     format('%s: accessibility requirements changed to "%s". Check that this venue arrangement meets them; no incompatibility has been assumed.',b.venue_name,coalesce(nullif(e.accessibility_requirements,''),'none specified')));
   end if;
  end loop;
 end if;
 if new.equipment_required then
  for b in select eb.* from public.equipment_bookings eb where eb.event_id=e.id
   and eb.status not in ('rejected','cancelled','completed')
   and exists(select 1 from public.equipment_booking_lines l join public.equipment_allocations a on a.line_id=l.id
     where l.booking_id=eb.id and a.status in ('reserved','checked_out')) loop
   if timing then
    -- Preserve the previously agreed return-day extension when evaluating new dates.
    select exists(select 1 from public.equipment_booking_lines l
      join public.equipment_allocations a on a.line_id=l.id
      where l.booking_id=b.id and a.status in ('reserved','checked_out')
      and not exists(select 1 from public.equipment_free_units(l.type_id,e.id,first_day,last_day+greatest(a.blocked_to-b.use_to,0),l.id) u
        where u.item_id=a.item_id)) into conflict_found;
    if conflict_found then
     perform public.record_arrangement_review(new.change_request_id,e.id,null,b.id,'equipment_time_conflict',
      'Reserved equipment cannot satisfy the updated timing: a reserved unit is unavailable or non-operational during the required collection/use/return window.');
    end if;
    if b.use_from is distinct from first_day or b.use_to is distinct from last_day then
     perform public.record_arrangement_review(new.change_request_id,e.id,null,b.id,'equipment_timing_changed',
      format('Equipment was reserved for %s to %s; event dates are now %s to %s. Review the reservation and return window; no allocation was moved.',b.use_from,b.use_to,first_day,last_day));
    end if;
   end if;
   if 'equipmentRequirements'=any(new.approved_fields) then
    perform public.record_arrangement_review(new.change_request_id,e.id,null,b.id,'equipment_requirements_review',
     format('Equipment requirements changed to "%s". Compare this reservation with the revised requirements; no shortage has been assumed.',coalesce(nullif(e.equipment_requirements,''),'none specified')));
   end if;
  end loop;
 end if;
 update public.event_change_revalidations set checked_at=now() where change_request_id=new.change_request_id;
 return new;
end $$;
revoke all on function public.check_changed_arrangements() from public,anon,authenticated;
drop trigger if exists revalidate_approved_arrangements on public.event_change_revalidations;
create trigger revalidate_approved_arrangements after insert on public.event_change_revalidations
 for each row execute function public.check_changed_arrangements();

create or replace function public.resolve_arrangement_review(p_flag uuid,p_method text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_event uuid; f public.arrangement_review_flags;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
  raise exception 'Only the assigned Coordinator can resolve arrangement reviews' using errcode='42501';
 end if;
 if p_method is null or p_method not in ('corrected','confirmed_valid') or nullif(btrim(p_note),'') is null then
  raise exception 'Choose a resolution and record an explanation' using errcode='22023';
 end if;
 select event_id into target_event from public.arrangement_review_flags where id=p_flag;
 perform 1 from public.events where id=target_event and coordinator_id=auth.uid() for update;
 if not found then raise exception 'Arrangement review unavailable' using errcode='42501'; end if;
 select * into f from public.arrangement_review_flags where id=p_flag for update;
 if f.status<>'open' then raise exception 'Review already resolved; reload' using errcode='40001'; end if;
 update public.arrangement_review_flags set status='resolved',resolved_at=now(),resolved_by=auth.uid(),
 resolution=btrim(p_note),resolution_method=p_method where id=p_flag;
 return p_flag;
end $$;
revoke all on function public.resolve_arrangement_review(uuid,text,text) from public,anon;
grant execute on function public.resolve_arrangement_review(uuid,text,text) to authenticated;
commit;
