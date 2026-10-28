-- US44 Approve / reject / request changes for safety review (SCRUM-249). Week 7 change 6.
-- AC-044.1 The Safety Officer assesses each factor (no concern or concern, with a note).
-- AC-044.2 One decision: Approve, Request Changes or Reject; a comment for Request Changes and Reject.
-- AC-044.3 Approve moves the event to In Preparation.
-- AC-044.4 Request Changes or Reject moves it to Safety Changes Requested, naming the arrangements to
--          revisit (venue, equipment or both); it cannot proceed until a new review approves it.
-- AC-044.5 The assigned Coordinator is notified of the decision and comments (US33 helper).
-- AC-044.6 Only Safety Officers decide; each decision records who made it and when.
-- Part of the safety review (US43), so refused while it is switched off (0108). Apply after 0108.
-- Safe to replay.
begin;

-- ---------------------------------------------------------------------------
-- The decisions and their assessments
-- ---------------------------------------------------------------------------
-- The factors, in the order the Safety Officer assesses them.
create or replace function public.safety_review_factors()
returns text[] language sql immutable set search_path = '' as $$
  select array['attendance', 'venue_capacity_layout', 'emergency_access', 'accessibility',
               'equipment_placement', 'crowd_movement', 'venue_restrictions'];
$$;

create table if not exists public.safety_review_decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  decided_by uuid not null references public.profiles (id),
  decided_at timestamptz not null default now(),
  decision text not null check (decision in ('approve', 'request_changes', 'reject')),
  comment text,
  revisit text[] not null default '{}',
  -- AC-044.2: Request Changes and Reject say why.
  constraint safety_review_decisions_comment_required
    check (decision = 'approve' or (comment is not null and btrim(comment) <> '')),
  -- AC-044.4: they also name what to revisit; Approve names nothing.
  constraint safety_review_decisions_revisit_valid
    check (revisit <@ array['venue', 'equipment']::text[]
           and case when decision = 'approve' then cardinality(revisit) = 0 else cardinality(revisit) > 0 end)
);
create index if not exists safety_review_decisions_event_idx on public.safety_review_decisions (event_id, decided_at desc);

create table if not exists public.safety_review_assessments (
  decision_id uuid not null references public.safety_review_decisions (id) on delete cascade,
  factor text not null,
  concern boolean not null,
  note text,
  primary key (decision_id, factor),
  constraint safety_review_assessments_factor_valid check (factor = any (public.safety_review_factors())),
  -- AC-044.1: a concern says what it is.
  constraint safety_review_assessments_note_required check (not concern or (note is not null and btrim(note) <> ''))
);

-- Read and written only through the functions below.
alter table public.safety_review_decisions enable row level security;
alter table public.safety_review_assessments enable row level security;
revoke all on public.safety_review_decisions, public.safety_review_assessments from public, anon, authenticated;

-- AC-044.5: the Coordinator chooses how they hear about decisions (US33).
insert into public.notification_types (code, label, description, roles, delivered_in_app, delivered_by_email, sort_order)
values ('safety_review_decision', 'Safety review decisions',
        'When the Safety Officer approves, rejects or asks for changes to an event you coordinate.', '{coordinator}', true, true, 125)
on conflict (code) do update set
  label = excluded.label, description = excluded.description, roles = excluded.roles,
  delivered_in_app = excluded.delivered_in_app, delivered_by_email = excluded.delivered_by_email,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- AC-044.1 to AC-044.6: the Safety Officer records a decision
