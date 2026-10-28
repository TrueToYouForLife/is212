import type { SlotCode } from './slots'

/** What Venue Staff enter in the block form (AC-012.2, AC-012.3). */
export interface VenueBlockInput {
  venueId: string
  /** 'YYYY-MM-DD', a Singapore calendar day. */
  startsOn: string
  endsOn: string
  slots: SlotCode[]
  /** Present together for one continuous Singapore start/end interval. */
  startTime?: string
  endTime?: string
  reason: string
}

export type VenueBlockField = 'startsOn' | 'endsOn' | 'slots' | 'reason' | 'startTime' | 'endTime'

export type VenueBlockValidation =
  | { ok: true; value: VenueBlockInput }
  | { ok: false; errors: Partial<Record<VenueBlockField, string>> }

/** One booking cell a block would overlap: the event itself, or its setup/turnaround. */
export interface PreviewCell {
  date: string
  slot: SlotCode
  kind: 'event' | 'buffer'
}

/** One booking a block would overlap, with only its cells inside the block (AC-012.7). */
export interface AffectedBooking {
  bookingId: string
  status: string
  eventReference: string | null
  eventName: string | null
  cells: PreviewCell[]
}

/** One cell of an existing block that a new block would overlap. */
export interface ExistingBlockOverlap {
  date: string
  slot: SlotCode
  reason: string
}

/** AC-012.7: what saving a block would touch. */
export interface VenueBlockPreview {
  affectedBookings: AffectedBooking[]
  existingBlocks: ExistingBlockOverlap[]
}

/** An active block as Venue Staff see it (AC-012.9, AC-012.10). */
export interface VenueBlock {
  id: string
  venueId: string
  startsOn: string
  endsOn: string
  slots: SlotCode[]
  startsAt?: string | null
  endsAt?: string | null
  reason: string
  createdByName: string | null
  createdAt: string
}

/** A venue Venue Staff can choose to block: any that isn't retired. */
export interface BlockableVenue {
  id: string
  name: string
  location: string
}

/** AC-012.8: a coordinator's booking that a venue block has put up for review. */
export interface FlaggedBooking {
  id: string
  bookingId: string
  eventId: string
  eventReference: string | null
  eventName: string | null
  venueName: string
  detail: string
  cells: PreviewCell[]
  createdAt: string
}
