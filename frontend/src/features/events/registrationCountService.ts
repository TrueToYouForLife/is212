// Adjust this import to match the one in organisationEventService.ts.
import { supabase } from '../../lib/supabase'

/**
 * US54 AC-054.4: the number of active registrations for an event.
 *
 * Goes through event_registration_count rather than counting rows in `registrations`, so
 * a colleague can learn the number without RLS ever letting them read who registered.
 */
export type RegistrationCountResult = { ok: true; count: number } | { ok: false }

export async function loadRegistrationCount(eventId: string): Promise<RegistrationCountResult> {
  const { data, error } = await supabase.rpc('event_registration_count', { p_event_id: eventId })
  if (error) return { ok: false }
  return { ok: true, count: typeof data === 'number' ? data : 0 }
}
