-- US33 Choose notification channels by type (SCRUM-230), slice 2d: the settings page says when a
-- type is switched off for everyone. AC-033.2 each person switches in-app and email per type; for
-- the three types with a system-wide switch (change requests, assignments, equipment results), an
-- administrator can turn a channel off for everyone, which overrides personal choices (0079). The
-- page shows that, so nobody wonders why their switch has no effect.
-- Apply after 0093. Safe to replay.
begin;

-- 0077's function with two more columns, so it is dropped and created again.
drop function if exists public.get_my_notification_preferences();
create function public.get_my_notification_preferences()
returns table (type_code text, label text, description text, in_app boolean, email boolean, customised boolean,
               in_app_off_for_everyone boolean, email_off_for_everyone boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := public.current_user_role();
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your notification settings' using errcode = '42501';
  end if;
  return query
  select t.code, t.label, t.description,
         coalesce(p.in_app, true), coalesce(p.email, true), p.user_id is not null,
         not s.in_app, not s.email
  from public.notification_types t
  cross join lateral public.notification_system_channels(t.code) s
  left join public.notification_preferences p on p.type_code = t.code and p.user_id = auth.uid()
  where v_role = any (t.roles)
  order by t.sort_order, t.code;
end $$;
revoke all on function public.get_my_notification_preferences() from public, anon;
grant execute on function public.get_my_notification_preferences() to authenticated;

commit;
