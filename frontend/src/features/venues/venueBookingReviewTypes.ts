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
  layoutPreference: string | null
  accessibilityNotes: string | null
  specialArrangements: string | null
  requirementsRecorded: boolean
  layout: string | null
  accessibility: string[]
  facilities: string[]
}
