/**
 * PURE MODULE — US19. Turns every venue's claim rows into one calendar row per venue.
 * No React, no Supabase.
 *
 * Each venue's week is built by buildTimetable (US10), so a cell here reads exactly as it
 * does on the single-venue timetable: same states, same rule for dropping dead claims.
 */
import { buildTimetable } from './venueTimetable'
import type { TimetableClaimRow } from './venueTimetable'
import { datesFrom } from './slots'
import type { TimeSlot } from './slots'
import type { VenueStatus } from './types'
import type { VenueTimetable } from './bookingTypes'

export interface AvailabilityVenue {
  id: string
  name: string
  location: string
  status: VenueStatus
}

/** A venue_slot_claims row for any venue, so one query can cover every venue at once. */
export interface AvailabilityClaimRow extends TimetableClaimRow {
  venue_id: string
}

export interface VenueAvailabilityRow {
  venue: AvailabilityVenue
  timetable: VenueTimetable
}

export interface VenueAvailability {
  fromDate: string
  dates: string[]
  rows: VenueAvailabilityRow[]
}

/**
 * AC-019.2: every venue's bookings and blocks, each kept to its own venue's row. A claim for
 * a venue that is not listed (a retired venue) is dropped rather than drawn anywhere.
 * Venues are listed by name so a venue is always in the same place week to week.
 */
export function buildVenueAvailability(
  venues: AvailabilityVenue[],
  slots: TimeSlot[],
  claims: AvailabilityClaimRow[],
  fromDate: string,
  days: number,
): VenueAvailability {
  const claimsByVenue = new Map<string, AvailabilityClaimRow[]>()
  for (const claim of claims) {
    const forVenue = claimsByVenue.get(claim.venue_id) ?? []
    forVenue.push(claim)
    claimsByVenue.set(claim.venue_id, forVenue)
  }

  const ordered = [...venues].sort((a, b) => a.name.localeCompare(b.name))
  return {
    fromDate,
    dates: datesFrom(fromDate, days),
    rows: ordered.map((venue) => ({
      venue,
      timetable: buildTimetable(slots, claimsByVenue.get(venue.id) ?? [], fromDate, days),
    })),
  }
}
