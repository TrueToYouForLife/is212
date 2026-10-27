-- US33 Choose notification channels by type (SCRUM-230), slice 2c: email for the four
-- in-app-only types. AC-033.3: every type can now reach people both in the app and by email.
-- Apply after 0084, 0085, 0086, 0087 and 0088. Safe to replay.
--
-- New behaviour, agreed with each owner: these notices now also send an email, unless the
-- person turns it off in Notification settings. Each function below is its 0084 to 0088 version
-- with only the email added. Emails to Venue Staff and Technical Support stay generic because
-- those roles cannot read events.
-- Owners: Siew Yuanlong (US13), Nicole (US9), Justas (US10, US20; US41 is Jaydon's), Jeremiah (US46).
begin;

update public.notification_types set delivered_by_email = true
  where code in ('equipment_requirement_change', 'venue_booking_request', 'venue_booking_decision', 'arrangement_review');

-- US13 equipment requirement changes (from 0084)
create or replace function public.notify_equipment_requirement_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed public.event_equipment_requirements;
  v_action text;
begin
  if tg_op = 'INSERT' then
    changed := new; v_action := 'added';
  elsif tg_op = 'DELETE' then
    -- A cascade from a deleted event leaves nothing to notify about.
    if not exists (select 1 from public.events where id = old.event_id) then return null; end if;
    changed := old; v_action := 'removed';
  else
    if (new.type_id, new.quantity, new.technical_notes, new.essential)
       is not distinct from (old.type_id, old.quantity, old.technical_notes, old.essential) then
      return null;
    end if;
    changed := new; v_action := 'changed';
  end if;

  insert into public.equipment_requirement_notifications
    (requirement_id, event_id, recipient_id, action, type_name, quantity)
  select changed.id, changed.event_id, p.id, v_action, t.name, changed.quantity
  from public.profiles p
  join public.equipment_types t on t.id = changed.type_id
  where p.role = 'tech_support'
    -- US33: only Technical Support staff who have this in-app notice on.
    and (select c.in_app from public.notification_channels(p.id, 'equipment_requirement_change') c);

  -- US33 (0093): the email, for each Technical Support member who has it on. Generic, like
  -- US7's: Technical Support cannot read events, so it says what changed and where to look.
  perform public.queue_notification_email(p.id, 'equipment_requirement_change', changed.event_id,
    'Equipment request ' || v_action || ': ' || t.name,
    format('An equipment request for %s × %s was %s. Sign in to ConnectSphere and open Equipment to review it.',
      changed.quantity, t.name, v_action))
  from public.profiles p
  join public.equipment_types t on t.id = changed.type_id
  where p.role = 'tech_support';
  return null;
end $$;

-- US9 venue booking requests (from 0085)
create or replace function public.notify_venue_staff_of_booking_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only the held -> pending_approval transition is a new request to review.
  if new.status <> 'pending_approval' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending_approval' then return new; end if;

  insert into public.venue_booking_notifications (venue_booking_id, venue_id, recipient_id)
  select new.id, new.venue_id, p.id
    from public.profiles p
   where p.role = 'venue_staff'
     -- US33: only Venue Staff who have this in-app notice on.
     and (select c.in_app from public.notification_channels(p.id, 'venue_booking_request') c)
  on conflict (venue_booking_id, recipient_id) do nothing;

  -- US33 (0093): the email, for each Venue Staff member who has it on.
  perform public.queue_notification_email(p.id, 'venue_booking_request', new.event_id,
    'New venue booking request: ' || v.name,
    'A Coordinator has asked to book ' || v.name || '. Sign in to ConnectSphere and open Venue review to decide on it.')
  from public.profiles p
  join public.venues v on v.id = new.venue_id
  where p.role = 'venue_staff';

  return new;
end;
$$;

-- US10 venue booking decisions (from 0086)
create or replace function public.notify_venue_booking_decision()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; event_reference text; v_venue text;
begin
 -- Administrative repairs and historical final rows do not generate new decisions.
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then return new; end if;
 select coalesce(e.coordinator_id,new.requested_by),e.reference into recipient,event_reference
 from public.events e where e.id=new.event_id for share;
 if not exists(select 1 from public.profiles where id=recipient and role='coordinator') then return new; end if;
 -- US33: the in-app notice only if the Coordinator has it on.
 if (select c.in_app from public.notification_channels(recipient,'venue_booking_decision') c) then
 insert into public.venue_booking_decision_notifications
  (booking_id,event_id,recipient_id,venue_name,event_reference,decision,reason,alternative,reviewed_by,reviewed_at)
 select new.id,new.event_id,recipient,v.name,event_reference,new.status,new.review_note,
  new.review_alternative,new.reviewed_by,new.reviewed_at from public.venues v where v.id=new.venue_id
 on conflict (booking_id) do nothing;
 end if;
 -- US33 (0093): the email, if the Coordinator has it on.
 select v.name into v_venue from public.venues v where v.id=new.venue_id;
 perform public.queue_notification_email(recipient,'venue_booking_decision',new.event_id,
  'Venue booking ' || new.status || ': ' || coalesce(v_venue,'your venue'),
  concat_ws(E'\n\n',
   format('Venue Staff have %s your booking of %s for event %s.', new.status, coalesce(v_venue,'the venue'), coalesce(event_reference,'without a reference')),
   case when nullif(btrim(new.review_note),'') is not null then 'Reason: ' || btrim(new.review_note) end,
   case when nullif(btrim(new.review_alternative),'') is not null then 'Suggested instead: ' || btrim(new.review_alternative) end,
   'Sign in to ConnectSphere to see the details.'));
 return new;
end $$;

-- US20 / US41 arrangement reviews (from 0087)
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
 -- US33: the flag is always recorded; the in-app notice and (0093) the email each follow the
 -- Coordinator's choice.
 if recipient is not null then
  if (select c.in_app from public.notification_channels(recipient,'arrangement_review') c) then
   insert into public.arrangement_review_notifications(flag_id,event_id,recipient_id,detail)
   values(flag,p_event,recipient,p_detail);
  end if;
  perform public.queue_notification_email(recipient,'arrangement_review',p_event,
   'An arrangement needs review' || coalesce(' for ' || (select e.reference from public.events e where e.id=p_event), ''),
   p_detail || E'\n\nSign in to ConnectSphere and open the event to review it.');
 end if;
end $$;

-- US46 venue-change reviews (from 0088)
create or replace function public.record_venue_change_review(
  p_change uuid, p_event uuid, p_booking uuid, p_code text, p_detail text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_flag uuid;
  v_recipient uuid;
begin
  update public.arrangement_review_flags f
  set detail = p_detail, venue_change_id = p_change
  where f.venue_booking_id = p_booking and f.reason_code = p_code
    and f.venue_change_id is not null and f.status = 'open';
  if found then return; end if;

  insert into public.arrangement_review_flags (venue_change_id, event_id, venue_booking_id, reason_code, detail)
  values (p_change, p_event, p_booking, p_code, p_detail)
  on conflict do nothing
  returning id into v_flag;
  if v_flag is null then return; end if;

  select e.coordinator_id into v_recipient
  from public.events e join public.profiles p on p.id = e.coordinator_id and p.role = 'coordinator'
  where e.id = p_event;
  -- US33: the flag is always recorded; the in-app notice and (0093) the email each follow the
  -- Coordinator's choice.
  if v_recipient is not null then
    if (select c.in_app from public.notification_channels(v_recipient, 'arrangement_review') c) then
      insert into public.arrangement_review_notifications (flag_id, event_id, recipient_id, detail)
      values (v_flag, p_event, v_recipient, p_detail);
    end if;
    perform public.queue_notification_email(v_recipient, 'arrangement_review', p_event,
      'An arrangement needs review' || coalesce(' for ' || (select e.reference from public.events e where e.id = p_event), ''),
      p_detail || E'\n\nSign in to ConnectSphere and open the event to review it.');
  end if;
end $$;

commit;
