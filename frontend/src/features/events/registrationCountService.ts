import { supabase } from '../../lib/supabase'

/**
 * US54 AC-054.4: the number of active registrations for an event.
 *
 * Goes through event_registration_count (0114) rather than counting rows, so a colleague
 * learns the number without the database ever handing their browser the names. 0114 splits
 * 0094's single predicate in two for exactly this: the count admits colleagues, the roll
 * call does not.
 *
 * A refusal and an empty event both come back as 0, deliberately — 0114 will not let the
 * difference be used to discover that an event exists — so there is no "not permitted" to
 * report here. { ok: false } means the call itself failed.
 */
export type RegistrationCountResult = { ok: true; count: number } | { ok: false }

export async function loadRegistrationCount(eventId: string): Promise<RegistrationCountResult> {
  const { data, error } = await supabase.rpc('event_registration_count', { p_event_id: eventId })
  if (error) return { ok: false }
  return { ok: true, count: typeof data === 'number' ? data : 0 }
}