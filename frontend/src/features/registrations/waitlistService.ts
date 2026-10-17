import { supabase } from '../../lib/supabase'
import type { LoadResult, MyWaitlistEntry, WaitlistStatus } from './types'
import { validateRegistration } from './validation'
import type { RegistrationInput, RegistrationIssue } from './validation'

/**
 * US16: the only module that talks to Supabase about waiting lists. The attendee is always the
 * signed-in user and the order, offers and deadlines are the database's (0058): nothing here
 * can name another person, choose a position or extend a deadline.
 */

export const WAITLIST_MESSAGES = {
  notOpen: 'Registration is not open for this event.',
  notFull: 'This event still has places. Register instead.',
  alreadyRegistered: 'You are already registered for this event.',
  alreadyWaitlisted: 'You are already on the waiting list for this event.',
  notAttendee: 'Only attendees can use a waiting list.',
  gone: 'You are no longer on this waiting list.',
  offerUnavailable: 'This offer is no longer available. Reload to see where you stand.',
  checkFields: 'Check the highlighted fields.',
  joinFailed: 'You could not be added to the waiting list. Please try again.',
  leaveFailed: 'You could not be removed from the waiting list. Please try again.',
  acceptFailed: 'Your place could not be confirmed. Please try again.',
  loadFailed: 'Your waiting lists could not be loaded. Please try again.',
} as const

/**
 * `stale` means the entry is no longer in the state the page assumed (offer lapsed, already
 * left, registration closed), so the page should reload rather than offer a retry.
 */
export type WaitlistResult =
  | { ok: true }
  | { ok: false; reason: string; stale: boolean; issues?: RegistrationIssue[] }

interface DbError { code?: string; message?: string; hint?: string }

function joinError(error: DbError): WaitlistResult {
  // 23505, 55000 and 22000 mean the page's picture is out of date, so it reloads.
  if (error.code === '23505') {
    return { ok: false, stale: true, reason: error.hint === 'already_registered'
      ? WAITLIST_MESSAGES.alreadyRegistered : WAITLIST_MESSAGES.alreadyWaitlisted }
  }
  if (error.code === '55000') return { ok: false, stale: true, reason: WAITLIST_MESSAGES.notFull }
  if (error.code === '22000') return { ok: false, stale: true, reason: WAITLIST_MESSAGES.notOpen }
  if (error.code === '42501') return { ok: false, stale: false, reason: WAITLIST_MESSAGES.notAttendee }
  return { ok: false, stale: false, reason: WAITLIST_MESSAGES.joinFailed }
}

export async function joinWaitlist(eventId: string): Promise<WaitlistResult> {
  const { error } = await supabase.rpc('join_waitlist', { p_event_id: eventId })
  return error ? joinError(error) : { ok: true }
}

export async function leaveWaitlist(entryId: string): Promise<WaitlistResult> {
  const { error } = await supabase.rpc('leave_waitlist', { p_entry_id: entryId })
  if (!error) return { ok: true }
  // P0002 and 55000: already gone or already resolved, so reload rather than retry.
  if (error.code === 'P0002' || error.code === '55000') {
    return { ok: false, stale: true, reason: WAITLIST_MESSAGES.gone }
  }
  return {
    ok: false, stale: false,
    reason: error.code === '42501' ? WAITLIST_MESSAGES.notAttendee : WAITLIST_MESSAGES.leaveFailed,
  }
}

export async function acceptWaitlistOffer(
  entryId: string,
  input: RegistrationInput,
  options: { hasPrerequisites: boolean },
): Promise<WaitlistResult> {
  const validation = validateRegistration(input, options)
  if (!validation.ok) {
    return { ok: false, stale: false, reason: WAITLIST_MESSAGES.checkFields, issues: validation.issues }
  }
  const { answers } = validation
  const { data, error } = await supabase.rpc('accept_waitlist_offer', {
    p_entry_id: entryId,
    p_phone: answers.phone,
    p_dietary_requirements: answers.dietaryRequirements,
    p_accessibility_needs: answers.accessibilityNeeds,
    p_prerequisites_confirmed: answers.prerequisitesConfirmed,
  })
  if (!error && data) return { ok: true }
  // No registration id and no error: the offer lapsed. The database answers null rather than
  // raising so that recording the expiry (and offering the next person) is not rolled back (0059).
  if (!error) return { ok: false, stale: true, reason: WAITLIST_MESSAGES.offerUnavailable }
  if (error.code === '22023' && error.message) return { ok: false, stale: false, reason: error.message }
  // 55000: the offer lapsed or was withdrawn; 22000: registration closed; P0002: not yours.
  if (error.code === '55000' || error.code === 'P0002') {
    return { ok: false, stale: true, reason: WAITLIST_MESSAGES.offerUnavailable }
  }
  if (error.code === '22000') return { ok: false, stale: true, reason: WAITLIST_MESSAGES.notOpen }
  return { ok: false, stale: false, reason: WAITLIST_MESSAGES.acceptFailed }
}

interface MyWaitlistRow {
  entry_id: string
  event_id: string
  event_name: string
  proposed_start: string
  venue: string | null
  status: WaitlistStatus
  queue_position: number | null
  offer_expires_at: string | null
}

export async function loadMyWaitlist(): Promise<LoadResult<MyWaitlistEntry[]>> {
  const { data, error } = await supabase.rpc('list_my_waitlist')
  if (error) return { ok: false, reason: WAITLIST_MESSAGES.loadFailed }
  return {
    ok: true,
    value: ((data ?? []) as MyWaitlistRow[]).map((row) => ({
      entryId: row.entry_id,
      eventId: row.event_id,
      eventName: row.event_name,
      start: row.proposed_start,
      venue: row.venue,
      status: row.status,
      position: row.queue_position,
      offerExpiresAt: row.offer_expires_at,
    })),
  }
}
