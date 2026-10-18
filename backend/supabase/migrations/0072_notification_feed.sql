-- US32 View in-app notifications (SCRUM-229), slice 1: the feed.
-- AC-032.1 a user sees their notifications, newest first, each saying what happened, which
-- event it concerns and when. AC-032.5 a user only ever sees their own.
-- Apply after 0071. Safe to replay.
--
-- Notifications live in each feature's own table, and about half of them only as emails in
-- notification_outbox (US4 decisions, US15/US23 registrations, US16 waiting-list offers, US12
-- venue block alerts, US14 reservations). This migration changes none of them. It reads them
-- into one list, so every notification is also visible in the app.
begin;

-- ---------------------------------------------------------------------------
-- AC-032.1, AC-032.5: email-only notifications, addressed to the signed-in user
-- ---------------------------------------------------------------------------
-- The outbox is not readable from the app (0009), so this reads it on the user's behalf:
-- only rows sent to their own account's email address, compared without regard to case.
-- An email that a feature also recorded in-app (its email_outbox_id) is left out, because
-- the in-app record is already in the feed and already respects the user's in-app setting.
create or replace function public.my_email_notifications()
returns table (id uuid, event_id uuid, event_name text, event_reference text,
               subject text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.event_id, e.name, e.reference, o.subject, o.body, o.created_at
  from public.notification_outbox o
  join auth.users u on u.id = auth.uid() and lower(o.recipient_email) = lower(u.email)
  left join public.events e on e.id = o.event_id
  where not exists (select 1 from public.change_request_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.coordinator_assignment_notifications n where n.email_outbox_id = o.id)
    and not exists (select 1 from public.equipment_requirement_notifications n where n.email_outbox_id = o.id);
$$;
revoke all on function public.my_email_notifications() from public, anon;
grant execute on function public.my_email_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- AC-032.1, AC-032.5: the feed
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: every in-app table is read with the user's own permissions, so each
-- feature's existing read rule (RLS) decides what appears, including its in-app on/off
-- settings, and the feed can never show more than the feature itself would. Event names come
-- from events under the same rules; where a role cannot read an event (Venue Staff), the
-- notice names the venue instead.
--
-- Each row is identified by (source, id), which slice 2's read state will use.
create or replace function public.get_my_notifications(p_limit integer default 100)
returns table (source text, id uuid, event_id uuid, event_name text, event_reference text,
               title text, detail text, created_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your notifications' using errcode = '42501';
  end if;

  return query
  select f.source, f.id, f.event_id, f.event_name, f.event_reference, f.title, f.detail, f.created_at
  from (
    -- US41 / US20 / US46: an arrangement needs another look.
    select 'arrangement_review'::text as source, n.id, n.event_id, e.name as event_name, e.reference as event_reference,
           'An arrangement needs review'::text as title, n.detail, n.created_at
    from public.arrangement_review_notifications n
    left join public.events e on e.id = n.event_id

    union all
    -- US7: an organiser's change request is ready for the Coordinator.
    select 'change_request', n.id, n.event_id, e.name, e.reference,
           'A change request is ready for review', 'The organiser has asked to change this event.', n.created_at
    from public.change_request_notifications n
    left join public.events e on e.id = n.event_id

    union all
    -- US17: assigned or reassigned.
    select 'coordinator_assignment', n.id, n.event_id, e.name, e.reference, n.subject, n.body, n.created_at
    from public.coordinator_assignment_notifications n
    left join public.events e on e.id = n.event_id

    union all
    -- US13 / US14: equipment requirements for Technical Support, reservation outcomes for Coordinators.
    select 'equipment', n.id, n.event_id, e.name, e.reference,
           case n.action
             when 'added' then 'Equipment requirement added'
             when 'changed' then 'Equipment requirement changed'
             when 'removed' then 'Equipment requirement removed'
             when 'reserved' then 'Equipment reserved'
             when 'partially_reserved' then 'Equipment partly reserved'
             else 'Equipment unavailable'
           end,
           concat_ws('. ',
             format('%s × %s', n.type_name, n.quantity),
             case when n.action = 'partially_reserved' then format('%s reserved', n.quantity_reserved) end,
             case when n.alternative_type_name is not null then format('Alternative offered: %s', n.alternative_type_name) end,
             n.alternative_note),
           n.created_at
    from public.equipment_requirement_notifications n
    left join public.events e on e.id = n.event_id

    union all
    -- US10: Venue Staff decided on a booking request.
    select 'venue_decision', n.id, n.event_id, e.name, coalesce(e.reference, n.event_reference),
           case n.decision when 'confirmed' then 'Venue booking confirmed' else 'Venue booking rejected' end,
           concat_ws('. ', n.venue_name, n.reason, case when n.alternative is not null then format('Suggested instead: %s', n.alternative) end),
           n.created_at
    from public.venue_booking_decision_notifications n
    left join public.events e on e.id = n.event_id

    union all
    -- US9: a new booking request for Venue Staff.
    select 'venue_request', n.id, b.event_id, e.name, e.reference,
           'New venue booking request', v.name, n.created_at
    from public.venue_booking_notifications n
    left join public.venue_bookings b on b.id = n.venue_booking_id
    left join public.venues v on v.id = n.venue_id
    left join public.events e on e.id = b.event_id

    union all
    -- Everything else that was only ever emailed.
    select 'email', m.id, m.event_id, m.event_name, m.event_reference, m.subject, m.body, m.created_at
    from public.my_email_notifications() m
  ) f
  order by f.created_at desc, f.source, f.id
  limit greatest(coalesce(p_limit, 100), 1);
end $$;
revoke all on function public.get_my_notifications(integer) from public, anon;
grant execute on function public.get_my_notifications(integer) to authenticated;

commit;
