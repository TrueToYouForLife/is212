import { VALIDATION_MESSAGES } from './validation'
import type { EventRequestDetail } from './types'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * US37 (SCRUM-234): preparing an Organiser's answer to a clarification request.
 *
 * Mirrors 0096: clarification_editable_fields() for what may be revised, and the
 * returned-state test from respond_to_clarification for when it may be revised at all. The
 * database is the control; this exists so the screen can refuse an answer it already knows
 * will be rejected, and so the form can be hidden when there is nothing to answer.
 *
 * If you change one, change the other — clarificationResponseValidation.test.ts states the
 * pairing against the column list the migration whitelists.
 */

/**
 * The app's name for each revisable field, and the column 0096 knows it by. Both halves
 * matter: the keys are what the form works in, the values are what the RPC's jsonb is
 * keyed on, and the pair is what makes the mirror checkable.
 */
export const CLARIFICATION_FIELD_COLUMNS = {
  name: 'name',
  purpose: 'purpose',
  eventType: 'event_type',
  description: 'description',
  proposedStart: 'proposed_start',
  proposedEnd: 'proposed_end',
  expectedAttendance: 'expected_attendance',
  programme: 'programme',
  layoutPreference: 'layout_preference',
  accessibilityRequirements: 'accessibility_requirements',
  facilityRequirements: 'facility_requirements',
  equipmentRequirements: 'equipment_requirements',
  registrationRequired: 'registration_required',
  specialArrangements: 'special_arrangements',
} as const

export type ClarificationField = keyof typeof CLARIFICATION_FIELD_COLUMNS

export const CLARIFICATION_FIELDS = Object.keys(CLARIFICATION_FIELD_COLUMNS) as ClarificationField[]

/** The subset of a request an Organiser may revise while answering. */
export type ClarificationValues = Partial<Pick<EventRequestDetail, ClarificationField>>

export const CLARIFICATION_MESSAGES = {
  notReturned: 'This request is not waiting for your clarification.',
  replyRequired: 'Write a reply to the coordinator’s question.',
  nameRequired: 'Event name is required.',
  unknownField: 'That field cannot be changed when answering a clarification request.',
} as const

export interface ClarificationResponseInput {
  reply: string
  values: ClarificationValues
}

export type ClarificationValidation =
  | { ok: true; reply: string; updates: Record<string, unknown> }
  | { ok: false; reason: string }

/**
 * A request is awaiting clarification when it is submitted AND carries a question. Both
 * halves are needed: a submitted request with no note is simply waiting to be picked up,
 * and that is the case AC-037.4 refuses.
 *
 * This is the same test organiserStatusLabel uses to show "Clarification required", so the
 * badge and the form can never disagree about whether there is a question outstanding.
 */
export function isAwaitingClarification(
  request: Pick<EventRequestDetail, 'status' | 'reviewNote'>,
): boolean {
  return request.status === 'submitted' && (request.reviewNote ?? '').trim().length > 0
}

/** Arrays compare by contents; everything else by value. Order is not meaningful in a
 *  requirement list, so a reordered selection is not a change. */
function sameValue(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) || Array.isArray(after)) {
    const left = [...(Array.isArray(before) ? before : [])].sort()
    const right = [...(Array.isArray(after) ? after : [])].sort()
    return left.length === right.length && left.every((item, index) => item === right[index])
  }
  // null and '' both mean "nothing here" for an optional text field, and a form cannot
  // produce null. Treating them as equal stops every untouched optional field appearing
  // as a revision.
  if ((before ?? '') === '' && (after ?? '') === '') return true
  return before === after
}

/**
 * Only what actually changed. The form renders every revisable field, so without this an
 * answer would record all fourteen as revised and the before/after record AC-037.5 asks
 * for would say nothing about what the Organiser actually did.
 *
 * 0096 itself records whatever it is sent, including a field resubmitted unchanged — that
 * is deliberate at the API level and is covered by AC-037.5.4. This is the screen's
 * narrower choice, because "touched" is not something a form can observe.
 */
export function changedClarificationFields(
  request: ClarificationValues,
  values: ClarificationValues,
): ClarificationValues {
  const changed: ClarificationValues = {}
  for (const field of CLARIFICATION_FIELDS) {
    if (!(field in values)) continue
    if (sameValue(request[field], values[field])) continue
    // The index signature of a heterogeneous Partial cannot be narrowed per key without a
    // cast; the keys themselves are checked against the whitelist above.
    Object.assign(changed, { [field]: values[field] })
  }
  return changed
}

export function validateClarificationResponse(
  request: EventRequestDetail,
  input: ClarificationResponseInput,
): ClarificationValidation {
  if (!isAwaitingClarification(request)) {
    return { ok: false, reason: CLARIFICATION_MESSAGES.notReturned }
  }

  const reply = input.reply.trim()
  if (!reply) return { ok: false, reason: CLARIFICATION_MESSAGES.replyRequired }

  for (const field of Object.keys(input.values)) {
    if (!(field in CLARIFICATION_FIELD_COLUMNS)) {
      return { ok: false, reason: CLARIFICATION_MESSAGES.unknownField }
    }
  }

  const changed = changedClarificationFields(request, input.values)

  // The revised request still has to be a valid request. Checked against the merged result
  // rather than the revision alone: moving the start past an unchanged end is invalid even
  // though only one field was touched.
  const merged = { ...request, ...changed }

  if ('name' in changed && !(merged.name ?? '').trim()) {
    return { ok: false, reason: CLARIFICATION_MESSAGES.nameRequired }
  }
  if ('purpose' in changed && !(merged.purpose ?? '').trim()) {
    return { ok: false, reason: VALIDATION_MESSAGES.purposeRequired }
  }

  if ('expectedAttendance' in changed) {
    const attendance = merged.expectedAttendance
    if (attendance === null || attendance === undefined) {
      return { ok: false, reason: VALIDATION_MESSAGES.attendanceRequired }
    }
    if (!Number.isInteger(attendance)) {
      return { ok: false, reason: VALIDATION_MESSAGES.attendanceNumeric }
    }
    if (attendance < 1) return { ok: false, reason: VALIDATION_MESSAGES.attendancePositive }
  }

  if ('proposedStart' in changed || 'proposedEnd' in changed) {
    const start = merged.proposedStart ? new Date(merged.proposedStart) : null
    const end = merged.proposedEnd ? new Date(merged.proposedEnd) : null
    if (!start || Number.isNaN(start.getTime())) {
      return { ok: false, reason: VALIDATION_MESSAGES.startInvalid }
    }
    if (!end || Number.isNaN(end.getTime())) {
      return { ok: false, reason: VALIDATION_MESSAGES.endInvalid }
    }
    if (end.getTime() <= start.getTime()) {
      return { ok: false, reason: VALIDATION_MESSAGES.endBeforeStart }
    }
  }

  // Keyed on the columns 0096 whitelists. An empty object is a valid answer: a reply on its
  // own means "nothing needs to change, and here is why".
  const updates: Record<string, unknown> = {}
  for (const field of CLARIFICATION_FIELDS) {
    if (field in changed) updates[CLARIFICATION_FIELD_COLUMNS[field]] = changed[field]
  }

  return { ok: true, reply, updates }
}
