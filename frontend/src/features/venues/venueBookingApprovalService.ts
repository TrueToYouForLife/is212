import { supabase } from '../../lib/supabase'
import type { VenueBookingActionResult } from './bookingTypes'

export async function approveVenueBooking(bookingId: string, reviewVersion: string): Promise<VenueBookingActionResult> {
  if (!reviewVersion) return { ok: false, reason: 'Reload the booking before approving.' }
  try {
    const { data, error } = await supabase.rpc('approve_venue_booking', {
      p_booking_id: bookingId, p_expected_version: reviewVersion,
    })
    if (error || data !== bookingId) return {
      ok: false, reason: 'Approval could not be confirmed. Reload to check the request, conflicts and your access.',
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'The result could not be confirmed. Reload before trying again.' }
  }
}
