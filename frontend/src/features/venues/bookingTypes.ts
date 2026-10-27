import type { SlotCode, ClaimCell } from './slots'

/** venue_bookings.status. 'held' is a tentative hold; 'pending_approval' is a submitted
 *  booking request awaiting Venue Staff. Both keep their slots claimed. */
export type VenueBookingStatus =
  | 'held' | 'pending_approval' | 'confirmed' | 'rejected' | 'cancelled' | 'expired'

/** venue_slot_claims.kind. 'event' is the booking itself; 'buffer' is its setup or
 *  turnaround slot; 'maintenance' is a Venue Staff block. */
export type ClaimKindRow = 'event' | 'buffer' | 'maintenance'

export interface VenueBookingSummary {
  spaceLayout?: string
  spaceAttendance?: number
  id: string
  venueId: string
  venueName: string
  eventId: string
  eventReference: string | null
  eventName: string | null
  status: VenueBookingStatus
  holdExpiresAt: string | null
  reviewNote: string | null
  reviewAlternative?: string | null
  createdAt: string
  /** The cells this booking occupies, so a list row can show what was taken. */
  cells: ClaimCell[]
}

/** A cell a hold could not take, and what already holds it. */
export interface BookingConflict {
  date: string
  slot: SlotCode
  kind: ClaimKindRow
}

export type HoldVenueResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: string; conflicts: BookingConflict[] }

export type VenueBookingActionResult =
  | { ok: true }
  | { ok: false; reason: string }

export type VenueBookingListResult =
  | { ok: true; bookings: VenueBookingSummary[] }
  | { ok: false; reason: string }

/** One cell of a venue's availability calendar. 'free' means no claim exists. */
export type TimetableState = 'free' | 'held' | 'pending_approval' | 'confirmed' | 'maintenance'

export interface TimetableCell {
  date: string
  slot: SlotCode
  state: TimetableState
  /** null when free; otherwise whether this cell is the booking itself or its buffer. */
  role: 'event' | 'buffer' | null
  bookingId: string | null
  eventReference: string | null
  /** Set only on a maintenance cell. */
  closureReason: string | null
}

export interface VenueTimetable {
  fromDate: string
  days: TimetableCell[][]
}

export type VenueTimetableResult =
  | { ok: true; timetable: VenueTimetable }
  | { ok: false; reason: string }
