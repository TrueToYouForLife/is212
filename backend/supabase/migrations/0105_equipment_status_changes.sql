-- US27 AC5–8: checked unit status changes, immutable audit, and affected reservations.
-- Reuses US14's type lock, US41 reviews and US33 channel helpers. No allocation movement.
begin;

alter table public.equipment_items add column if not exists status_version bigint not null default 0;
alter table public.equipment_items drop constraint if exists equipment_items_operational_status_check;
alter table public.equipment_items add constraint equipment_items_operational_status_check
 check(operational_status in ('operational','needs_repair','under_repair','retired','missing','unavailable'));

create table if not exists public.equipment_status_changes (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.equipment_items(id),
 previous_status text not null,
 new_status text not null check(new_status in ('operational','needs_repair','under_repair','unavailable')),
 note text not null check(nullif(btrim(note),'') is not null),
 changed_by uuid not null references public.profiles(id),
 changed_by_name text not null,
 changed_at timestamptz not null default clock_timestamp(),
 version bigint not null check(version>0),
 unique(item_id,version),
 check(previous_status<>new_status)
);
alter table public.equipment_status_changes enable row level security;
revoke all on public.equipment_status_changes from public,anon,authenticated;
grant select on public.equipment_status_changes to authenticated;
drop policy if exists equipment_status_history_staff on public.equipment_status_changes;
create policy equipment_status_history_staff on public.equipment_status_changes for select to authenticated
 using(public.current_user_role()='tech_support');

-- Close the old table-level UPDATE grant, retaining unrelated Technical Support edits.
-- The unit RLS policy still restricts these columns to Technical Support.
revoke update on public.equipment_items from public,anon,authenticated;
grant update(type_id,asset_tag,home_venue_id,current_venue_id,condition) on public.equipment_items to authenticated;
create or replace function public.guard_equipment_status_write()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and
  (new.operational_status is distinct from old.operational_status or new.status_version is distinct from old.status_version) then
  raise exception 'Use the checked equipment status operation' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.guard_equipment_status_write() from public,anon,authenticated;
drop trigger if exists equipment_status_write_guard on public.equipment_items;
create trigger equipment_status_write_guard before update on public.equipment_items
 for each row execute function public.guard_equipment_status_write();

alter table public.arrangement_review_flags add column if not exists equipment_status_change_id uuid
 references public.equipment_status_changes(id);
-- Preserve all existing reason/source alternatives, including later additive extensions.
do $$ declare expression text; begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.arrangement_review_flags'::regclass and conname='arrangement_review_source';
 if expression not like '%equipment_status_change_id%' then
  alter table public.arrangement_review_flags drop constraint arrangement_review_source;
  execute format('alter table public.arrangement_review_flags add constraint arrangement_review_source check (%s)',
   replace(expression,'num_nonnulls(', 'num_nonnulls(equipment_status_change_id, '));
 end if;
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.arrangement_review_flags'::regclass and conname='arrangement_review_flags_reason_code_check';
 if expression not like '%equipment_non_operational%' then
  alter table public.arrangement_review_flags drop constraint arrangement_review_flags_reason_code_check;
  execute format('alter table public.arrangement_review_flags add constraint arrangement_review_flags_reason_code_check check ((%s) or reason_code=%L)',
   expression,'equipment_non_operational');
 end if;
end $$;
create unique index if not exists equipment_status_review_reason on public.arrangement_review_flags
 (equipment_status_change_id,equipment_booking_id) where equipment_status_change_id is not null;
alter table public.arrangement_review_flags drop constraint if exists equipment_status_review_source_kind;
alter table public.arrangement_review_flags add constraint equipment_status_review_source_kind
 check(equipment_status_change_id is null or (equipment_booking_id is not null and reason_code='equipment_non_operational'));

-- This producer can send both channels. Existing review producers are not replaced.
update public.notification_types set delivered_by_email=true where code='arrangement_review';

