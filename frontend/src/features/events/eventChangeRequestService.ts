import type { ChangeRequestReplyRound } from './changeRequestReplyTypes'
import { supabase } from '../../lib/supabase'
import type { EventChangeRequest, ChangeRequestStatus, ProposedEventChanges, ChangeRequestFieldDecision } from './types'
import type { EventStatus } from './types' // adjust path if EventStatus lives elsewhere

/**
 * Organiser submission, listing and withdrawal use the separate event_change_requests
 * table. Applying approved values belongs to the coordinator review RPC/service.
 */

const PENDING_STATUS: ChangeRequestStatus = 'submitted'
const WITHDRAWN_STATUS: ChangeRequestStatus = 'withdrawn'

// AC-006.2: cancelled, completed and rejected events are blocked. Confirmed is NOT in
// this list, deliberately: AC-006.9 ("original confirmed details remain in force and
// visible until the request is approved") only makes sense if a confirmed event can
// still be changed. This list previously held 'confirmed' instead of 'completed', which
// blocked the story's main case and let a finished event be edited.
export const LOCKED_STATUSES: EventStatus[] = ['cancelled', 'completed', 'rejected']


const POSTGRES_FOREIGN_KEY_VIOLATION = '23503'
const POSTGRES_RLS_VIOLATION = '42501'
const POSTGRES_CHECK_VIOLATION = '23514'

export const CHANGE_REQUEST_MESSAGES = {
  notSignedIn: 'You must be signed in to request a change.',
  reasonRequired: 'Please explain why you are requesting this change.',
  noChangesProposed: 'Please propose at least one change.',
  eventNotFound: 'That event could not be found.',
  eventLocked: 'Changes can no longer be requested for this event.',
  rlsDenied: 'You are not permitted to request changes on this event.',
  alreadyPending: 'A change request for this event is already pending review.',
  notWithdrawable: 'This request can no longer be withdrawn — it may have already been reviewed.',
  unexpected: 'Something went wrong submitting your change request. Please try again.',
} as const

/** Basic shape validation. Field-level rules (e.g. valid dates) belong in a shared
 *  validator if the event form already has one — reuse it rather than duplicating rules. */
function validateChangeRequestInput(
  proposedChanges: ProposedEventChanges,
  reason: string,
): { ok: true } | { ok: false; reason: string } {
  if (!reason.trim()) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.reasonRequired }
  }
  if (Object.keys(proposedChanges).length === 0) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed }
  }
  return { ok: true }
}

function describeDatabaseError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case POSTGRES_RLS_VIOLATION:
      return CHANGE_REQUEST_MESSAGES.rlsDenied
    case POSTGRES_FOREIGN_KEY_VIOLATION:
      return CHANGE_REQUEST_MESSAGES.eventNotFound
    case POSTGRES_CHECK_VIOLATION:
      return CHANGE_REQUEST_MESSAGES.noChangesProposed
    default:
      console.error('[change-requests]', error)
      return CHANGE_REQUEST_MESSAGES.unexpected
  }
}

/**
 * Organiser proposes new values for a submitted/confirmed event. Recorded as a pending
 * row, never applied to the event itself — a coordinator reviews and approves/rejects it
 * separately. Activity history (who/when) comes for free from organiser_id + submitted_at,
 * both of which should be set by a database default/trigger, not the client, so a client
 * can't backdate or spoof who asked.
 */

export type RequestEventChangeResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: string }

