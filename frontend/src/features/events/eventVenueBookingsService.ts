import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const bookingSchema = z.object({
  booking_id: z.string().uuid(), venue_name: z.string(),
  status: z.enum(['held', 'pending_approval', 'confirmed', 'rejected', 'cancelled', 'expired']),
  space_layout: z.string().nullable(), space_attendance: z.number().int().positive().nullable(),
  review_note: z.string().nullable(), review_alternative: z.string().nullable(), created_at: z.string(),
})
export type EventVenueBooking = z.infer<typeof bookingSchema>
export const EVENT_VENUES_ERROR = 'Venue bookings could not be loaded. Please try again.'
export async function loadEventVenueBookings(eventId: string): Promise<
  { ok: true; value: EventVenueBooking[] } | { ok: false; reason: string }
> {
  try {
    const { data, error } = await supabase.rpc('get_event_venue_bookings', { p_event_id: eventId })
    if (error) return { ok: false, reason: EVENT_VENUES_ERROR }
    const parsed = z.array(bookingSchema).safeParse(data)
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: EVENT_VENUES_ERROR }
  } catch { return { ok: false, reason: EVENT_VENUES_ERROR } }
}
