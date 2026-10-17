-- 0062_waitlist_expiry_job.sql — US16 SCRUM-153: a scheduled job that expires waiting-list offers
-- after their 3 days and offers the place to the next person.
--
-- 0058 to 0060 expire an offer whenever someone touches the event, which leaves a lapsed offer in
-- place on a quiet event until somebody does. This runs the same work on a timer, so it happens at
-- about the minute the offer lapses. It adds no new rule: process_waitlist (0058, ordered by 0060)
-- already expires overdue offers, makes the next offer and queues the emails; this only calls it.
-- Safe to re-run.
begin;

-- Walks every event that has a lapsed offer, in id order so two overlapping runs take the per-event
-- locks in the same order and cannot deadlock. Returns how many events it processed.
create or replace function public.process_overdue_waitlists()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev uuid;
  processed integer := 0;
begin
  for ev in
    select distinct w.event_id
    from public.event_waitlist_entries w
    where w.status = 'offered' and w.offer_expires_at <= now()
    order by w.event_id
  loop
    perform public.process_waitlist(ev);
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

-- The timer calls it as the database owner. Browsers have no reason to, so nobody else may.
revoke execute on function public.process_overdue_waitlists() from public, anon, authenticated;

-- Schedule it once a minute when the pg_cron extension is installed. The disposable test database
-- and a fresh project do not have it, so this is skipped there rather than failing the migration;
-- the function above is the part with behaviour, and the tests call it directly. Scheduling under
-- the same name again replaces the job, so re-running does not create a second one.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-waitlist-offers', '* * * * *', 'select public.process_overdue_waitlists();');
  end if;
end $$;

commit;
