-- US27 AC1–4: read-only catalogue over the existing types and individual units.
-- Coordinators receive a bounded projection, not access to allocations or staff records.
begin;

create or replace function public.get_equipment_catalogue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or public.current_user_role() not in ('tech_support','coordinator')
    or public.current_user_role() is null then
  raise exception 'Only Technical Support Staff and Event Coordinators can view the equipment catalogue'
   using errcode='42501';
 end if;
 return jsonb_build_object(
  'types', (select coalesce(jsonb_agg(to_jsonb(t) order by t.name,t.id),'[]'::jsonb) from (
   select et.id,et.name,et.category,et.notes as description,count(i.id) as "totalUnits",
    count(i.id) filter(where i.operational_status='operational') as "usableUnits"
   from public.equipment_types et left join public.equipment_items i on i.type_id=et.id
   group by et.id
  ) t),
  'units', (select coalesce(jsonb_agg(to_jsonb(u) order by u."assetTag",u.id),'[]'::jsonb) from (
   select i.id,i.type_id as "typeId",i.asset_tag as "assetTag",
    i.current_venue_id as "locationId",v.name as "locationName",v.location as "locationDescription",
    i.operational_status as status
   from public.equipment_items i join public.venues v on v.id=i.current_venue_id
  ) u)
 );
end $$;
revoke all on function public.get_equipment_catalogue() from public,anon,authenticated;
grant execute on function public.get_equipment_catalogue() to authenticated;
commit;
