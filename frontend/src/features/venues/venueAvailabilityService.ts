import { supabase } from '../../lib/supabase'
import { datesFrom } from './slots'
import type { TimeSlot } from './slots'
import { buildVenueAvailability } from './venueAvailability'
import type { AvailabilityClaimRow, AvailabilityVenue, VenueAvailability } from './venueAvailability'
import type { VenueStatus } from './types'

export const VENUE_AVAILABILITY_MESSAGES = {
  notSignedIn: 'You must be signed in to view venue availability.',
  // Failing closed: an empty calendar would read as "every venue is free".
  loadFailed: 'Venue availability could not be loaded. Please try again.',
} as const

export type VenueAvailabilityResult =
  | { ok: true; availability: VenueAvailability }
  | { ok: false; reason: string }

interface VenueRow {
  id: string
  name: string
  location: string | null
  status: VenueStatus
}

interface ClaimJoinRow {
  venue_id: string
  slot_date: string
  slot: AvailabilityClaimRow['slot']
  kind: AvailabilityClaimRow['kind']
  booking_id: string | null
  venue_bookings: { status: AvailabilityClaimRow['booking_status']; events: { reference: string | null } | null } | null
  venue_closures: { reason: string } | null
}

/**
 * AC-019.1: every venue's week in two reads, venues and their claims, run side by side.
 * venue_effective_slot_claims includes saved and newly required occupancy (hold, request, confirmed
 * booking, Venue Staff block), so one query covers all venues. RLS lets Coordinators and
 * Venue Staff read the underlying claims; the view preserves that RLS, and the page does not offer other roles
 * the calendar.
 */
export async function getVenueAvailability(
  slots: TimeSlot[],
  fromDate: string,
  days = 7,
): Promise<VenueAvailabilityResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_AVAILABILITY_MESSAGES.notSignedIn }
  }
  // loadTimeSlots() returns [] when it fails; a grid with no slots would show nothing booked.
  if (slots.length === 0) return { ok: false, reason: VENUE_AVAILABILITY_MESSAGES.loadFailed }

  const dates = datesFrom(fromDate, days)
  const [venuesResult, claimsResult] = await Promise.all([
    supabase
      .from('venues')
      .select('id, name, location, status')
      .neq('status', 'retired')
      .order('name'),
    supabase
      .from('venue_effective_slot_claims')
      .select(`
        venue_id, slot_date, slot, kind, booking_id,
        venue_bookings,
        venue_closures
      `)
      .gte('slot_date', dates[0])
      .lte('slot_date', dates[dates.length - 1]),
  ])

  if (venuesResult.error || claimsResult.error) {
    console.error('[venues] getVenueAvailability', venuesResult.error ?? claimsResult.error)
    return { ok: false, reason: VENUE_AVAILABILITY_MESSAGES.loadFailed }
  }

  const venues: AvailabilityVenue[] = ((venuesResult.data ?? []) as VenueRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    location: row.location ?? '',
    status: row.status,
  }))
  const claims: AvailabilityClaimRow[] = ((claimsResult.data ?? []) as unknown as ClaimJoinRow[]).map((row) => ({
    venue_id: row.venue_id,
    slot_date: row.slot_date,
    slot: row.slot,
    kind: row.kind,
    booking_id: row.booking_id,
    booking_status: row.venue_bookings?.status ?? null,
    event_reference: row.venue_bookings?.events?.reference ?? null,
    closure_reason: row.venue_closures?.reason ?? null,
  }))

  return { ok: true, availability: buildVenueAvailability(venues, slots, claims, fromDate, days) }
}
