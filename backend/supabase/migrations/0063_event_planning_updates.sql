-- US20 Slice 1: assigned-coordinator edits, immutable history and arrangement reviews.
-- Reserved migration 0063. No historical backfill and no reservation movement.
begin;
create table if not exists public.event_planning_updates (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id),
 changed_by uuid not null references public.profiles(id),
 changed_by_name text not null,
 changed_at timestamptz not null default clock_timestamp(),
 changes jsonb not null check(jsonb_typeof(changes)='object' and changes<>'{}'::jsonb)
);
create index if not exists event_planning_updates_order on public.event_planning_updates(event_id,changed_at,id);
alter table public.event_planning_updates enable row level security;
revoke all on public.event_planning_updates from public,anon,authenticated;
grant select on public.event_planning_updates to authenticated;
drop policy if exists planning_updates_assigned on public.event_planning_updates;
create policy planning_updates_assigned on public.event_planning_updates for select to authenticated
 using(public.current_user_role()='coordinator' and exists(select 1 from public.events e
 where e.id=event_id and e.coordinator_id=auth.uid()));

-- A review may originate from an organiser request OR a coordinator edit, never a
-- fabricated organiser request. Existing US41 readers/resolution policies still apply.
alter table public.arrangement_review_flags alter column change_request_id drop not null;
alter table public.arrangement_review_flags add column if not exists planning_update_id uuid
 references public.event_planning_updates(id);
alter table public.arrangement_review_flags drop constraint if exists arrangement_review_source;
alter table public.arrangement_review_flags add constraint arrangement_review_source
 check(num_nonnulls(change_request_id,planning_update_id)=1);
create unique index if not exists planning_review_venue_reason on public.arrangement_review_flags
 (planning_update_id,venue_booking_id,reason_code) where planning_update_id is not null;
create unique index if not exists planning_review_equipment_reason on public.arrangement_review_flags
 (planning_update_id,equipment_booking_id,reason_code) where planning_update_id is not null;
alter table public.arrangement_review_flags drop constraint if exists arrangement_review_flags_reason_code_check;
alter table public.arrangement_review_flags add constraint arrangement_review_flags_reason_code_check
 check(reason_code in ('venue_time_conflict','venue_timing_changed','venue_capacity','venue_layout_review',
 'venue_accessibility_review','venue_facility_review','equipment_time_conflict','equipment_timing_changed','equipment_requirements_review'));
create or replace function public.record_arrangement_review(
 p_request uuid,p_event uuid,p_venue_booking uuid,p_equipment_booking uuid,p_code text,p_detail text,p_update uuid)
returns void language plpgsql security definer set search_path='' as $$
declare flag uuid; recipient uuid;
begin
 insert into public.arrangement_review_flags(change_request_id,event_id,venue_booking_id,
  equipment_booking_id,reason_code,detail,planning_update_id)
 values(p_request,p_event,p_venue_booking,p_equipment_booking,p_code,p_detail,p_update)
 on conflict do nothing returning id into flag;
 if flag is null then return; end if;
 select e.coordinator_id into recipient from public.events e join public.profiles p
 on p.id=e.coordinator_id and p.role='coordinator' where e.id=p_event;
 if recipient is not null then
  insert into public.arrangement_review_notifications(flag_id,event_id,recipient_id,detail)
  values(flag,p_event,recipient,p_detail);
 end if;
