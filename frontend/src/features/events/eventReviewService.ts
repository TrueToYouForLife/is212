import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { canActorTransition } from './statusRules'
import type { UserRole } from '../auth/types'
import type {
  EventRequestDetail,
  EventRequestSummary,
  EventStatus,
  ReviewDecision,
  ReviewDecisionOutcome,
} from './types'

/**
 * Reading and reviewing event requests. Separate from eventService so the organiser's
 * submission path and the coordinator's review path do not grow into one file that knows
 * about everything.
 *
 * No role checks are needed on the reads: RLS decides what comes back. An organiser
 * running listEventRequests gets their own events; a coordinator gets all of them. The
 * query is the same, which is the point of enforcing authorisation in the database.
 */

// Written as single string literals rather than concatenated: supabase-js infers the row
// type by parsing this string at the type level, and a computed string collapses that to
// an error type. Long lines are the price of typed results.
const SUMMARY_COLUMNS =
  'id, reference, organiser_id, coordinator_id, name, purpose, event_type, proposed_start, proposed_end, expected_attendance, status, submitted_at, review_note'

// coordinator_id must be selected here as well as in SUMMARY_COLUMNS: getEventRequest
// spreads toSummary, which maps it, so omitting it here reports every event as
// unassigned rather than failing loudly. Both lists feed the same mapper — add a column
// to one and check whether the other needs it too.
const DETAIL_COLUMNS =
  'id, reference, organiser_id, coordinator_id, name, purpose, event_type, proposed_start, proposed_end, expected_attendance, status, submitted_at, description, programme, layout_preference, accessibility_requirements, facility_requirements, equipment_requirements, registration_required, special_arrangements, review_note, reviewed_at, created_at, updated_at'

const DECISION_COLUMNS = 'id, from_status, decision, reason, decided_by_name, decided_at'

export const REVIEW_MESSAGES = {
  loadFailed: 'The event requests could not be loaded.',
  notFound: 'That event request could not be found, or you are not permitted to see it.',
  illegalTransition: 'That is not a valid next step for this request.',
  notPermitted: 'You are not permitted to make that change.',
  noteRequired: 'Give a reason when returning or rejecting a request.',
  historyFailed: 'The decision history could not be loaded.',
  // US26 (0117): the database refuses to confirm an event until its arrangements are complete.
  notReady: 'This event is not ready to be confirmed: every essential arrangement on its Readiness card must be complete.',
} as const

interface EventRow {
  coordinator_id?: string | null
  review_note?: string | null
  id: string
  reference: string | null
  organiser_id: string
  name: string | null
  purpose: string | null
  event_type: string | null
  proposed_start: string | null
  proposed_end: string | null
  expected_attendance: number | null
  status: string
  submitted_at: string | null
}

function toSummary(row: EventRow): EventRequestSummary {
  return {
    id: row.id,
    reference: row.reference,
    organiserId: row.organiser_id,
    coordinatorId: row.coordinator_id,
    name: row.name,
    purpose: row.purpose,
    eventType: row.event_type,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    expectedAttendance: row.expected_attendance,
    status: row.status as EventStatus,
    submittedAt: row.submitted_at,
    reviewNote: row.review_note ?? null,
  }
}

/**
 * A database error is for us, not for the organiser. "column events.review_note does not
 * exist" tells a user nothing they can act on and leaks our schema; it belongs in the
 * console where a developer will find it.
 *
 * Errors we have explicitly mapped to advice — a permission refusal, a missing row — keep
 * their own wording. Anything unrecognised falls back to the plain message.
 */
function reportUnexpected(context: string, error: { message?: string; code?: string }): string {
  console.error(`[events] ${context}`, error)
  return REVIEW_MESSAGES.loadFailed
}

export type ListResult =
  | { ok: true; requests: EventRequestSummary[] }
  | { ok: false; reason: string }

/** Organisers may include their drafts; coordinator queues keep the default filter. */
export async function listEventRequests(includeDrafts = false): Promise<ListResult> {
  let query = supabase.from('events').select(SUMMARY_COLUMNS)
  if (!includeDrafts) query = query.neq('status', 'draft')
  const { data, error } = await query
    .order('submitted_at', { ascending: false, nullsFirst: false })

  if (error) return { ok: false, reason: reportUnexpected('listEventRequests', error) }

  const rows: EventRow[] = data ?? []
  return { ok: true, requests: rows.map(toSummary) }
}

export type DetailResult =
  | { ok: true; request: EventRequestDetail }
  | { ok: false; reason: string }

