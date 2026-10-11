import { supabase } from '../../lib/supabase'

export interface PendingVenueBooking {
  id: string
  venueName: string
  createdAt: string
}
export type VenueBookingQueueResult =
  | { ok: true; bookings: PendingVenueBooking[] }
  | { ok: false; reason: string }

/** Existing booking RLS remains in force; the queue filters pending rows on the server. */
export async function listPendingVenueBookings(): Promise<VenueBookingQueueResult> {
  const failed = { ok: false as const, reason: 'Booking requests could not be loaded. Please reload.' }
  try {
    const { data, error } = await supabase.from('venue_bookings')
      .select('id, created_at, venues(name)')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true }).order('id', { ascending: true })
    if (error) return failed
    const rows = (data ?? []) as unknown as {
      id: string; created_at: string; venues: { name: string } | null
    }[]
    return { ok: true, bookings: rows.map((row) => ({
      id: row.id, venueName: row.venues?.name ?? 'Venue unavailable', createdAt: row.created_at,
    })) }
  } catch { return failed }
}
