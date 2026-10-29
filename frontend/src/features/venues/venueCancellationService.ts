import { z } from 'zod'
import { supabase } from '../../lib/supabase'
const contextSchema = z.object({ status: z.string(), version: z.string(), audit: z.object({
  reason: z.string(), actor_name: z.string(), cancelled_at: z.string(), previous_status: z.string(),
}).nullable() })
export type CancellationContext = z.infer<typeof contextSchema>
export async function getVenueCancellation(bookingId: string): Promise<CancellationContext | null> {
  try {
    const { data, error } = await supabase.rpc('get_venue_cancellation', { p_booking_id: bookingId })
    const parsed = contextSchema.safeParse(data)
    return !error && parsed.success ? parsed.data : null
  } catch { return null }
}
export async function cancelVenueBooking(bookingId: string, reason: string, version: string) {
  if (!reason.trim()) return { ok: false, reason: 'Enter a cancellation reason.' }
  try {
    const { data, error } = await supabase.rpc('cancel_individual_venue_booking', {
      p_booking_id: bookingId, p_reason: reason.trim(), p_expected_version: version,
    })
    return !error && data === bookingId ? { ok: true, reason: '' }
      : { ok: false, reason: 'Cancellation was not confirmed. Reload the booking before trying again.' }
  } catch { return { ok: false, reason: 'Cancellation was not confirmed. Reload the booking before trying again.' } }
}