end $$;
revoke all on function public.record_arrangement_review(uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;

create or replace function public.record_arrangement_review(
 p_request uuid,p_event uuid,p_venue_booking uuid,p_equipment_booking uuid,p_code text,p_detail text)
returns void language sql security definer set search_path='' as $$
 select public.record_arrangement_review(p_request,p_event,p_venue_booking,p_equipment_booking,p_code,p_detail,null);
$$;
revoke all on function public.record_arrangement_review(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
create or replace function public.revalidate_event_arrangements(p_event uuid,p_fields text[],p_venue boolean,p_equipment boolean,p_request uuid,p_update uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events; b record; capacity integer; requested_layout text;
 timing boolean; first_day date; last_day date; conflict_found boolean;
begin
 select * into strict e from public.events where id=p_event;
 timing:=p_fields && array['proposedStart','proposedEnd'];
 first_day:=(e.proposed_start at time zone 'Asia/Singapore')::date;
 last_day:=(e.proposed_end at time zone 'Asia/Singapore')::date;
 if p_venue then
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
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_time_conflict',
      format('%s: the updated event timing, including setup/turnaround, conflicts with an active booking, hold or venue block.',b.venue_name),p_update);
    end if;
    -- A free new interval is not an existing reservation for that interval.
    if not exists(select 1 from public.venue_review_cells(e.proposed_start,e.proposed_end)) or exists(
      (select slot_date,slot,kind from public.venue_review_cells(e.proposed_start,e.proposed_end)
       except select slot_date,slot,kind from public.venue_slot_claims where booking_id=b.id)
      union all
      (select slot_date,slot,kind from public.venue_slot_claims where booking_id=b.id
       except select slot_date,slot,kind from public.venue_review_cells(e.proposed_start,e.proposed_end))) then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_timing_changed',
      format('%s: the existing reserved slots do not match the updated event timing. Review or replace this booking; no slots were moved.',b.venue_name),p_update);
    end if;
   end if;
   if p_fields && array['expectedAttendance','layoutPreference'] then
    -- An approved layout supersedes older structured requirements, including on later
    -- attendance changes. A subsequent coordinator save confirms their structured layout.
    if 'layoutPreference'=any(p_fields) then requested_layout:=public.layout_code(e.layout_preference);
    else
     select case
       when r.updated_at > coalesce((select max(q.created_at)
         from (select created_at from public.event_change_revalidations where event_id=e.id and 'layoutPreference'=any(approved_fields)
           union all select changed_at from public.event_planning_updates where event_id=e.id and changes ? 'layoutPreference') q), '-infinity'::timestamptz)
       then coalesce(r.layout,public.layout_code(e.layout_preference))
       else public.layout_code(e.layout_preference)
      end into requested_layout
      from (select 1) seed left join public.event_venue_requirements r on r.event_id=e.id;
    end if;
    select vl.capacity into capacity from public.venue_layouts vl
     where vl.venue_id=b.venue_id and vl.layout=requested_layout;
    if capacity is null then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_layout_review',
      format('%s: capacity for the requested layout (%s) could not be verified. Review the layout and attendance manually.',b.venue_name,coalesce(requested_layout,'unspecified')),p_update);
    elsif e.expected_attendance>capacity then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_capacity',
      format('%s: updated attendance is %s; capacity for layout %s is %s.',b.venue_name,e.expected_attendance,requested_layout,capacity),p_update);
    elsif 'layoutPreference'=any(p_fields) then
     perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_layout_review',
      format('%s: requested layout changed to %s. Capacity is sufficient; confirm the existing venue arrangement uses this layout.',b.venue_name,requested_layout),p_update);
    end if;
   end if;
   if 'facilityRequirements'=any(p_fields) then
    perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_facility_review',
     format('%s: venue facility requirements changed. Check the existing arrangement against the updated facilities.',b.venue_name),p_update);
   end if;
   if 'accessibilityRequirements'=any(p_fields) then
    perform public.record_arrangement_review(p_request,e.id,b.id,null,'venue_accessibility_review',
     format('%s: accessibility requirements changed to "%s". Check that this venue arrangement meets them; no incompatibility has been assumed.',b.venue_name,coalesce(nullif(array_to_string(e.accessibility_requirements, ', '),''),'none specified')),p_update);
   end if;
  end loop;
 end if;
 if p_equipment then
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
     perform public.record_arrangement_review(p_request,e.id,null,b.id,'equipment_time_conflict',
      'Reserved equipment cannot satisfy the updated timing: a reserved unit is unavailable or non-operational during the required collection/use/return window.',p_update);
    end if;
    if b.use_from is distinct from first_day or b.use_to is distinct from last_day then
     perform public.record_arrangement_review(p_request,e.id,null,b.id,'equipment_timing_changed',
      format('Equipment was reserved for %s to %s; event dates are now %s to %s. Review the reservation and return window; no allocation was moved.',b.use_from,b.use_to,first_day,last_day),p_update);
    end if;
   end if;
   if 'equipmentRequirements'=any(p_fields) then
    perform public.record_arrangement_review(p_request,e.id,null,b.id,'equipment_requirements_review',
     format('Equipment requirements changed to "%s". Compare this reservation with the revised requirements; no shortage has been assumed.',coalesce(nullif(array_to_string(e.equipment_requirements, ', '),''),'none specified')),p_update);
   end if;
  end loop;
 end if;

