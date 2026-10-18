import { z } from 'zod'
import { supabase } from '../../lib/supabase'

// PostgreSQL permits 24:00:00 for the end of a slot. Keep dates and local times
// separate: interpreting them as browser-local timestamps would shift bookings.
const slotTime = z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?|24:00:00)$/)
const slotSchema = z.object({
  date: z.string().date(),
  slot: z.string().min(1),
  startsAt: slotTime,
  endsAt: slotTime,
  kind: z.enum(['event', 'buffer']),
}).strict()
const arrangementSchema = z.object({
  booking_id: z.string().uuid(),
  venue_name: z.string().min(1),
  slots: z.array(slotSchema),
}).strict()

export type OrganiserVenueArrangement = z.infer<typeof arrangementSchema>
export const VENUE_ARRANGEMENTS_ERROR = 'Venue arrangements could not be loaded. Please try again.'

/** The RPC checks organiser ownership and returns only organiser-visible fields. */
export async function loadOrganiserVenueArrangements(eventId: string): Promise<
  { ok: true; value: OrganiserVenueArrangement[] } | { ok: false; reason: string }
> {
  const failure = { ok: false as const, reason: VENUE_ARRANGEMENTS_ERROR }
  if (!z.string().uuid().safeParse(eventId).success) return failure
  try {
    const { data, error } = await supabase.rpc('get_organiser_venue_arrangements', {
      p_event_id: eventId,
    })
    if (error) return failure
    const parsed = z.array(arrangementSchema).safeParse(data)
    return parsed.success ? { ok: true, value: parsed.data } : failure
  } catch {
    return failure
  }
}
