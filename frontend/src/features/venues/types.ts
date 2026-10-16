import type { SlotCode } from './slots'

export type VenueStatus = 'active' | 'under_maintenance' | 'retired'

export interface Venue {
  id: string
  name: string
  capacity: number
  layout: string
  accessibility: string[]
  facility: Record<string, unknown>
  status: VenueStatus
  location: string
}

/** An event the signed-in coordinator is assigned to, for the "search for this event"
 *  shortcut. The free-text fields are shown to the coordinator as read-only reference —
 *  they aren't structured, so they can't be matched against a venue automatically. */
export interface AssignedEventOption {
  id: string
  reference: string | null
  name: string | null
  proposedStart: string | null
  proposedEnd: string | null
  expectedAttendance: number | null
  layoutPreference: string | null
  accessibilityRequirements: string | null
  equipmentRequirements: string | null
}

export interface VenueSearchFilters {
  keyword: string
  location: string
  minAttendance: string
  layout: string
  accessibility: string[]
  facilities: string[]
  date: string          // 'YYYY-MM-DD'; ignored once eventId is set
  slot: SlotCode | ''
  eventId: string        // '' means manual date/slot search instead of an event
}