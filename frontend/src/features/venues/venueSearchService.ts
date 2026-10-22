import { supabase } from '../../lib/supabase'
import { matchesAnyText, matchesText, normaliseForMatch, sameCode } from './searchTextMatch'
import { slotWindow } from './slots'
import { occupiedVenueCells } from './venueOccupiedSlots'
import type { TimeSlot } from './slots'
import type { AssignedEventOption, Venue, VenueSearchFilters, VenueStatus } from './types'

export const VENUE_SEARCH_MESSAGES = {
  notSignedIn: 'You must be signed in to search venues.',
  unexpected: 'Something went wrong searching for venues. Please try again.',
} as const

export type VenueSearchResult =
  | { ok: true; venues: Venue[] }
  | { ok: false; reason: string }

interface VenueRow {
  id: string
  name: string
  capacity: number
  layout: string
  accessibility: string[] | null
  facility: Record<string, unknown> | null
  status: VenueStatus
  location: string | null
  setup_minutes: number
  turnaround_minutes: number
}

/** A filter made only of spaces or punctuation is not a filter. */
function normalisedIsSet(value: string): boolean {
  return normaliseForMatch(value) !== ''
}

function toVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    layout: row.layout ?? '',
    accessibility: row.accessibility ?? [],
    facility: row.facility ?? {},
    status: row.status,
    location: row.location ?? '',
  }
}

/** Resolve the requested event interval once; each venue expands it independently. */
async function requestedPeriod(filters: VenueSearchFilters, slots: TimeSlot[]): Promise<{ start: Date; end: Date } | null> {
  if (filters.eventId) {
    const { data: event, error } = await supabase.from('events')
      .select('proposed_start, proposed_end').eq('id', filters.eventId).maybeSingle()
    if (error || !event?.proposed_start || !event?.proposed_end) throw new Error('Event timing unavailable')
    return { start: new Date(event.proposed_start), end: new Date(event.proposed_end) }
  }
  if (filters.date && filters.slot) return slotWindow(filters.date, filters.slot, slots)
  return null
}

/** Drops any venue that already has a claim — event, buffer or maintenance — on a cell the
 *  requested booking would need, including that venue's buffers. This is a preview;
 *  the database still arbitrates changes and races when a booking is saved. */
async function excludeUnavailable(
  venues: Venue[],
  requiredByVenue: Map<string, { date: string; slot: string }[]>,
): Promise<Venue[]> {
  if (venues.length === 0) return venues

  const dates = Array.from(requiredByVenue.values()).flat().map((cell) => cell.date)
  const minDate = dates.reduce((a, b) => (a < b ? a : b))
  const maxDate = dates.reduce((a, b) => (a > b ? a : b))

  const { data, error } = await supabase
    .from('venue_effective_slot_claims')
    .select('venue_id, slot_date, slot')
    .in('venue_id', venues.map((venue) => venue.id))
    .gte('slot_date', minDate)
    .lte('slot_date', maxDate)

  if (error) throw new Error('Venue availability could not be checked')

  const claimed = new Set(
    (data ?? []).map((row: { venue_id: string; slot_date: string; slot: string }) =>
      `${row.venue_id}|${row.slot_date}|${row.slot}`),
  )
  return venues.filter((venue) =>
    (requiredByVenue.get(venue.id) ?? []).every((cell) => !claimed.has(`${venue.id}|${cell.date}|${cell.slot}`)),
  )
}

/**
 * AC-008. Returns every active venue by default; each filter narrows the result. Never
 * throws — a failure comes back as { ok: false, reason }, same as the rest of the codebase.
 */
