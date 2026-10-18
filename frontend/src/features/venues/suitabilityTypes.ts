import type { VenueStatus } from './types'
import type { SlotCode } from './slots'

/** The coordinator's structured reading of the organiser's free-text venue needs. */
export interface VenueRequirements {
  layout: string | null
  accessibility: string[]
  facilities: string[]
}

export interface VenueLayoutCapacity {
  layout: string
  capacity: number
}

export interface VenueProfile {
  id: string
  name: string
  location: string
  status: VenueStatus
  layouts: VenueLayoutCapacity[]
  accessibility: string[]
  facility: Record<string, unknown>
}

export type SuitabilityReasonCode =
  | 'capacity' | 'layout' | 'accessibility' | 'facility' // the venue does not fit (AC-018.3)
  | 'venue_status' | 'booked' | 'blocked' | 'timing'     // the venue cannot be had (AC-018.4)

export interface SuitabilityReason {
  code: SuitabilityReasonCode
  message: string
}

/** unavailable wins over unsuitable: a venue that cannot be booked at all is blacked out
 *  (AC-018.4) even if it would also be too small, but both kinds of reason are kept. */
export type SuitabilityVerdict = 'suitable' | 'unsuitable' | 'unavailable'

export interface VenueAssessment {
  venue: VenueProfile
  verdict: SuitabilityVerdict
  reasons: SuitabilityReason[]
  /** Layouts that can hold the expected attendance, so the coordinator sees the options. */
  fittingLayouts: VenueLayoutCapacity[]
}

/** A cell this event's booking (event + setup/turnaround) would need, already held by something else. */
export interface OccupiedCell {
  date: string
  slot: SlotCode
  kind: 'event' | 'buffer' | 'maintenance'
}

/** Whether the event's times could be turned into slots. Without slots there is nothing to
 *  check availability against, which is reported rather than silently treated as free. */
export type TimingState = 'ok' | 'missing' | 'outside_slots'


export interface LayoutType {
  code: string
  label: string
}

/** The event fields suitability reads. Attendance stays on the event (#119). */
export interface SuitabilityEvent {
  id: string
  reference: string | null
  name: string | null
  proposedStart: string | null
  proposedEnd: string | null
  expectedAttendance: number | null
  layoutPreference: string | null
  accessibilityRequirements: string[] 
  facilityRequirements: string[]
}

export type SuitabilityResult<T> = { ok: true; value: T } | { ok: false; reason: string }