import { supabase } from '../../lib/supabase'
import type { VenueBufferDurations } from './venueOccupiedSlots'
import { datesFrom } from './slots'
import type { TimeSlot } from './slots'
import { buildTimetable } from './venueTimetable'
import type { TimetableClaimRow } from './venueTimetable'
import type { Venue, VenueStatus } from './types'
import type { VenueTimetableResult } from './bookingTypes'

export const VENUE_TIMETABLE_MESSAGES = {
  notSignedIn: 'You must be signed in to view venue availability.',
  venueNotFound: 'That venue could not be found.',
  // Failing closed: an empty calendar would read as "everything is free".
  loadFailed: 'Venue availability could not be loaded. Please try again.',
} as const

export type VenueWithBuffers = Venue & VenueBufferDurations

export type VenueDetailsResult =
  | { ok: true; venue: VenueWithBuffers }
  | { ok: false; reason: string }

interface VenueRow {
  id: string
  name: string
  setup_minutes: number
  turnaround_minutes: number
  capacity: number
  layout: string
  accessibility: string[] | null
  facility: Record<string, unknown> | null
  status: VenueStatus
  location: string | null
}

function toVenue(row: VenueRow): VenueWithBuffers {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    setupMinutes: row.setup_minutes,
    turnaroundMinutes: row.turnaround_minutes,
    layout: row.layout,
    accessibility: row.accessibility ?? [],
    facility: row.facility ?? {},
    status: row.status,
    location: row.location ?? '',
  }
}

export async function getVenue(venueId: string): Promise<VenueDetailsResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_TIMETABLE_MESSAGES.notSignedIn }
  }
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, capacity, layout, accessibility, facility, status, location, setup_minutes, turnaround_minutes')
    .eq('id', venueId)
    .maybeSingle()
  if (error) {
    console.error('[venues] getVenue', error)
    return { ok: false, reason: VENUE_TIMETABLE_MESSAGES.loadFailed }
  }
  if (!data) return { ok: false, reason: VENUE_TIMETABLE_MESSAGES.venueNotFound }
  return { ok: true, venue: toVenue(data as VenueRow) }
}

interface ClaimJoinRow {
  slot_date: string
  slot: TimetableClaimRow['slot']
  kind: TimetableClaimRow['kind']
  booking_id: string | null
  venue_bookings: { status: TimetableClaimRow['booking_status']; events: { reference: string | null } | null } | null
  venue_closures: { reason: string } | null
}

/**
 * One venue's calendar for a run of days. Reads venue_slot_claims, which already carries
 * every kind of occupancy: a hold, a submitted request, a confirmed booking and a Venue
 * Staff block all claim their cells there, so one query covers all three tables.
 */
export async function getVenueTimetable(
  venueId: string,
  slots: TimeSlot[],
  fromDate: string,
  days = 7,
): Promise<VenueTimetableResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_TIMETABLE_MESSAGES.notSignedIn }
  }

  const dates = datesFrom(fromDate, days)
  const { data, error } = await supabase
    .from('venue_effective_slot_claims')
    .select(`
      slot_date, slot, kind, booking_id,
      venue_bookings,
      venue_closures
    `)
    .eq('venue_id', venueId)
    .gte('slot_date', dates[0])
    .lte('slot_date', dates[dates.length - 1])

  if (error) {
    console.error('[venues] getVenueTimetable', error)
    return { ok: false, reason: VENUE_TIMETABLE_MESSAGES.loadFailed }
  }

  const claims: TimetableClaimRow[] = ((data ?? []) as unknown as ClaimJoinRow[]).map((row) => ({
    slot_date: row.slot_date,
    slot: row.slot,
    kind: row.kind,
    booking_id: row.booking_id,
    booking_status: row.venue_bookings?.status ?? null,
    event_reference: row.venue_bookings?.events?.reference ?? null,
    closure_reason: row.venue_closures?.reason ?? null,
  }))

  return { ok: true, timetable: buildTimetable(slots, claims, fromDate, days) }
}
