import { supabase } from '../../lib/supabase'
import { claimsForEvent, slotWindow } from './slots'
import type { TimeSlot, SlotCode } from './slots'
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

/** The cells (event + trailing buffer) a booking would need for these filters, or null if
 *  the filters don't ask for an availability check at all. */
async function requiredCellsForFilters(
  filters: VenueSearchFilters,
  slots: TimeSlot[],
): Promise<{ date: string; slot: SlotCode }[] | null> {
  if (filters.eventId) {
    const { data: event } = await supabase
      .from('events')
      .select('proposed_start, proposed_end')
      .eq('id', filters.eventId)
      .maybeSingle()
    if (!event?.proposed_start || !event?.proposed_end) return null
    return claimsForEvent(new Date(event.proposed_start), new Date(event.proposed_end), slots)
  }
  if (filters.date && filters.slot) {
    const { start, end } = slotWindow(filters.date, filters.slot, slots)
    return claimsForEvent(start, end, slots)
  }
  return null
}

/** Drops any venue that already has a claim — event, buffer or maintenance — on a cell the
 *  requested booking would need. This mirrors the exclusion constraint that actually guards
 *  venue_bookings, so a venue shown here is one the real booking call should accept. */
async function excludeUnavailable(
  venues: Venue[],
  requiredCells: { date: string; slot: SlotCode }[],
): Promise<Venue[]> {
  if (venues.length === 0 || requiredCells.length === 0) return venues

  const dates = requiredCells.map((cell) => cell.date)
  const minDate = dates.reduce((a, b) => (a < b ? a : b))
  const maxDate = dates.reduce((a, b) => (a > b ? a : b))

  const { data, error } = await supabase
    .from('venue_slot_claims')
    .select('venue_id, slot_date, slot')
    .in('venue_id', venues.map((venue) => venue.id))
    .gte('slot_date', minDate)
    .lte('slot_date', maxDate)

  if (error) {
    // A broken availability check shouldn't hide every venue — fail open on this filter only.
    console.error('[venues] excludeUnavailable', error)
    return venues
  }

  const claimed = new Set(
    (data ?? []).map((row: { venue_id: string; slot_date: string; slot: string }) =>
      `${row.venue_id}|${row.slot_date}|${row.slot}`),
  )
  const requiredKeys = requiredCells.map((cell) => `${cell.date}|${cell.slot}`)

  return venues.filter((venue) =>
    requiredKeys.every((key) => !claimed.has(`${venue.id}|${key}`)),
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
    .select('id, name, capacity, layout, accessibility, facility, status, location')
    .eq('status', 'active')

  const keyword = filters.keyword.trim()
  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,location.ilike.%${keyword}%`)
  }

  const location = filters.location.trim()
  if (location) query = query.ilike('location', `%${location}%`)

    if (filters.layout.trim()) query = query.eq('layout', filters.layout.trim())

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

  // Facility values may be counts, not booleans, so "has this facility" means the key is
  // present with a truthy value. Done client-side: matching several jsonb keys at once isn't
  // one simple query-builder call.
  if (filters.facilities.length > 0) {
    venues = venues.filter((venue) =>
      filters.facilities.every((key) => Boolean(venue.facility[key])),
    )
  }
  const requiredCells = await requiredCellsForFilters(filters, slots)
  if (requiredCells) {
    venues = await excludeUnavailable(venues, requiredCells)
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
  accessibility_requirements: string | null
  equipment_requirements: string | null
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
      layout_preference, accessibility_requirements, equipment_requirements
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
    accessibilityRequirements: row.accessibility_requirements,
    equipmentRequirements: row.equipment_requirements,
  }))
}