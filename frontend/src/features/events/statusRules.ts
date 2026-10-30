import { FEATURES } from '../../lib/features'
import type { UserRole } from '../auth/types'
import type { EventStatus } from './types'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * Mirrors is_valid_status_transition and enforce_event_status_transition in
 * 0004_review.sql, as extended by 0108 (US43's safety review stages). The database is the
 * control; this exists so the UI can offer only the
 * buttons that will actually work, instead of showing an action and reporting a failure
 * after the round trip. Same defence-in-depth split as validation.ts.
 *
 * If you change one, change the other — statusRules.test.ts states the pairing.
 */
export const STATUS_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under_review', 'cancelled', 'withdrawn'],
  // Back to submitted is a coordinator asking for more detail — a normal review outcome.
  under_review: ['approved', 'rejected', 'submitted', 'cancelled', 'withdrawn'],
  approved: ['planning', 'cancelled'],
  // US43: once the safety review is switched on, an event leaves Planning only by being sent
  // for it; until then Planning is confirmed as before (0108's safety_review_settings).
  planning: FEATURES.safetyReview ? ['awaiting_safety_review', 'cancelled'] : ['confirmed', 'cancelled'],
  // US45 (0118): a sent-back event is revised in Planning; Awaiting and In Preparation go back to
  // Planning only when an arrangement changes (the database does that, never a button).
  awaiting_safety_review: ['in_preparation', 'safety_changes_requested', 'planning', 'cancelled'],
  safety_changes_requested: ['planning', 'cancelled'],
  in_preparation: ['confirmed', 'planning', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  // Terminal. Coming back from one of these is a new request, which keeps the trail honest.
  completed: [],
  cancelled: [],
  rejected: [],
  withdrawn: [],
}

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

interface ActorContext {
  role: UserRole
  isOwner: boolean
}

/** Role AND relationship: being a coordinator does not let you submit someone's draft. */
export function canActorTransition(
  actor: ActorContext,
  from: EventStatus,
  to: EventStatus,
): boolean {
  // One UI action uses 0012's atomic RPC for the existing two database transitions.
  if (actor.role === 'coordinator' && from === 'submitted'
    && ['approved', 'rejected', 'submitted'].includes(to)) return true
  if (!canTransition(from, to)) return false

  // US43: the Coordinator sends an event for review from its Readiness card, not with a status button.
  if (from === 'planning' && to === 'awaiting_safety_review') return false
  // US45: only the database sends an event in review or preparation back to Planning.
  if (to === 'planning' && (from === 'awaiting_safety_review' || from === 'in_preparation')) return false
  // Deciding a safety review is the Safety Officer's alone (US44).
  if (from === 'awaiting_safety_review' && to !== 'cancelled') return actor.role === 'safety_officer'

  if (actor.role === 'coordinator') {
    // Reviewing is theirs; filing a request on an organiser's behalf is not.
    return !(from === 'draft' && to === 'submitted')
  }

  if (actor.role === 'organiser' && actor.isOwner) {
    // An organiser submits and may withdraw. Approval is not theirs to grant — that is
    // the entire reason a review step exists.
    return to === 'submitted' || to === 'cancelled'
  }

  return false
}

export interface ReviewAction {
  to: EventStatus
  label: string
  tone: 'primary' | 'danger' | 'neutral'
}

/** The actions a coordinator should see for a request in this status, in priority order. */
const REVIEW_ACTIONS: readonly ReviewAction[] = [
  { to: 'approved', label: 'Approve', tone: 'primary' },
  { to: 'submitted', label: 'Return for more detail', tone: 'neutral' },
  { to: 'rejected', label: 'Reject', tone: 'danger' },
  { to: 'withdrawn', label: 'Withdraw request', tone: 'danger' },
  { to: 'planning', label: 'Start planning', tone: 'primary' },
  { to: 'confirmed', label: 'Confirm event', tone: 'primary' },
  { to: 'completed', label: 'Mark completed', tone: 'primary' },
  { to: 'cancelled', label: 'Cancel event', tone: 'danger' },
]

export function reviewActionsFor(status: EventStatus): ReviewAction[] {
  return REVIEW_ACTIONS.filter((action) =>
    status !== 'draft' &&
    canActorTransition({ role: 'coordinator', isOwner: false }, status, action.to),
  ).map((action) =>
    // US45: going back to Planning after a safety review is revising the arrangements.
    status === 'safety_changes_requested' && action.to === 'planning'
      ? { ...action, label: 'Revise arrangements' }
      : action,
  )
}

/**
 * Mirrors set_event_registration in 0057: only a Confirmed event can have registration
 * switched (attendees cannot register before then, and a closed event has nothing to switch).
 * The database is the control; this only decides whether to show the switch.
 */
export function canChangeRegistration(status: EventStatus): boolean {
  return status === 'confirmed'
}
