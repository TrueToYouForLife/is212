import { supabase } from '../../lib/supabase'
import { EVENT_STATUS_LABELS, REGISTRATION_STATUS_LABELS } from './types'
import type {
  AttendeeEventStatus, LoadResult, MyRegistration, OpenEvent, OpenEventDetails, RegistrationStatus,
  WaitlistStatus,
} from './types'
import { validateRegistration } from './validation'
import type { RegistrationInput, RegistrationIssue } from './validation'

/**
 * US15: the only module that talks to Supabase about registrations. Attendees cannot read the
 * events table, so everything goes through the read-only functions and register_for_event
 * from 0043, which return public fields only.
 */

export const REGISTRATION_SERVICE_MESSAGES = {
  notOpen: 'This event is not open for registration.',
  registrationClosed: 'Registration is not open for this event.',
  duplicate: 'You are already registered for this event.',
  alreadyWaitlisted: 'You are already on the waiting list for this event.',
  full: 'This event is now full. Join the waiting list instead.',
  notAttendee: 'Only attendees can register for events.',
  checkFields: 'Check the highlighted fields.',
  failed: 'Your registration could not be saved. Please try again.',
  withdrawFailed: 'Your registration could not be withdrawn. Please try again.',
  withdrawNotFound: 'We could not find that registration.',
  alreadyWithdrawn: 'This registration has already been withdrawn.',
  cannotWithdraw: 'This event has started or is no longer open, so the registration cannot be withdrawn.',
  loadFailed: 'Events could not be loaded. Please try again.',
} as const

export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: string; issues?: RegistrationIssue[] }

/**
 * `stale` means the registration is no longer in the state the page assumed (already withdrawn,
 * event started or closed, not found), so the page should reload rather than offer a retry.
 */
export type WithdrawResult =
  | { ok: true }
  | { ok: false; reason: string; stale: boolean }

interface OpenEventRow {
  id: string
  name: string
  event_type: string | null
  proposed_start: string
  proposed_end: string | null
  venue: string | null
  registered: boolean
}

interface OpenEventDetailsRow extends OpenEventRow {
  description: string | null
  programme: string | null
  prerequisites: string | null
  full: boolean
  waitlist_entry_id: string | null
  waitlist_status: WaitlistStatus | null
  waitlist_position: number | null
  offer_expires_at: string | null
}

interface MyRegistrationRow {
  registration_id: string
  event_id: string
  event_name: string
  proposed_start: string
  proposed_end: string | null
  venue: string | null
  event_status: AttendeeEventStatus
  registration_status: RegistrationStatus
}

const toOpenEvent = (row: OpenEventRow): OpenEvent => ({
  id: row.id,
  name: row.name,
  eventType: row.event_type,
  start: row.proposed_start,
  end: row.proposed_end,
  venue: row.venue,
  registered: row.registered,
})

export async function loadOpenEvents(): Promise<LoadResult<OpenEvent[]>> {
  const { data, error } = await supabase.rpc('list_open_events')
  if (error) return { ok: false, reason: REGISTRATION_SERVICE_MESSAGES.loadFailed }
  return { ok: true, value: ((data ?? []) as OpenEventRow[]).map(toOpenEvent) }
}

export async function loadOpenEvent(eventId: string): Promise<LoadResult<OpenEventDetails>> {
  const { data, error } = await supabase.rpc('get_open_event', { p_event_id: eventId })
  if (error) return { ok: false, reason: REGISTRATION_SERVICE_MESSAGES.loadFailed }

  // No row means the event is closed, not confirmed, already started or does not exist; the
  // database deliberately does not say which, so nothing internal leaks.
  const row = ((data ?? []) as OpenEventDetailsRow[])[0]
  if (!row) return { ok: false, reason: REGISTRATION_SERVICE_MESSAGES.notOpen }

  return {
    ok: true,
    value: {
      ...toOpenEvent(row),
      description: row.description,
      programme: row.programme,
      prerequisites: row.prerequisites,
      full: row.full,
      waitlist: row.waitlist_entry_id && row.waitlist_status
        ? {
            entryId: row.waitlist_entry_id,
            status: row.waitlist_status,
            position: row.waitlist_position,
            offerExpiresAt: row.offer_expires_at,
          }
        : null,
    },
  }
}

