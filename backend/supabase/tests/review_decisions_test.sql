-- review_decisions_test.sql — database checks for US4 (SCRUM-9) AC-004.4 and AC-004.5.
--
-- DISPOSABLE DATABASE ONLY. Creates synthetic auth.users rows. Everything runs inside one
-- transaction that is rolled back, but never point this at the shared Supabase project.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/review_decisions_test.sql
--
-- A failing check raises an exception naming its case ID; a clean run prints PASS for
-- every case. Users are impersonated the way PostgREST does it: role `authenticated`
-- plus the request.jwt.claim.sub setting that auth.uid() reads.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner, with no JWT: an administrator)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'organiser@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', null),                      -- no email address
  ('00000000-0000-4000-8000-0000000000c1', 'coordinator@example.test');

-- 0005's signup trigger creates organiser profiles; create them here if it is absent.
insert into public.profiles (id, full_name, role, client_org_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'Olivia Organiser', 'organiser', '0c0a0000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-0000000000a2', 'Phone Organiser', 'organiser', '0c0a0000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-0000000000c1', 'Casey Coordinator', 'coordinator', null)
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role,
  client_org_id = excluded.client_org_id;

insert into public.events (id, organiser_id, name, purpose, proposed_start, proposed_end,
                           expected_attendance, status) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1',
   'Client dinner', 'Thank clients', '2099-06-01 18:00+00', '2099-06-01 22:00+00', 50, 'submitted'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a1',
   'Town hall', 'Quarterly update', '2099-07-01 09:00+00', '2099-07-01 11:00+00', 80, 'submitted'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000a2',
   'Workshop', 'Training', '2099-08-01 09:00+00', '2099-08-01 12:00+00', 20, 'submitted'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000a1',
   'Gala', 'Awards', '2099-09-01 18:00+00', '2099-09-01 23:00+00', 200, 'submitted');

-- An administrator moving requests into review: no JWT, so no decision is recorded.
update public.events set status = 'under_review';

-- ---------------------------------------------------------------------------
-- Coordinator decisions
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;

update public.events set status = 'submitted', review_note = 'Please add a programme.'
  where id = '00000000-0000-4000-8000-0000000000e1';          -- return
update public.events set status = 'under_review'
  where id = '00000000-0000-4000-8000-0000000000e1';          -- start review again
update public.events set status = 'approved', review_note = null
  where id = '00000000-0000-4000-8000-0000000000e1';          -- approve, no reason
update public.events set status = 'rejected', review_note = 'The hall is closed that week.'
  where id = '00000000-0000-4000-8000-0000000000e2';          -- reject
update public.events set status = 'rejected', review_note = 'Duplicate request.'
  where id = '00000000-0000-4000-8000-0000000000e3';          -- reject, organiser has no email

do $$
declare
  approved_row public.event_review_decisions%rowtype;
begin
  select * into approved_row from public.event_review_decisions
   where event_id = '00000000-0000-4000-8000-0000000000e1' and decision = 'approved';
  if approved_row.id is null
     or approved_row.decided_by <> '00000000-0000-4000-8000-0000000000c1'
     or approved_row.decided_by_name <> 'Casey Coordinator'
     or approved_row.from_status <> 'under_review'
     or approved_row.reason is not null then
    raise exception 'AC-004.5.7 failed: approval not recorded with the deciding coordinator';
  end if;
  raise notice 'PASS AC-004.5.7: approval recorded with who decided, from which status, and when';

  if (select count(*) from public.event_review_decisions
       where event_id = '00000000-0000-4000-8000-0000000000e1') <> 2
     or not exists (select 1 from public.event_review_decisions
       where event_id = '00000000-0000-4000-8000-0000000000e1'
         and decision = 'returned' and reason = 'Please add a programme.') then
    raise exception 'AC-004.5.8 failed: the earlier return was not retained';
  end if;
  raise notice 'PASS AC-004.5.8: an earlier return and its reason survive a later approval';

  -- Two decisions for e1 (return, approve); the start-review in between added nothing.
  if exists (select 1 from public.event_review_decisions where from_status = 'submitted') then
    raise exception 'AC-004.5.9 failed: starting a review was logged as a decision';
  end if;
  raise notice 'PASS AC-004.5.9: starting a review and administrator changes are not decisions';
