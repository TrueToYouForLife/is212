-- US49 Slice 3 (AC7-9): explicit cancellation, including rejected requirements.
-- Apply after 0107. No change to 0108's shared readiness helper or event statuses.
begin;
create table if not exists public.venue_booking_cancellations (
 booking_id uuid primary key references public.venue_bookings(id),
 event_id uuid not null references public.events(id),
 previous_status text not null check(previous_status in ('pending_approval','confirmed','rejected')),
 reason text not null check(reason ~ '[^[:space:]]'),
 cancelled_by uuid not null references public.profiles(id),
 actor_name text not null,
 cancelled_at timestamptz not null default clock_timestamp()
);
alter table public.venue_booking_cancellations enable row level security;
revoke all on public.venue_booking_cancellations from public,anon,authenticated;

insert into public.notification_types(code,label,description,roles,delivered_in_app,delivered_by_email,sort_order)
values('venue_booking_cancelled','Venue booking cancellations','When a Coordinator cancels a venue booking.',
 '{venue_staff}',true,true,125)
on conflict(code) do nothing;

-- Direct browser cancellation cannot bypass the reason, audit and atomic slot release.
-- Existing tentative-hold release and trusted event/replacement workflows remain valid.
create or replace function public.guard_individual_venue_cancellation()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and new.status in ('cancelled','held','expired')
    and old.status in ('pending_approval','confirmed','rejected') then
   raise exception 'Use the checked booking cancellation action' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists venue_booking_checked_cancellation on public.venue_bookings;
create trigger venue_booking_checked_cancellation before update of status on public.venue_bookings
for each row execute function public.guard_individual_venue_cancellation();

create or replace function public.get_venue_cancellation(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.venue_bookings; e public.events;
begin
 select * into b from public.venue_bookings where id=p_booking_id;
 select * into e from public.events where id=b.event_id;
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator'
    or e.coordinator_id is distinct from auth.uid() then
   raise exception 'Only the assigned Coordinator can cancel this booking' using errcode='42501';
 end if;
 return jsonb_build_object('status',b.status,'version',public.venue_booking_review_version(b.id),
   'audit',(select to_jsonb(c) from public.venue_booking_cancellations c where c.booking_id=b.id));
end $$;
revoke all on function public.get_venue_cancellation(uuid) from public,anon;
grant execute on function public.get_venue_cancellation(uuid) to authenticated;

create or replace function public.cancel_individual_venue_booking(p_booking_id uuid,p_reason text,p_expected_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.venue_bookings; e public.events; actor text; recipient record; v_name text;
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
   raise exception 'Only the assigned Coordinator can cancel this booking' using errcode='42501';
 end if;
 if p_reason is null or p_reason !~ '[^[:space:]]' then
   raise exception 'A cancellation reason is required' using errcode='22023';
 end if;
 select * into b from public.venue_bookings where id=p_booking_id;
 if not found then raise exception 'Booking unavailable' using errcode='P0002'; end if;
 -- Match hold/approval lock order. A concurrent decision must invalidate displayed consent.
 select name into v_name from public.venues where id=b.venue_id for update;
 select * into e from public.events where id=b.event_id for update;
 select * into b from public.venue_bookings where id=p_booking_id for update;
 if e.coordinator_id is distinct from auth.uid() then
   raise exception 'Only the assigned Coordinator can cancel this booking' using errcode='42501';
 end if;
 if p_expected_version is null or p_expected_version is distinct from public.venue_booking_review_version(b.id) then
   raise exception 'Booking changed; reload before cancelling' using errcode='40001';
 end if;
 if b.status not in ('pending_approval','confirmed','rejected') then
   raise exception 'This booking cannot be cancelled' using errcode='22023';
 end if;
 select coalesce(nullif(btrim(full_name),''),'Event Coordinator') into actor from public.profiles where id=auth.uid();
 insert into public.venue_booking_cancellations(booking_id,event_id,previous_status,reason,cancelled_by,actor_name)
 values(b.id,e.id,b.status,btrim(p_reason),auth.uid(),actor);
 -- Preserve original decision fields. Existing termination triggers retain their cleanup.
 update public.venue_bookings set status='cancelled' where id=b.id;
 delete from public.venue_slot_claims where booking_id=b.id;
 for recipient in select id from public.profiles where role='venue_staff' loop
   perform public.send_notification(recipient.id,'venue_booking_cancelled',e.id,
     format('Venue booking cancelled: %s',v_name),
     format('%s cancelled booking %s for %s (%s). Previous status: %s. Reason: %s. Other bookings and the event are unchanged.',
       actor,b.id,v_name,coalesce(e.reference,e.name),b.status,btrim(p_reason)));
 end loop;
 return b.id;
end $$;
revoke all on function public.cancel_individual_venue_booking(uuid,text,text) from public,anon;
grant execute on function public.cancel_individual_venue_booking(uuid,text,text) to authenticated;
commit;
