import type { ClaimCell } from './slots'

export interface VenueReviewConflict extends ClaimCell {
  source: 'confirmed_booking' | 'blocked_period'
  description: string
}

export interface VenueBookingRequestDetails {
  eventName: string | null
  reference: string | null
  startsAt: string | null
  endsAt: string | null
  attendance: number | null
  /**
   * The organiser's own requirements, as catalogue codes. Before 0054 these were free
   * text and accessibility arrived as a single note, which is why the field used to be
   * called accessibilityNotes; 0056 renames the keys this type mirrors.
   */
  layoutPreference: string | null
  accessibilityRequirements: string[]
  facilityRequirements: string[]
  specialArrangements: string | null
  /** The coordinator's structured overlay (US18), unchanged by that migration. */
  requirementsRecorded: boolean
  layout: string | null
  accessibility: string[]
  facilities: string[]
}
