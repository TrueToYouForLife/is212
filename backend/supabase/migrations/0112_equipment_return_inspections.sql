-- US24: date-based return inspections; no physical checkout or early reservation release.
-- Requires US27 (0105). Existing reports, allocation windows and history are retained.
begin;

alter table public.equipment_allocations
 add column if not exists inspection_version bigint not null default 0 check (inspection_version >= 0);
alter table public.equipment_defect_reports drop constraint if exists equipment_defect_reports_resulting_status_check;
alter table public.equipment_defect_reports add constraint equipment_defect_reports_resulting_status_check
 check (resulting_status in ('operational','needs_repair','under_repair','retired','missing','unavailable'));

create table if not exists public.equipment_return_inspections (
 id uuid primary key default gen_random_uuid(),
 allocation_id uuid not null references public.equipment_allocations(id),
 version bigint not null check (version > 0),
 finding text not null check (finding in ('good','defect','damage','missing','other')),
 description text check (description is null or nullif(btrim(description),'') is not null),
 previous_status text not null,
 resulting_status text not null,
 status_version bigint not null check (status_version >= 0),
 status_change_id uuid references public.equipment_status_changes(id),
 defect_report_id uuid unique references public.equipment_defect_reports(id),
 inspected_by uuid not null references public.profiles(id),
 inspected_by_name text not null,
 inspected_at timestamptz not null default clock_timestamp(),
 unique(allocation_id,version),
 check ((finding='good' and defect_report_id is null) or
        (finding<>'good' and defect_report_id is not null and description is not null)),
 check (finding<>'missing' or resulting_status='unavailable')
);
alter table public.equipment_return_inspections enable row level security;
revoke all on public.equipment_return_inspections from public,anon,authenticated;
grant select on public.equipment_return_inspections to authenticated;
drop policy if exists return_inspections_staff_read on public.equipment_return_inspections;
create policy return_inspections_staff_read on public.equipment_return_inspections for select to authenticated
 using (public.current_user_role()='tech_support');

-- A browser report write must not bypass the atomic inspection/status operation.
-- Existing reports remain readable under their original Technical Support policy.
revoke insert,update,delete on public.equipment_defect_reports from public,anon,authenticated;

create or replace function public.equipment_return_version(p_allocation uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(to_jsonb(a),i.id,i.type_id,i.operational_status,i.status_version)::text)
 from public.equipment_allocations a join public.equipment_items i on i.id=a.item_id
 where a.id=p_allocation;
$$;
revoke all on function public.equipment_return_version(uuid) from public,anon,authenticated;