end $$;

-- ---------------------------------------------------------------------------
-- The record cannot be forged or altered from the browser
-- ---------------------------------------------------------------------------
do $$
declare
  changed integer;
begin
  -- Refusal may come from the revoked privilege or, if a blanket grant is ever re-run,
  -- from RLS having no write policy (zero rows touched). Either way nothing may change.
  begin
    insert into public.event_review_decisions (event_id, from_status, decision, reason, decided_by, decided_by_name)
    values ('00000000-0000-4000-8000-0000000000e4', 'under_review', 'approved', null,
            '00000000-0000-4000-8000-0000000000a1', 'Forged');
    raise exception 'AC-004.5.10 failed: a coordinator inserted a decision directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.event_review_decisions set reason = 'Edited later';
    get diagnostics changed = row_count;
    if changed > 0 then
      raise exception 'AC-004.5.10 failed: a coordinator edited a decision';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.event_review_decisions;
    get diagnostics changed = row_count;
    if changed > 0 then
      raise exception 'AC-004.5.10 failed: a coordinator deleted a decision';
    end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS AC-004.5.10: decisions cannot be inserted, edited or deleted by a signed-in user';

  begin
    if (select count(*) from public.notification_outbox) > 0 then
      raise exception 'AC-004.4.4 failed: a coordinator can read the email outbox';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- The organiser's view
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.event_review_decisions) <> 0 then
    raise exception 'AC-004.5.11 failed: an organiser can read the internal decision log';
  end if;
  raise notice 'PASS AC-004.5.11: the decision log, including reviewer identity, is staff-only';

  begin
    if (select count(*) from public.notification_outbox) > 0 then
      raise exception 'AC-004.4.4 failed: an organiser can read the email outbox';
    end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS AC-004.4.4: no signed-in user can read queued emails or addresses';

  begin
    update public.events set status = 'approved'
     where id = '00000000-0000-4000-8000-0000000000e4';
    raise exception 'AC-004.5.12 failed: an organiser approved their own request';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Checks that need the owner's view of the outbox
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  approval_mail public.notification_outbox%rowtype;
  rejection_mail public.notification_outbox%rowtype;
begin
  if exists (select 1 from public.event_review_decisions
              where event_id = '00000000-0000-4000-8000-0000000000e4') then
    raise exception 'AC-004.5.12 failed: a refused transition left a decision record';
  end if;
  raise notice 'PASS AC-004.5.12: a refused transition leaves no decision record';

  select * into approval_mail from public.notification_outbox
   where event_id = '00000000-0000-4000-8000-0000000000e1';
  if approval_mail.id is null
     or approval_mail.recipient_email <> 'organiser@example.test'
     or approval_mail.status <> 'pending'
     or approval_mail.subject not like '%approved'
     or approval_mail.body not like '%No reason was given.%' then
    raise exception 'AC-004.4.1 failed: approval email not queued for the organiser';
  end if;
  if (select count(*) from public.notification_outbox
       where event_id = '00000000-0000-4000-8000-0000000000e1') <> 1 then
    raise exception 'AC-004.4.3 failed: a return queued an email';
  end if;
  raise notice 'PASS AC-004.4.1: approval queues one email to the organiser with the outcome';

  select * into rejection_mail from public.notification_outbox
   where event_id = '00000000-0000-4000-8000-0000000000e2';
  if rejection_mail.id is null
     or rejection_mail.subject not like '%rejected'
     or rejection_mail.body not like '%The hall is closed that week.%'
     or rejection_mail.decision_id is null then
    raise exception 'AC-004.4.2 failed: rejection email missing or without its reason';
  end if;
  raise notice 'PASS AC-004.4.2: rejection email carries the coordinator''s reason';
  raise notice 'PASS AC-004.4.3: a return is logged but does not queue an email';

  if not exists (select 1 from public.event_review_decisions
                  where event_id = '00000000-0000-4000-8000-0000000000e3')
     or exists (select 1 from public.notification_outbox
                 where event_id = '00000000-0000-4000-8000-0000000000e3') then
    raise exception 'AC-004.4.5 failed: missing email broke the decision or queued a message';
  end if;
  raise notice 'PASS AC-004.4.5: an organiser without an email is still decided on, with nothing queued';
end $$;

rollback;
