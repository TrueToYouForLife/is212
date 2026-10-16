import { supabase } from '../../lib/supabase'
import { validateEventRequest } from './validation'
import type {
  EventRequestInput,
  EventStatus,
  SubmitEventRequestResult,
  SubmittableEventRequest,
} from './types'

/**
 * Submission persistence for events. Components call this; they never
 * import the Supabase client, so swapping persistence or stubbing it in a test touches
 * exactly one file.
 */

const SUBMITTED_STATUS: EventStatus = 'submitted'

// Postgres error codes, mapped to something an organiser can act on. AC-005.4 asks for a
// reason, and "23514" is not a reason.
const POSTGRES_CHECK_VIOLATION = '23514'
const POSTGRES_UNIQUE_VIOLATION = '23505'
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503'
const POSTGRES_RLS_VIOLATION = '42501'

export const SERVICE_MESSAGES = {
  notSignedIn: 'You must be signed in as an event organiser to submit a request.',
  invalidRequest: 'The request could not be submitted because some details are invalid.',
  rlsDenied: 'You are not permitted to submit an event request for another organiser.',
  unknownOrganiser:
    'Your organiser profile could not be found. Ask a coordinator to set up your profile.',
  duplicateReference:
    'A unique reference could not be assigned to your request. Please try again.',
  constraintViolation:
    'The request was rejected by the system because some details are invalid.',
  missingReference:
    'The request was saved but no reference was assigned. Please contact a coordinator.',
  network: 'The request could not be submitted because the service is unreachable.',
  unexpected: 'Something went wrong submitting your request. Please try again.',
  draftUnavailable: 'This draft is unavailable or has already been submitted. Refresh before continuing.',
} as const

function toEventRow(request: SubmittableEventRequest, organiserId: string) {
  return {
    organiser_id: organiserId,
    name: request.name,
    purpose: request.purpose,
    event_type: request.eventType,
    description: request.description,
    proposed_start: request.proposedStart.toISOString(),
    proposed_end: request.proposedEnd.toISOString(),
    expected_attendance: request.expectedAttendance,
    programme: request.programme,
    layout_preference: request.layoutPreference,
    accessibility_requirements: request.accessibilityRequirements,
    equipment_requirements: request.equipmentRequirements,
    registration_required: request.registrationRequired,
    special_arrangements: request.specialArrangements,
    // AC-005.5: the reference and submitted_at are assigned by a database trigger on the
    // transition into this status, never by the client — two clients cannot then race to
    // mint the same number.
    status: SUBMITTED_STATUS,
  }
}

function describeDatabaseError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case POSTGRES_RLS_VIOLATION:
      return SERVICE_MESSAGES.rlsDenied
    case POSTGRES_FOREIGN_KEY_VIOLATION:
      return SERVICE_MESSAGES.unknownOrganiser
    case POSTGRES_UNIQUE_VIOLATION:
      return SERVICE_MESSAGES.duplicateReference
    case POSTGRES_CHECK_VIOLATION:
      return SERVICE_MESSAGES.constraintViolation
    default:
      // An unmapped database error is a developer's problem, not the organiser's. Raw
      // Postgres text tells them nothing actionable and leaks our schema, so it goes to
      // the console and they get something they can act on.
      console.error('[events] submitEventRequest', error)
      return SERVICE_MESSAGES.unexpected
  }
}

/**
 * AC-005.3 / AC-005.4 / AC-005.5. Never throws: the form needs a reason to display far
 * more than it needs an exception to catch, so every failure path returns a result.
 */
export async function submitEventRequest(
  input: EventRequestInput,
  draftId?: string,
): Promise<SubmitEventRequestResult> {
  const validation = validateEventRequest(input)
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.issues.map((issue) => issue.message).join(' '),
      issues: validation.issues,
    }
  }

  if (draftId !== undefined && !draftId.trim()) {
    return { ok: false, reason: SERVICE_MESSAGES.draftUnavailable, issues: [] }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  const userId = sessionData?.user?.id
  if (sessionError || !userId) {
    return { ok: false, reason: SERVICE_MESSAGES.notSignedIn, issues: [] }
  }

  // Save the latest details and submit the SAME row in one operation. The database
  // transition trigger still enforces the workflow and assigns its reference.
  const row = toEventRow(validation.value, userId)
  const response = draftId === undefined
    ? await supabase.from('events').insert(row)
      .select('id, reference, status, submitted_at').single()
    : await supabase.from('events').update(row)
      .eq('id', draftId).eq('organiser_id', userId).eq('status', 'draft')
      .select('id, reference, status, submitted_at').maybeSingle()
  const { data, error } = response
  if (!error && !data && draftId !== undefined) {
    return { ok: false, reason: SERVICE_MESSAGES.draftUnavailable, issues: [] }
  }

  if (error) {
    return { ok: false, reason: describeDatabaseError(error), issues: [] }
  }

  if (!data?.reference) {
    return { ok: false, reason: SERVICE_MESSAGES.missingReference, issues: [] }
  }

  return {
    ok: true,
    event: {
      id: data.id,
      reference: data.reference,
      status: data.status as EventStatus,
      submittedAt: data.submitted_at ?? null,
    },
  }
}