create or replace function public.get_equipment_return_inspections()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; today_sgt date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'tech_support' then
  raise exception 'Only Technical Support Staff can inspect equipment returns' using errcode='42501';
 end if;
 with rows as materialized (
  select a.id,a.blocked_from,a.blocked_to,a.status,last_inspection.finding,
   jsonb_build_object('allocationId',a.id,'eventId',e.id,'eventReference',e.reference,
    'eventName',e.name,'itemId',i.id,'assetTag',i.asset_tag,'typeName',t.name,
    'collectionDate',a.blocked_from,'returnDate',a.blocked_to,'allocationStatus',a.status,
    'operationalStatus',i.operational_status,'statusVersion',i.status_version,
    'version',public.equipment_return_version(a.id),'lastFinding',last_inspection.finding,
    'lastInspectedAt',last_inspection.inspected_at) as detail
  from public.equipment_allocations a
  join public.equipment_booking_lines l on l.id=a.line_id
  join public.equipment_bookings b on b.id=l.booking_id
  join public.events e on e.id=b.event_id
  join public.equipment_items i on i.id=a.item_id
  join public.equipment_types t on t.id=a.type_id
  left join lateral (select h.finding,h.inspected_at from public.equipment_return_inspections h
   where h.allocation_id=a.id order by h.version desc limit 1) last_inspection on true
 )
 select jsonb_build_object(
  'out',coalesce((select jsonb_agg(r.detail order by r.blocked_to,r.id) from rows r
   where r.status in ('reserved','checked_out','returned')
    and r.blocked_from<=today_sgt and r.blocked_to>=today_sgt and r.finding is null),'[]'::jsonb),
  'pendingChecks',coalesce((select jsonb_agg(r.detail order by r.blocked_to,r.id) from rows r
   where r.status in ('reserved','checked_out','returned') and r.blocked_to<today_sgt
    and (r.finding is null or r.finding='missing')),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(r.detail||jsonb_build_object(
    'inspectionId',h.id,'inspectionVersion',h.version,'finding',h.finding,'description',h.description,
    'previousStatus',h.previous_status,'resultingStatus',h.resulting_status,
    'inspectedStatusVersion',h.status_version,'statusChangeId',h.status_change_id,
    'defectReportId',h.defect_report_id,'inspectedBy',h.inspected_by,
    'inspectedByName',h.inspected_by_name,'inspectedAt',h.inspected_at)
    order by h.inspected_at desc,h.id)
   from public.equipment_return_inspections h join rows r on r.id=h.allocation_id),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.get_equipment_return_inspections() from public,anon,authenticated;
grant execute on function public.get_equipment_return_inspections() to authenticated;

create or replace function public.inspect_equipment_return(
 p_allocation uuid,p_version text,p_finding text,p_description text default null,p_status text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare allocation public.equipment_allocations; item public.equipment_items;
 type_id uuid; target text; note text:=nullif(btrim(p_description),''); last_finding text;
 report_id uuid; change_id uuid; inspection_id uuid; receipt jsonb;
 today_sgt date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'tech_support' then
  raise exception 'Only Technical Support Staff can inspect equipment returns' using errcode='42501';
 end if;
 if p_finding is null or p_finding not in ('good','defect','damage','missing','other')
  or (p_finding<>'good' and note is null)
  or (p_status is not null and p_status not in ('operational','needs_repair','under_repair','unavailable'))
  or (p_finding not in ('good','missing') and p_status is null) then
  raise exception 'Choose a finding, describe issues and select a supported resulting status' using errcode='22023';
 end if;
 select i.type_id into type_id from public.equipment_allocations a
 join public.equipment_items i on i.id=a.item_id where a.id=p_allocation;
 if not found then raise exception 'Equipment allocation not found' using errcode='22023'; end if;
 -- Same type-first serialisation as US14 and US27; no event-status gate for past returns.
 perform public.lock_equipment_type(type_id);
 select i.* into item from public.equipment_items i join public.equipment_allocations a
  on a.item_id=i.id where a.id=p_allocation for update of i;
 select * into allocation from public.equipment_allocations where id=p_allocation for update;
 if not found or item.type_id is distinct from type_id
  or p_version is null or p_version is distinct from public.equipment_return_version(p_allocation) then
  raise exception 'Equipment or allocation changed; reload before inspecting' using errcode='40001';
 end if;
 if allocation.status not in ('reserved','checked_out','returned') or allocation.blocked_to>=today_sgt then
  raise exception 'Only allocations past their return date can be inspected' using errcode='22023';
 end if;
 select h.finding into last_finding from public.equipment_return_inspections h
  where h.allocation_id=allocation.id order by h.version desc limit 1;
 if last_finding is not null and last_finding<>'missing' then
  raise exception 'This allocation has already been inspected' using errcode='22023';
 end if;
 target:=coalesce(p_status,case when p_finding='missing' then 'unavailable' else item.operational_status end);
 if p_finding='missing' and target<>'unavailable' then
  raise exception 'Missing equipment must remain Unavailable' using errcode='22023';
 end if;
 -- No-issue inspection keeps the status, including legacy values, unless staff explicitly
 -- select a change and supply its reason. A finding remains useful even when status is unchanged.
 if target is distinct from item.operational_status then
  if note is null then raise exception 'A status change requires a reason' using errcode='22023'; end if;
  receipt:=public.set_equipment_status(item.id,target,note,item.status_version);
  select h.id into change_id from public.equipment_status_changes h
   where h.item_id=item.id and h.version=(receipt->>'version')::bigint;
 else
  receipt:=jsonb_build_object('version',item.status_version,'changed',false,'reviewCount',0);
 end if;
 if p_finding<>'good' then
  insert into public.equipment_defect_reports(item_id,allocation_id,reported_by,kind,description,resulting_status)
  values(item.id,allocation.id,auth.uid(),p_finding,note,target) returning id into report_id;
 end if;
 insert into public.equipment_return_inspections(allocation_id,version,finding,description,
  previous_status,resulting_status,status_version,status_change_id,defect_report_id,inspected_by,inspected_by_name)
 values(allocation.id,allocation.inspection_version+1,p_finding,note,item.operational_status,target,
  (receipt->>'version')::bigint,change_id,report_id,auth.uid(),
  (select full_name from public.profiles where id=auth.uid())) returning id into inspection_id;
 update public.equipment_allocations set inspection_version=inspection_version+1 where id=allocation.id;
 -- Display states are date/inspection projections. Do not invent checkout/return timestamps,
 -- move the unit, release allocations or shorten the agreed reservation window.
 return jsonb_build_object('inspectionId',inspection_id,'allocationId',allocation.id,
  'inspectionVersion',allocation.inspection_version+1,'finding',p_finding,
  'resolved',p_finding<>'missing','status',target,'statusVersion',(receipt->>'version')::bigint,
  'statusChanged',(receipt->>'changed')::boolean,'reviewCount',(receipt->>'reviewCount')::integer);
end $$;
revoke all on function public.inspect_equipment_return(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.inspect_equipment_return(uuid,text,text,text,text) to authenticated;
commit;