-- ---------------------------------------------------------------------------
-- p_assessments: [{"factor": "attendance", "concern": false, "note": null}, ...], every factor once.
create or replace function public.record_safety_review_decision(
  p_event_id uuid, p_decision text, p_comment text, p_revisit text[], p_assessments jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_decision_id uuid;
  v_status text;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_revisit text[] := coalesce(p_revisit, '{}');
  v_factors text[];
  v_concerns text;
  v_label text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'safety_officer' then
    raise exception 'Only a Safety Officer can decide a safety review' using errcode = '42501';
  end if;
  if not public.safety_review_enabled() then
    raise exception 'The safety review is not switched on yet' using errcode = '0A000';
  end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if e.status <> 'awaiting_safety_review' then
    raise exception 'Only an event awaiting safety review can be decided' using errcode = '22000';
  end if;

  if p_decision is null or p_decision not in ('approve', 'request_changes', 'reject') then
    raise exception 'Choose Approve, Request Changes or Reject' using errcode = '22023';
  end if;
  if p_decision <> 'approve' and v_comment is null then
    raise exception 'Add a comment explaining the decision' using errcode = '22023';
  end if;
  if p_decision = 'approve' and cardinality(v_revisit) > 0 then
    raise exception 'An approval names nothing to revisit' using errcode = '22023';
  end if;
  if p_decision <> 'approve' and (cardinality(v_revisit) = 0 or not v_revisit <@ array['venue', 'equipment']::text[]) then
    raise exception 'Name the arrangements to revisit: venue, equipment or both' using errcode = '22023';
  end if;
  -- Each arrangement once, in a fixed order, for the record and the notice alike.
  v_revisit := (select coalesce(array_agg(distinct r order by r), '{}') from unnest(v_revisit) r);

  if p_assessments is null or jsonb_typeof(p_assessments) <> 'array' then
    raise exception 'Assess every factor' using errcode = '22023';
  end if;
  select array_agg(a ->> 'factor' order by a ->> 'factor') into v_factors from jsonb_array_elements(p_assessments) a;
  if v_factors is distinct from (select array_agg(f order by f) from unnest(public.safety_review_factors()) f) then
    raise exception 'Assess every factor once: %', array_to_string(public.safety_review_factors(), ', ') using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_assessments) a
             where jsonb_typeof(a -> 'concern') is distinct from 'boolean'
                or ((a ->> 'concern')::boolean and nullif(btrim(coalesce(a ->> 'note', '')), '') is null)) then
    raise exception 'Mark each factor as concern or no concern, and describe every concern' using errcode = '22023';
  end if;

  insert into public.safety_review_decisions (event_id, decided_by, decision, comment, revisit)
  values (e.id, auth.uid(), p_decision, v_comment, v_revisit)
  returning id into v_decision_id;
  insert into public.safety_review_assessments (decision_id, factor, concern, note)
  select v_decision_id, a ->> 'factor', (a ->> 'concern')::boolean, nullif(btrim(coalesce(a ->> 'note', '')), '')
  from jsonb_array_elements(p_assessments) a;

  -- AC-044.3 / AC-044.4, through the status rules of 0108 (only a Safety Officer may do this).
  v_status := case when p_decision = 'approve' then 'in_preparation' else 'safety_changes_requested' end;
  update public.events set status = v_status where id = e.id;

  -- AC-044.5: tell the assigned Coordinator, with the comment and what to revisit.
  if e.coordinator_id is not null then
    v_label := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes requested' end;
    select string_agg(format('%s (%s)', initcap(replace(x.factor, '_', ' ')), x.note), '; ' order by x.ord)
      into v_concerns
      from (select a.factor, a.note, f.ord from public.safety_review_assessments a
              join unnest(public.safety_review_factors()) with ordinality as f(code, ord) on f.code = a.factor
             where a.decision_id = v_decision_id and a.concern) x;
    perform public.send_notification(e.coordinator_id, 'safety_review_decision', e.id,
      format('Safety review %s: %s', v_label, coalesce(e.reference, e.name)),
      concat_ws(' ',
        format('%s%s: safety review %s.', coalesce(e.reference || ' ', ''), e.name, v_label),
        case when p_decision = 'approve' then 'The event is now In Preparation.'
             else format('Revisit: %s. It goes back to the Safety Officer once revised.', array_to_string(v_revisit, ' and ')) end,
        case when v_comment is not null then format('Comment: %s', v_comment) end,
        case when v_concerns is not null then format('Concerns: %s.', v_concerns) end));
  end if;
  return v_status;
end $$;
revoke all on function public.record_safety_review_decision(uuid, text, text, text[], jsonb) from public, anon;
grant execute on function public.record_safety_review_decision(uuid, text, text, text[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- AC-044.5 / AC-044.6: the decisions so far, newest first, for the assigned Coordinator and
-- Safety Officers
-- ---------------------------------------------------------------------------
create or replace function public.get_safety_review_decisions(p_event_id uuid)
returns table (decision_id uuid, decision text, comment text, revisit text[], decided_at timestamptz,
               decided_by_name text, assessments jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see safety review decisions' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if public.current_user_role() is distinct from 'safety_officer'
     and not (public.current_user_role() = 'coordinator' and e.coordinator_id = auth.uid()) then
    raise exception 'Only the event''s assigned Coordinator or a Safety Officer can see its safety review decisions'
      using errcode = '42501';
  end if;
  return query
  select d.id, d.decision, d.comment, d.revisit, d.decided_at, p.full_name,
         coalesce((select jsonb_agg(jsonb_build_object('factor', a.factor, 'concern', a.concern, 'note', a.note) order by f.ord)
                   from public.safety_review_assessments a
                   join unnest(public.safety_review_factors()) with ordinality as f(code, ord) on f.code = a.factor
                   where a.decision_id = d.id), '[]'::jsonb)
  from public.safety_review_decisions d
  join public.profiles p on p.id = d.decided_by
  where d.event_id = p_event_id
  order by d.decided_at desc, d.id;
end $$;
revoke all on function public.get_safety_review_decisions(uuid) from public, anon;
grant execute on function public.get_safety_review_decisions(uuid) to authenticated;

commit;