export async function getEventRequest(id: string): Promise<DetailResult> {
  // Invalid URL IDs use the same response as missing or inaccessible requests.
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, reason: REVIEW_MESSAGES.notFound }
  }
  const { data, error } = await supabase
    .from('events')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, reason: reportUnexpected('getEventRequest', error) }
  // RLS makes a forbidden row indistinguishable from a missing one, which is deliberate:
  // "you may not see this" would itself leak that the request exists.
  if (!data) return { ok: false, reason: REVIEW_MESSAGES.notFound }

  return {
    ok: true,
    request: {
      ...toSummary(data),
      description: data.description,
      programme: data.programme,
      layoutPreference: data.layout_preference,
      accessibilityRequirements: data.accessibility_requirements ?? [],
      facilityRequirements: data.facility_requirements ?? [],
      equipmentRequirements: data.equipment_requirements ?? [],
      registrationRequired: data.registration_required ?? false,
      specialArrangements: data.special_arrangements,
      reviewNote: data.review_note,
      reviewedAt: data.reviewed_at,
      createdAt: data.created_at,
      // US37 passes this back to 0096 untouched as the version being answered, so the
      // detail read is the only place it may come from.
      updatedAt: data.updated_at,
    },
  }
}

export type TransitionResult = { ok: true; status: EventStatus } | { ok: false; reason: string }

/**
 * Review workflow transitions live here. Explicit draft submission lives in eventService
 * so it can update validated details and status atomically. Both paths keep the database
 * transition trigger as the backstop rather than the user-facing error message.
 */
export async function transitionEventStatus(options: {
  id: string
  from: EventStatus
  to: EventStatus
  actor: { role: UserRole; isOwner: boolean }
  note?: string
}): Promise<TransitionResult> {
  const { id, from, to, actor, note } = options

  if (!canActorTransition(actor, from, to)) {
    return { ok: false, reason: REVIEW_MESSAGES.notPermitted }
  }

  // A rejection or a return without a reason leaves the organiser nothing to act on.
  const needsNote = to === 'rejected' || to === 'withdrawn'
  || (to === 'submitted' && ['submitted', 'under_review'].includes(from))
    if (needsNote && !note?.trim()) {
    return { ok: false, reason: REVIEW_MESSAGES.noteRequired }
  }

  if (from === 'submitted' && ['approved', 'rejected', 'submitted'].includes(to)) {
    const { data, error } = await supabase.rpc('review_submitted_event', {
      p_event_id: id, p_decision: to, p_note: note?.trim() || null,
    })
    if (error || data !== to) return { ok: false, reason: error?.code === '42501'
      ? REVIEW_MESSAGES.notPermitted : REVIEW_MESSAGES.illegalTransition }
    return { ok: true, status: to }
  }

  const { data, error } = await supabase
    .from('events')
    .update({ status: to, review_note: note?.trim() || null })
    .eq('id', id)
    // Optimistic concurrency: if another coordinator has already moved this request, the
    // filter matches nothing and we report it rather than overwriting their decision.
    .eq('status', from)
    .select('id, status')
    .maybeSingle()

  if (error) {
    if (error.code === '55000') return { ok: false, reason: REVIEW_MESSAGES.notReady }
    // A refusal from the trigger or a policy is meaningful: the workflow said no.
    const refused = error.code === '42501' || error.code === '22000'
    return {
      ok: false,
      reason: refused
        ? REVIEW_MESSAGES.notPermitted
        : reportUnexpected('transitionEventStatus', error),
    }
  }
  if (!data) return { ok: false, reason: REVIEW_MESSAGES.illegalTransition }

  return { ok: true, status: data.status as EventStatus }
}

interface DecisionRow {
  id: string
  from_status: string
  decision: string
  reason: string | null
  decided_by_name: string
  decided_at: string
}

export type DecisionHistoryResult =
  | { ok: true; decisions: ReviewDecision[] }
  | { ok: false; reason: string }

/**
 * AC-004.5. Read-only on purpose: decisions are recorded by the database trigger that
 * fires when transitionEventStatus changes the status, using auth.uid() as the actor.
 * There is no client write path to forge or edit a record, so there is no write function.
 *
 * RLS returns rows only to coordinators and operations managers. For anyone else the
 * result is an empty history, which is the same thing the organiser would see anyway.
 */
export async function listReviewDecisions(eventId: string): Promise<DecisionHistoryResult> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, reason: REVIEW_MESSAGES.notFound }
  }

  const { data, error } = await supabase
    .from('event_review_decisions')
    .select(DECISION_COLUMNS)
    .eq('event_id', eventId)
    .order('decided_at', { ascending: false })

  if (error) {
    console.error('[events] listReviewDecisions', error)
    return { ok: false, reason: REVIEW_MESSAGES.historyFailed }
  }

  const rows: DecisionRow[] = data ?? []
  return {
    ok: true,
    decisions: rows.map((row) => ({
      id: row.id,
      fromStatus: row.from_status as EventStatus,
      decision: row.decision as ReviewDecisionOutcome,
      reason: row.reason,
      decidedByName: row.decided_by_name,
      decidedAt: row.decided_at,
    })),
  }
}