end $$;
revoke all on function public.revalidate_event_arrangements(uuid,text[],boolean,boolean,uuid,uuid) from public,anon,authenticated;
create or replace function public.check_changed_arrangements()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.revalidate_event_arrangements(new.event_id,new.approved_fields,new.venue_required,new.equipment_required,new.change_request_id,null);
 update public.event_change_revalidations set checked_at=now() where change_request_id=new.change_request_id;
 return new;
end $$;
revoke all on function public.check_changed_arrangements() from public,anon,authenticated;

-- One projection defines both the edit whitelist and the audit values.
create or replace function public.event_planning_values(e public.events)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'name',e.name,
  'purpose',e.purpose,
  'eventType',e.event_type,
  'description',e.description,
  'proposedStart',e.proposed_start,
  'proposedEnd',e.proposed_end,
  'expectedAttendance',e.expected_attendance,
  'programme',e.programme,
  'layoutPreference',e.layout_preference,
  'accessibilityRequirements',e.accessibility_requirements,
  'facilityRequirements',e.facility_requirements,
  'equipmentRequirements',e.equipment_requirements,
  'specialArrangements',e.special_arrangements);
$$;
revoke all on function public.event_planning_values(public.events) from public,anon,authenticated;

create or replace function public.get_event_planning(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
  raise exception 'Assigned coordinator required' using errcode='42501';
 end if;
 select * into e from public.events where id=p_event_id and coordinator_id=auth.uid();
 if not found then raise exception 'Assigned coordinator required' using errcode='42501'; end if;
 return jsonb_build_object('version',md5(to_jsonb(e)::text),'status',e.status,
  'values',public.event_planning_values(e),'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.changed_at,h.id)
   from public.event_planning_updates h where h.event_id=e.id),'[]'::jsonb));
end $$;
revoke all on function public.get_event_planning(uuid) from public,anon;
grant execute on function public.get_event_planning(uuid) to authenticated;

