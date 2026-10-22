import { z } from 'zod'
import { supabase } from '../../lib/supabase'

/**
 * US54: who has registered for an event, for the Organiser running it, the Coordinator
 * assigned to it and the Organiser's colleagues.
 *
 * Lives in the events feature rather than alongside registrationService: that module is
 * the Attendee's view of their own registrations, and this is the event owner's roll call.
 * Keeping them apart stops one service growing two audiences with two sets of rules.
 *
 * Read-only, and there is no write path to add. 0043 grants SELECT on event_registrations
 * and nothing else, so AC-054.4's "but not change it" is already true of everyone.
 */

export const EVENT_REGISTRATIONS_MESSAGES = {
  loadFailed: 'The registrations could not be loaded. Please try again.',
  notPermitted: 'You are not permitted to see the registrations for this event.',
} as const

export type RegistrationStatus = 'registered' | 'withdrawn'

export interface EventRegistration {
  id: string
  attendeeName: string
  attendeeEmail: string
  status: RegistrationStatus
  registeredAt: string
  withdrawnAt: string | null
}

export interface EventRegistrationList {
  registrations: EventRegistration[]
  /** AC-054.2. Derived from the same rows the list shows, so the two cannot disagree. */
  activeCount: number
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; reason: string }

interface EventRegistrationRow {
  id: string
  attendee_name: string
  attendee_email: string
  status: string
  registered_at: string
  withdrawn_at: string | null
}

function toRegistration(row: EventRegistrationRow): EventRegistration {
  return {
    id: row.id,
    attendeeName: row.attendee_name,
    attendeeEmail: row.attendee_email,
    status: row.status as RegistrationStatus,
    registeredAt: row.registered_at,
    withdrawnAt: row.withdrawn_at,
  }
}

/**
 * An empty answer is ambiguous by design: 0094 returns no rows both for an event nobody
 * has registered for and for a caller who may not look, and does not say which, so that a
 * stranger cannot use the difference to learn an event exists.
 *
 * The page still has to choose between "nobody has registered yet" and "this is not yours
 * to see", and getting that wrong either way is bad — one tells an unassigned Coordinator
 * the event is empty when it is not, the other accuses a legitimate Organiser of
 * trespassing. So the ambiguity is resolved with a second call to the predicate, made
 * **only when the list comes back empty**. A populated list already proves access.
 */
export async function loadEventRegistrations(
  eventId: string,
): Promise<LoadResult<EventRegistrationList>> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, reason: EVENT_REGISTRATIONS_MESSAGES.notPermitted }
  }

  const { data, error } = await supabase.rpc('list_event_registrations', {
    p_event_id: eventId,
  })
  if (error) {
    console.error('[events] loadEventRegistrations', error)
    return { ok: false, reason: EVENT_REGISTRATIONS_MESSAGES.loadFailed }
  }

  const rows = (data ?? []) as EventRegistrationRow[]

  if (rows.length === 0) {
    const permitted = await supabase.rpc('can_view_event_registrations', {
      p_event_id: eventId,
    })
    if (permitted.error) {
      console.error('[events] canViewEventRegistrations', permitted.error)
      return { ok: false, reason: EVENT_REGISTRATIONS_MESSAGES.loadFailed }
    }
    if (permitted.data !== true) {
      return { ok: false, reason: EVENT_REGISTRATIONS_MESSAGES.notPermitted }
    }
  }

  const registrations = rows.map(toRegistration)
  return {
    ok: true,
    value: {
      registrations,
      activeCount: registrations.filter((r) => r.status === 'registered').length,
    },
  }
}