export async function searchVenues(
  filters: VenueSearchFilters,
  slots: TimeSlot[],
): Promise<VenueSearchResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_SEARCH_MESSAGES.notSignedIn }
  }

  let query = supabase
    .from('venues')
    .select('id, name, capacity, layout, accessibility, facility, status, location, setup_minutes, turnaround_minutes')
    .eq('status', 'active')

  // keyword, location and layout are matched in the browser, not here: see
  // searchTextMatch for why `ilike` cannot ignore punctuation and spacing, and why a
  // venue's stored layout ("Hall", "U-shape") may be written differently from the
  // catalogue code the filter now holds ("hall", "u_shape").
  const minAttendance = filters.minAttendance.trim() === '' ? null : Number(filters.minAttendance)
  if (minAttendance !== null && !Number.isNaN(minAttendance)) {
    query = query.gte('capacity', minAttendance)
  }

  if (filters.accessibility.length > 0) {
    query = query.contains('accessibility', filters.accessibility)
  }

  const { data, error } = await query.order('name')
  if (error) {
    console.error('[venues] searchVenues', error)
    return { ok: false, reason: VENUE_SEARCH_MESSAGES.unexpected }
  }

  let venues = ((data ?? []) as VenueRow[]).map(toVenue)

  // Case, spacing and punctuation are ignored on both sides, so "level 2." finds
  // "Level 2" and a stray double space is not a failed search.
  if (normalisedIsSet(filters.keyword)) {
    venues = venues.filter((venue) => matchesAnyText([venue.name, venue.location], filters.keyword))
  }
  if (normalisedIsSet(filters.location)) {
    venues = venues.filter((venue) => matchesText(venue.location, filters.location))
  }
  if (normalisedIsSet(filters.layout)) {
    venues = venues.filter((venue) => sameCode(venue.layout, filters.layout))
  }

  // Facility values may be counts, not booleans, so "has this facility" means the key is
  // present with a truthy value. Done client-side: matching several jsonb keys at once isn't
  // one simple query-builder call.
  if (filters.facilities.length > 0) {
    venues = venues.filter((venue) =>
      filters.facilities.every((key) => Boolean(venue.facility[key])),
    )
  }
  try {
    const period = await requestedPeriod(filters, slots)
    if (period) {
      const rows = new Map(((data ?? []) as VenueRow[]).map(row => [row.id, row]))
      const required = new Map(venues.map(venue => {
        const row = rows.get(venue.id)!
        return [venue.id, occupiedVenueCells(period.start, period.end, {
          setupMinutes: row.setup_minutes, turnaroundMinutes: row.turnaround_minutes,
        })] as const
      }))
      venues = await excludeUnavailable(venues, required)
    }
  } catch {
    return { ok: false, reason: VENUE_SEARCH_MESSAGES.unexpected }
  }

  return { ok: true, venues }
}

interface AssignedEventRow {
  id: string
  reference: string | null
  name: string | null
  proposed_start: string | null
  proposed_end: string | null
  expected_attendance: number | null
  layout_preference: string | null
  accessibility_requirements: string[] | null
  facility_requirements: string[] | null
  equipment_requirements: string[] | null
}

/** Events the signed-in coordinator is assigned to, for the "search for this event" shortcut. */
export async function listMyAssignedEvents(): Promise<AssignedEventOption[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  const userId = sessionData?.user?.id
  if (sessionError || !userId) return []

  const { data, error } = await supabase
    .from('events')
    .select(`
      id, reference, name, proposed_start, proposed_end, expected_attendance,
      layout_preference, accessibility_requirements, facility_requirements,
      equipment_requirements
    `)
    .eq('coordinator_id', userId)
    .order('proposed_start', { ascending: true })

  if (error) {
    console.error('[venues] listMyAssignedEvents', error)
    return []
  }

  return ((data ?? []) as AssignedEventRow[]).map((row) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    expectedAttendance: row.expected_attendance,
    layoutPreference: row.layout_preference,
    accessibilityRequirements: row.accessibility_requirements ?? [],
    facilityRequirements: row.facility_requirements ?? [],
    equipmentRequirements: row.equipment_requirements ?? [],
  }))
}