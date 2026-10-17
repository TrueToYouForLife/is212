import { z } from 'zod'
import { supabase } from '../../lib/supabase'

type Result = { ok: true } | { ok: false; reason: string }

/** The only caller of set_event_registration (US52). The database derives the caller from
 *  the session and checks they are the assigned coordinator and the event is Confirmed. */
export async function setEventRegistration(eventId: string, enabled: boolean): Promise<Result> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, reason: 'Choose a valid event before changing registration.' }
  }
  try {
    const { error } = await supabase.rpc('set_event_registration', {
      p_event_id: eventId, p_enabled: enabled,
    })
    if (error) return { ok: false, reason: error.code === '42501'
      ? 'Only the coordinator assigned to this event can change registration.'
      : error.code === '22000'
        ? 'Registration can only be changed while the event is Confirmed. Refresh to see its current status.'
        : 'Registration could not be changed. Please try again.' }
    return { ok: true }
  } catch {
    // A lost response does not prove the write failed, so never retry automatically.
    return { ok: false, reason: 'The change could not be confirmed. Refresh to check before trying again.' }
  }
}