create or replace function public.update_event_planning(p_event_id uuid,p_version text,p_values jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; candidate public.events; before_values jsonb; after_values jsonb;
 patch jsonb; changes jsonb; fields text[]; update_id uuid; actor_name text; item record;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
  raise exception 'Assigned coordinator required' using errcode='42501';
 end if;
 select * into e from public.events where id=p_event_id and coordinator_id=auth.uid() for update;
 if not found then raise exception 'Assigned coordinator required' using errcode='42501'; end if;
 if e.status not in ('approved','planning') then
  raise exception 'Only approved or planning events may be edited' using errcode='22000';
 end if;
 if p_version is distinct from md5(to_jsonb(e)::text) then
  raise exception 'Event changed; reload before editing' using errcode='40001';
 end if;
 before_values:=public.event_planning_values(e);
 if p_values is null or jsonb_typeof(p_values)<>'object' then
  raise exception 'Invalid event details' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_object_keys(p_values) k where not before_values ? k) then
  raise exception 'Unsupported event field' using errcode='22023';
 end if;
 -- A partial patch cannot replace role, status, assignment or registration settings.
 for item in select key,value from jsonb_each(p_values) loop
  if item.key in ('accessibilityRequirements','facilityRequirements','equipmentRequirements') then
   if jsonb_typeof(item.value)<>'array' or exists(select 1 from jsonb_array_elements(item.value) x where jsonb_typeof(x)<>'string') then
    raise exception 'Requirement codes must be lists of strings' using errcode='22023';
   end if;
  elsif item.key='expectedAttendance' then
   if jsonb_typeof(item.value)<>'number' or (item.value::text)::numeric<>trunc((item.value::text)::numeric) then
    raise exception 'Attendance must be a whole number' using errcode='22023';
   end if;
  elsif jsonb_typeof(item.value) not in ('string','null') then
   raise exception 'Expected text' using errcode='22023';
  end if;
 end loop;
 select coalesce(jsonb_object_agg(case key
  when 'name' then 'name'
  when 'purpose' then 'purpose'
  when 'eventType' then 'event_type'
  when 'description' then 'description'
  when 'proposedStart' then 'proposed_start'
  when 'proposedEnd' then 'proposed_end'
  when 'expectedAttendance' then 'expected_attendance'
  when 'programme' then 'programme'
  when 'layoutPreference' then 'layout_preference'
  when 'accessibilityRequirements' then 'accessibility_requirements'
  when 'facilityRequirements' then 'facility_requirements'
  when 'equipmentRequirements' then 'equipment_requirements'
  when 'specialArrangements' then 'special_arrangements'
 end,value),'{}'::jsonb) into patch from jsonb_each(p_values);
 candidate:=jsonb_populate_record(e,patch);
 candidate.name:=nullif(btrim(candidate.name),'');
 candidate.purpose:=nullif(btrim(candidate.purpose),'');
 candidate.event_type:=nullif(btrim(candidate.event_type),'');
 candidate.description:=nullif(btrim(candidate.description),'');
 candidate.programme:=nullif(btrim(candidate.programme),'');
 candidate.layout_preference:=nullif(btrim(candidate.layout_preference),'');
 candidate.special_arrangements:=nullif(btrim(candidate.special_arrangements),'');
 if candidate.purpose is null or candidate.proposed_start is null or candidate.proposed_end is null
 or candidate.proposed_start<=clock_timestamp() or candidate.proposed_end<=candidate.proposed_start
 or candidate.expected_attendance is null or candidate.expected_attendance<1 then
  raise exception 'Purpose, future dates and positive attendance required' using errcode='22023';
 end if;
 if public.event_planning_values(candidate)=before_values then return null; end if;
 -- Database catalogue validation from 0054 also runs on this update.
 update public.events set
  name=candidate.name,
  purpose=candidate.purpose,
  event_type=candidate.event_type,
  description=candidate.description,
  proposed_start=candidate.proposed_start,
  proposed_end=candidate.proposed_end,
  expected_attendance=candidate.expected_attendance,
  programme=candidate.programme,
  layout_preference=candidate.layout_preference,
  accessibility_requirements=candidate.accessibility_requirements,
  facility_requirements=candidate.facility_requirements,
  equipment_requirements=candidate.equipment_requirements,
  special_arrangements=candidate.special_arrangements
 where id=e.id returning * into candidate;
 after_values:=public.event_planning_values(candidate);
 select jsonb_object_agg(k,jsonb_build_object('before',before_values->k,'after',after_values->k)),array_agg(k order by k)
 into changes,fields from jsonb_object_keys(before_values) k where before_values->k is distinct from after_values->k;
 if changes is null then return null; end if;
 select coalesce(nullif(full_name,''),'Coordinator') into actor_name from public.profiles where id=auth.uid();
 insert into public.event_planning_updates(event_id,changed_by,changed_by_name,changes)
 values(e.id,auth.uid(),actor_name,changes) returning id into update_id;
 perform public.revalidate_event_arrangements(e.id,fields,
  fields && array['proposedStart','proposedEnd','expectedAttendance','layoutPreference','accessibilityRequirements','facilityRequirements'],
  fields && array['proposedStart','proposedEnd','equipmentRequirements'],null,update_id);
 return update_id;
end $$;
revoke all on function public.update_event_planning(uuid,text,jsonb) from public,anon;
grant execute on function public.update_event_planning(uuid,text,jsonb) to authenticated;
commit;