create or replace function public.review_equipment_status_change(p_change uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.equipment_status_changes; affected record; flag uuid; detail text; total integer:=0;
begin
 select * into strict c from public.equipment_status_changes where id=p_change;
 if c.new_status='operational' then return 0; end if;
 for affected in
  select b.id as booking_id,e.id as event_id,e.coordinator_id,e.reference,i.asset_tag,t.name as type_name
  from public.equipment_bookings b join public.events e on e.id=b.event_id
  join public.equipment_items i on i.id=c.item_id join public.equipment_types t on t.id=i.type_id
  where e.status in ('approved','planning','confirmed') and e.proposed_start>now()
   and b.status not in ('rejected','cancelled','completed')
   and exists(select 1 from public.equipment_booking_lines l join public.equipment_allocations a on a.line_id=l.id
    where l.booking_id=b.id and a.item_id=c.item_id and a.status in ('reserved','checked_out'))
  order by e.id,b.id for share of e,b
 loop
  detail:=format('%s (%s) is now %s. Reason: %s. The reservation is retained; review the equipment arrangement.',
   affected.type_name,affected.asset_tag,
   case c.new_status when 'needs_repair' then 'Damaged' when 'under_repair' then 'Under Maintenance' else 'Unavailable' end,c.note);
  insert into public.arrangement_review_flags(equipment_status_change_id,event_id,equipment_booking_id,reason_code,detail)
  values(c.id,affected.event_id,affected.booking_id,'equipment_non_operational',detail)
  on conflict do nothing returning id into flag;
  if flag is null then continue; end if;
  total:=total+1;
  if exists(select 1 from public.profiles where id=affected.coordinator_id and role='coordinator') then
   if (select channels.in_app from public.notification_channels(affected.coordinator_id,'arrangement_review') channels) then
    insert into public.arrangement_review_notifications(flag_id,event_id,recipient_id,detail)
    values(flag,affected.event_id,affected.coordinator_id,detail);
   end if;
   perform public.queue_notification_email(affected.coordinator_id,'arrangement_review',affected.event_id,
    'Equipment reservation needs review: '||coalesce(affected.reference,'event'),detail);
  end if;
 end loop;
 return total;
end $$;
revoke all on function public.review_equipment_status_change(uuid) from public,anon,authenticated;

create or replace function public.get_equipment_status(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item public.equipment_items;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'tech_support' then
  raise exception 'Only Technical Support Staff can manage equipment status' using errcode='42501';
 end if;
 select * into item from public.equipment_items where id=p_item;
 if not found then raise exception 'Equipment unit not found' using errcode='22023'; end if;
 return jsonb_build_object('id',item.id,'assetTag',item.asset_tag,'status',item.operational_status,'version',item.status_version,
  'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.version desc),'[]'::jsonb)
   from (select id,previous_status as "previousStatus",new_status as "newStatus",note,
    changed_by as "changedBy",changed_by_name as "changedByName",changed_at as "changedAt",version
    from public.equipment_status_changes where item_id=p_item) h));
end $$;
revoke all on function public.get_equipment_status(uuid) from public,anon,authenticated;
grant execute on function public.get_equipment_status(uuid) to authenticated;

create or replace function public.set_equipment_status(p_item uuid,p_status text,p_note text,p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.equipment_items; type_id uuid; change_id uuid; count_reviews integer;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'tech_support' then
  raise exception 'Only Technical Support Staff can change equipment status' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('operational','needs_repair','under_repair','unavailable')
  or nullif(btrim(p_note),'') is null or p_version is null or p_version<0 then
  raise exception 'Choose a supported status, provide a note and reload the current unit version' using errcode='22023';
 end if;
 select i.type_id into type_id from public.equipment_items i where i.id=p_item;
 if not found then raise exception 'Equipment unit not found' using errcode='22023'; end if;
 -- Same lock order as US14: type first, then the row. Re-read after waiting.
 perform public.lock_equipment_type(type_id);
 select * into item from public.equipment_items where id=p_item for update;
 if not found or item.type_id is distinct from type_id or item.status_version is distinct from p_version then
  raise exception 'Equipment changed; reload before saving' using errcode='40001';
 end if;
 if item.operational_status=p_status then
  return jsonb_build_object('id',item.id,'version',item.status_version,'changed',false,'reviewCount',0);
 end if;
 update public.equipment_items set operational_status=p_status,status_version=status_version+1 where id=item.id;
 insert into public.equipment_status_changes(item_id,previous_status,new_status,note,changed_by,changed_by_name,version)
 values(item.id,item.operational_status,p_status,btrim(p_note),auth.uid(),
  (select full_name from public.profiles where id=auth.uid()),item.status_version+1) returning id into change_id;
 count_reviews:=public.review_equipment_status_change(change_id);
 return jsonb_build_object('id',item.id,'version',item.status_version+1,'changed',true,'reviewCount',count_reviews);
end $$;
revoke all on function public.set_equipment_status(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.set_equipment_status(uuid,text,text,bigint) to authenticated;
commit;