export async function requestEventChange(
  eventId: string,
  proposedChanges: ProposedEventChanges,
  reason: string,
): Promise<{ ok: true; requestId: string } | { ok: false; reason: string }> {
  const validation = validateChangeRequestInput(proposedChanges, reason)
  if (!validation.ok) return validation

  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  const userId = sessionData?.user?.id
  if (sessionError || !userId) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.notSignedIn }
  }

  // AC: changes can only be requested on events that are not confirmed, cancelled or
  // rejected. Checked here (not just hidden in the UI) so a direct call can't bypass it.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('status')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.eventNotFound }
  }
  if (LOCKED_STATUSES.includes(event.status)) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.eventLocked }
  }

  // Guard against a second pending request piling up on the same event. Better enforced
  // as a partial unique index in the DB (event_id where status = 'pending'), but a
  // pre-check gives a clearer error message than a raw 23505 would.
  const { data: existing } = await supabase
    .from('event_change_requests')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', PENDING_STATUS)
    .maybeSingle()

  if (existing) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.alreadyPending }
  }

  const { data, error } = await supabase
    .from('event_change_requests')
    .insert({
      event_id: eventId,
      organiser_id: userId,
      proposed_changes: proposedChanges,
      reason,
      status: PENDING_STATUS,
    })
    .select('id')
    .single()

  if (error) return { ok: false, reason: describeDatabaseError(error) }
  return { ok: true, requestId: data.id }
}

export interface EventChangeRequestRow {
  event_change_review_history?: {
    id: string
    request_version: number
    outcome: Exclude<ChangeRequestStatus, 'submitted' | 'withdrawn'>
    proposed_changes: ProposedEventChanges
    field_decisions: ChangeRequestFieldDecision[]
    review_note: string | null
    reviewer_name: string
    reviewed_at: string
  }[]
  review_version?: number
  reply_history?: ChangeRequestReplyRound[] | null
  id: string
  event_id: string
  proposed_changes: ProposedEventChanges
  reason: string
  status: ChangeRequestStatus
  submitted_at: string
  reviewed_at: string | null
  review_note: string | null
  field_decisions: ChangeRequestFieldDecision[] | null
}

// matches camelCase variables to snake_case
export function toEventChangeRequest(row: EventChangeRequestRow): EventChangeRequest {
  return {
    reviewHistory: (row.event_change_review_history ?? []).map((entry) => ({
      id: entry.id, requestVersion: entry.request_version, outcome: entry.outcome,
      proposedChanges: entry.proposed_changes, fieldDecisions: entry.field_decisions,
      reviewNote: entry.review_note, reviewerName: entry.reviewer_name, reviewedAt: entry.reviewed_at,
    })).sort((a, b) => b.requestVersion - a.requestVersion),
    reviewVersion: row.review_version,
    replyHistory: row.reply_history ?? [],
    id: row.id,
    eventId: row.event_id,
    proposedChanges: row.proposed_changes,
    reason: row.reason,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    fieldDecisions: row.field_decisions ?? [],
  }
}

/** Organiser checks on a request they raised. RLS should restrict this to their own rows
 *  (and a coordinator's own review queue) — this function doesn't need to know that. */
export async function getMyChangeRequests(eventId: string): Promise<EventChangeRequest[]> {
  const { data, error } = await supabase
    .from('event_change_requests')
    .select('id, event_id, proposed_changes, reason, status, submitted_at, reviewed_at, review_note, field_decisions, review_version, reply_history')
    .eq('event_id', eventId)
    .order('submitted_at', { ascending: false })

  if (error) {
    throw new Error('The change requests could not be loaded. Please try again.')
  }
  return (data ?? []).map(toEventChangeRequest)
}

/**
 * Withdraws a request the organiser hasn't had reviewed yet. The .eq('status', 'pending')
 * filter is the safety net: if a coordinator has already approved/rejected it between the
 * organiser loading the page and clicking withdraw, this simply matches zero rows instead
 * of clobbering a decision — same defensive pattern as your friend's draft-finalize update.
 */
export async function withdrawChangeRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  const userId = sessionData?.user?.id
  if (sessionError || !userId) {
    return { ok: false, reason: CHANGE_REQUEST_MESSAGES.notSignedIn }
  }

  const { data, error } = await supabase
    .from('event_change_requests')
    .update({ status: WITHDRAWN_STATUS })
    .eq('id', requestId)
    .eq('organiser_id', userId)
    .eq('status', PENDING_STATUS)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, reason: describeDatabaseError(error) }
  if (!data) return { ok: false, reason: CHANGE_REQUEST_MESSAGES.notWithdrawable }
  return { ok: true }
}
