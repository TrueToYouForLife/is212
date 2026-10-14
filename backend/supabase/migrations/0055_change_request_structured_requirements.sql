-- US2/US6 structured event requirements, slice 2 (follows 0052). Safe to replay.
--
-- 0013's review_event_change_request insists every proposed value except
-- registrationRequired is a JSON string:
--
--   if jsonb_typeof(proposed_value) is distinct from
--     (case when field_name = 'registrationRequired' then 'boolean' else 'string' end)
--
-- Now that accessibility, facility and equipment requirements are code lists, a proposal
-- for one of them arrives as a JSON array and that check rejects it outright. This
-- migration replaces the function with one that knows which fields are lists. Everything
-- else — locking order, version checks, updated_at guard, decision bookkeeping, the
-- 0010 provisional-clarification behaviour — is carried over unchanged on purpose: this
-- is a type fix, not a rewrite of the review rules.
--
-- reply_to_change_request is NOT replaced: it only ever validates the organiser's answer
-- text, never the proposed values, so the type change does not reach it.
begin;

create or replace function public.review_event_change_request(
  p_request_id uuid, p_event_updated_at timestamptz, p_review jsonb
) returns text
language plpgsql security definer set search_path = '' set timezone = 'Asia/Singapore' as $$
declare
  request_row public.event_change_requests%rowtype;
  event_row public.events%rowtype;
  candidate public.events%rowtype;
  entry jsonb;
  field_name text;
  column_name text;
  expected_type text;
  proposed_value jsonb;
  element jsonb;
  patch jsonb := '{}';
  decisions jsonb := '[]';
  seen text[] := '{}';
  accepted integer := 0;
  needs_clarification boolean := false;
  outcome text;
  note text;
  -- The code-list fields. Kept as one list so the type check and the patch builder can
  -- never disagree about which fields are arrays.
  list_fields constant text[] := array[
    'accessibilityRequirements', 'facilityRequirements', 'equipmentRequirements'];
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'coordinator' then
    raise exception 'Only the assigned coordinator may review this request' using errcode = '42501';
  end if;
  select * into request_row from public.event_change_requests where id = p_request_id;
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;

  -- Serialise decisions for one event and coordinate with assignment/event edits.
  select * into event_row from public.events where id = request_row.event_id for update;
  if not found or event_row.coordinator_id is distinct from auth.uid() then
    raise exception 'Request unavailable' using errcode = '42501';
  end if;
  select * into request_row from public.event_change_requests where id = p_request_id for update;
  -- Old clients may finish first-round reviews, but must reload before reviewing
  -- any request that has been answered. A new client always sends its snapshot version.
  if p_review ? 'requestVersion' then
    if jsonb_typeof(p_review->'requestVersion') is distinct from 'number'
      or (p_review->>'requestVersion')::numeric <> request_row.review_version then
      raise exception 'Request changed; reload before reviewing' using errcode='22000';
    end if;
  elsif jsonb_array_length(request_row.reply_history) > 0 then
    raise exception 'Request changed; reload before reviewing' using errcode='22000';
  end if;
  p_review := p_review - 'requestVersion';
  if request_row.status <> 'submitted' then
    raise exception 'This request is no longer pending review' using errcode = '22000';
  end if;
  if event_row.status not in ('submitted', 'under_review', 'approved', 'planning', 'confirmed') then
    raise exception 'This event can no longer be changed' using errcode = '22000';
  end if;
  if p_event_updated_at is null or event_row.updated_at is distinct from p_event_updated_at then
    raise exception 'Event details changed; reload before reviewing' using errcode = '22000';
  end if;
  if jsonb_typeof(p_review) is distinct from 'object'
    or jsonb_typeof(request_row.proposed_changes) is distinct from 'object'
    or request_row.proposed_changes = '{}'::jsonb then
    raise exception 'Invalid review or proposal' using errcode = '22000';
  end if;

  if p_review->>'action' = 'clarify' then
    if p_review - array['action','note'] <> '{}'::jsonb
      or jsonb_typeof(p_review->'note') is distinct from 'string'
      or nullif(btrim(p_review->>'note'), '') is null then
      raise exception 'Explain what the organiser needs to clarify' using errcode = '22000';
    end if;
    outcome := 'clarification_requested';
    note := btrim(p_review->>'note');
  elsif p_review->>'action' = 'decide' then
    if p_review - array['action','decisions'] <> '{}'::jsonb
      or jsonb_typeof(p_review->'decisions') is distinct from 'array' then
      raise exception 'Provide decisions for the proposed changes' using errcode = '22000';
    end if;
    for entry in select value from jsonb_array_elements(p_review->'decisions') loop
      if jsonb_typeof(entry) is distinct from 'object' then
        raise exception 'Invalid field decision' using errcode = '22000';
      end if;
      field_name := entry->>'field';
      if entry - array['field','decision','note'] <> '{}'::jsonb
        or field_name is null or not request_row.proposed_changes ? field_name
        or field_name = any(seen)
        or (entry->>'decision') is null
        or (entry->>'decision') not in ('approved','rejected','clarification_requested')
        or (entry ? 'note' and jsonb_typeof(entry->'note') <> 'string') then
        raise exception 'Choose one decision for every proposed field' using errcode = '22000';
      end if;
      seen := array_append(seen, field_name);
      note := btrim(coalesce(entry->>'note', ''));
      if entry->>'decision' = 'rejected' and note = '' then
        raise exception 'Explain each rejected change' using errcode = '22000';
      end if;
      if entry->>'decision' = 'clarification_requested' then
        if note = '' then
          raise exception 'Explain what the organiser needs to clarify' using errcode = '22000';
        end if;
        needs_clarification := true;
      end if;
      column_name := case field_name
        when 'name' then 'name' when 'purpose' then 'purpose'
        when 'eventType' then 'event_type' when 'description' then 'description'
        when 'proposedStart' then 'proposed_start' when 'proposedEnd' then 'proposed_end'
        when 'expectedAttendance' then 'expected_attendance' when 'programme' then 'programme'
        when 'layoutPreference' then 'layout_preference'
        when 'accessibilityRequirements' then 'accessibility_requirements'
        when 'facilityRequirements' then 'facility_requirements'
        when 'equipmentRequirements' then 'equipment_requirements'
        when 'registrationRequired' then 'registration_required'
        when 'specialArrangements' then 'special_arrangements' end;
      if column_name is null then
        raise exception 'Unknown proposed field' using errcode = '22000';
      end if;
      proposed_value := request_row.proposed_changes->field_name;
      expected_type := case
        when field_name = 'registrationRequired' then 'boolean'
        when field_name = any(list_fields) then 'array'
        else 'string' end;
      if jsonb_typeof(proposed_value) is distinct from expected_type then
        raise exception 'Invalid proposed value type' using errcode = '22000';
      end if;
      -- A code list must be a list of codes. Checked here as well as by the events
      -- trigger, because a bad element should be refused before any event row is touched.
      if expected_type = 'array' then
        for element in select value from jsonb_array_elements(proposed_value) loop
          if jsonb_typeof(element) is distinct from 'string'
            or nullif(btrim(element #>> '{}'), '') is null then
            raise exception 'Invalid proposed value type' using errcode = '22000';
          end if;
        end loop;
      end if;
      decisions := decisions || jsonb_build_array(jsonb_build_object(
        'field', field_name, 'decision', entry->>'decision', 'note', note));
      if entry->>'decision' = 'approved' then
        accepted := accepted + 1;
        -- Lists and booleans go through as they are; free text is trimmed, and an empty
        -- string becomes null exactly as before.
        if field_name <> 'registrationRequired' and expected_type = 'string' then
          proposed_value := to_jsonb(nullif(btrim(request_row.proposed_changes->>field_name), ''));
        end if;
        patch := patch || jsonb_build_object(column_name, proposed_value);
      end if;
    end loop;
    if cardinality(seen) <> (select count(*) from jsonb_object_keys(request_row.proposed_changes)) then
      raise exception 'Choose one decision for every proposed field' using errcode = '22000';
    end if;
    outcome := case when needs_clarification then 'clarification_requested'
      when accepted = 0 then 'rejected'
      when accepted = cardinality(seen) then 'approved' else 'partially_approved' end;
    note := null;
    -- Mixed decisions are provisional while any field needs clarification. Persist
    -- the whole checklist below, but leave event values AND updated_at untouched.
    if accepted > 0 and not needs_clarification then
      -- Casts reject invalid dates/non-integer attendance. Validate the whole result:
      -- accepting only one of two proposed dates must not create an invalid interval.
      candidate := jsonb_populate_record(event_row, patch);
      if nullif(btrim(candidate.purpose), '') is null
        or candidate.proposed_start is null or candidate.proposed_end is null
        or not isfinite(candidate.proposed_start) or not isfinite(candidate.proposed_end)
        or candidate.proposed_end <= candidate.proposed_start
        or candidate.expected_attendance is null or candidate.expected_attendance < 1 then
        raise exception 'Accepted changes would leave invalid event details' using errcode = '22000';
      end if;
      update public.events set
        name=candidate.name, purpose=candidate.purpose, event_type=candidate.event_type,
        description=candidate.description, proposed_start=candidate.proposed_start,
        proposed_end=candidate.proposed_end, expected_attendance=candidate.expected_attendance,
        programme=candidate.programme, layout_preference=candidate.layout_preference,
        accessibility_requirements=candidate.accessibility_requirements,
        facility_requirements=candidate.facility_requirements,
        equipment_requirements=candidate.equipment_requirements,
        registration_required=candidate.registration_required,
        special_arrangements=candidate.special_arrangements
      where id=event_row.id;
    end if;
  else
    raise exception 'Choose a valid review action' using errcode = '22000';
  end if;

  update public.event_change_requests set status=outcome, field_decisions=decisions,
    review_note=note, reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_request_id;
  return outcome;
end $$;
revoke all on function public.review_event_change_request(uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.review_event_change_request(uuid,timestamptz,jsonb) to authenticated;

-- US7 AC12 (0015) derives what must be rechecked from the accepted significant fields.
-- facilityRequirements is a venue requirement, so it is added to the significant list and
-- to venue_needed. Everything else in this function is 0015's, unchanged: same table,
-- same columns, same "derive from saved decisions, never a browser flag" rule.
create or replace function public.queue_change_request_revalidation()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  accepted text[];
  venue_needed boolean;
  equipment_needed boolean;
begin
  if old.status <> 'submitted' or new.status not in ('approved','partially_approved') then
    return new;
  end if;
  select array_agg(d->>'field' order by d->>'field') into accepted
    from jsonb_array_elements(coalesce(new.field_decisions,'[]'::jsonb)) d
    where d->>'decision'='approved'
      and new.proposed_changes ? (d->>'field')
      and d->>'field' in ('proposedStart','proposedEnd','expectedAttendance',
        'layoutPreference','accessibilityRequirements','facilityRequirements',
        'equipmentRequirements');
  if accepted is null then return new; end if;
  venue_needed := accepted && array['proposedStart','proposedEnd','expectedAttendance',
    'layoutPreference','accessibilityRequirements','facilityRequirements'];
  equipment_needed := accepted && array['proposedStart','proposedEnd','expectedAttendance','equipmentRequirements'];
  insert into public.event_change_revalidations
    (change_request_id,event_id,approved_fields,venue_required,equipment_required,created_by)
    values (new.id,new.event_id,accepted,venue_needed,equipment_needed,new.reviewed_by);
  return new;
end $$;
revoke all on function public.queue_change_request_revalidation() from public, anon, authenticated;

commit;
