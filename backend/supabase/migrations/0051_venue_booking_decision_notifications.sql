-- US10 Slice 4 / AC14: recipient-scoped in-app decision delivery, no live email.
begin;
create table if not exists public.venue_booking_decision_notifications (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null unique references public.venue_bookings(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id),
 venue_name text not null,
 event_reference text,
 decision text not null check(decision in ('confirmed','rejected')),
 reason text,
 alternative text,
 reviewed_by uuid not null references public.profiles(id),
 reviewed_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists venue_decision_notifications_recipient_idx
 on public.venue_booking_decision_notifications(recipient_id,created_at desc);
alter table public.venue_booking_decision_notifications enable row level security;
revoke all on public.venue_booking_decision_notifications from public,anon,authenticated;
grant select on public.venue_booking_decision_notifications to authenticated;
drop policy if exists coordinator_read_own_venue_decisions on public.venue_booking_decision_notifications;
create policy coordinator_read_own_venue_decisions on public.venue_booking_decision_notifications
 for select to authenticated using (
  recipient_id=auth.uid() and public.current_user_role()='coordinator'
  and exists(select 1 from public.venue_bookings b join public.events e on e.id=b.event_id
   where b.id=booking_id and coalesce(e.coordinator_id,b.requested_by)=auth.uid())
 );

create or replace function public.notify_venue_booking_decision()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; event_reference text;
begin
 -- Administrative repairs and historical final rows do not generate new decisions.
 if auth.uid() is null or public.current_user_role() is distinct from 'venue_staff' then return new; end if;
 select coalesce(e.coordinator_id,new.requested_by),e.reference into recipient,event_reference
 from public.events e where e.id=new.event_id for share;
 if not exists(select 1 from public.profiles where id=recipient and role='coordinator') then return new; end if;
 insert into public.venue_booking_decision_notifications
  (booking_id,event_id,recipient_id,venue_name,event_reference,decision,reason,alternative,reviewed_by,reviewed_at)
 select new.id,new.event_id,recipient,v.name,event_reference,new.status,new.review_note,
  new.review_alternative,new.reviewed_by,new.reviewed_at from public.venues v where v.id=new.venue_id
 on conflict (booking_id) do nothing;
 return new;
end $$;
revoke all on function public.notify_venue_booking_decision() from public,anon,authenticated;
drop trigger if exists venue_bookings_notify_decision on public.venue_bookings;
create trigger venue_bookings_notify_decision after update of status on public.venue_bookings
 for each row when(old.status='pending_approval' and new.status in ('confirmed','rejected'))
 execute function public.notify_venue_booking_decision();
commit;