// Error codes raised by register_for_event (0043), each turned into a sentence an Attendee
// can act on. 22023 carries the database's own message, which matches the form's wording.
const REGISTER_ERRORS: Record<string, string> = {
  '23505': REGISTRATION_SERVICE_MESSAGES.duplicate,
  '22000': REGISTRATION_SERVICE_MESSAGES.registrationClosed,
  '42501': REGISTRATION_SERVICE_MESSAGES.notAttendee,
  // 0058: someone took the last place, or a queue formed, after this page loaded.
  '53000': REGISTRATION_SERVICE_MESSAGES.full,
}

export async function registerForEvent(
  eventId: string,
  input: RegistrationInput,
  options: { hasPrerequisites: boolean },
): Promise<RegisterResult> {
  const validation = validateRegistration(input, options)
  if (!validation.ok) {
    return { ok: false, reason: REGISTRATION_SERVICE_MESSAGES.checkFields, issues: validation.issues }
  }

  const { answers } = validation
  // Only the answers: the attendee is the signed-in user and the status is the database's.
  const { error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_phone: answers.phone,
    p_dietary_requirements: answers.dietaryRequirements,
    p_accessibility_needs: answers.accessibilityNeeds,
    p_prerequisites_confirmed: answers.prerequisitesConfirmed,
  })

  if (!error) return { ok: true }
  const reason = (error.code === '23505' && error.hint === 'already_waitlisted'
    ? REGISTRATION_SERVICE_MESSAGES.alreadyWaitlisted
    : undefined)
    ?? REGISTER_ERRORS[error.code ?? '']
    ?? (error.code === '22023' && error.message ? error.message : REGISTRATION_SERVICE_MESSAGES.failed)
  return { ok: false, reason }
}

export async function loadMyRegistrations(): Promise<LoadResult<MyRegistration[]>> {
  const { data, error } = await supabase.rpc('list_my_registrations')
  if (error) return { ok: false, reason: REGISTRATION_SERVICE_MESSAGES.loadFailed }

  return {
    ok: true,
    value: ((data ?? []) as MyRegistrationRow[]).map((row) => ({
      registrationId: row.registration_id,
      eventId: row.event_id,
      eventName: row.event_name,
      start: row.proposed_start,
      end: row.proposed_end,
      venue: row.venue,
      eventStatus: row.event_status,
      eventStatusLabel: EVENT_STATUS_LABELS[row.event_status] ?? row.event_status,
      registrationStatus: row.registration_status,
      registrationStatusLabel: REGISTRATION_STATUS_LABELS[row.registration_status] ?? row.registration_status,
    })),
  }
}

// Error codes raised by withdraw_registration (0050). 42501 reuses the registration wording.
const WITHDRAW_ERRORS: Record<string, { reason: string; stale: boolean }> = {
  'P0002': { reason: REGISTRATION_SERVICE_MESSAGES.withdrawNotFound, stale: true },
  '55000': { reason: REGISTRATION_SERVICE_MESSAGES.alreadyWithdrawn, stale: true },
  '22000': { reason: REGISTRATION_SERVICE_MESSAGES.cannotWithdraw, stale: true },
  '42501': { reason: REGISTRATION_SERVICE_MESSAGES.notAttendee, stale: false },
}

export async function withdrawRegistration(registrationId: string): Promise<WithdrawResult> {
  // Only the id: the Attendee is the signed-in user, so nobody else's registration can be named.
  const { error } = await supabase.rpc('withdraw_registration', { p_registration_id: registrationId })
  if (!error) return { ok: true }

  return {
    ok: false,
    ...(WITHDRAW_ERRORS[error.code ?? ''] ?? { reason: REGISTRATION_SERVICE_MESSAGES.withdrawFailed, stale: false }),
  }
}
