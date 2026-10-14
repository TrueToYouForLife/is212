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

/**
 * An event the signed-in coordinator is assigned to, for the "search for this event"
 * shortcut.
 *
 * The requirement fields are catalogue codes (0052), drawn from the same lists as the
 * venue filters below, so choosing an event can set those filters directly. They used to
 * be free text, which is why this type's previous comment said they could not be matched
 * against a venue automatically — that was the limitation this change removes.
 *
 * equipmentRequirements is carried for display only: portable equipment is reserved
 * through US13/US14 and is not a property of a venue, so it is not a search filter.
 */
export interface AssignedEventOption {
  id: string
  reference: string | null
  name: string | null
  proposedStart: string | null
  proposedEnd: string | null
  expectedAttendance: number | null
  layoutPreference: string | null
  accessibilityRequirements: string[]
  facilityRequirements: string[]
  equipmentRequirements: string[]
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