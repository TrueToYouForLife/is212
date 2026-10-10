// src/features/venues/venueBookingService.ts
import { supabase } from '../../lib/supabase'
import { claimsForEvent } from './slots'
import type { ClaimCell, SlotCode, TimeSlot } from './slots'
import {
  ACTIVE_HOLD_STATUSES, BOOKABLE_EVENT_STATUSES,  canBookForEventStatus, describeConflicts, holdExpiryFrom,
} from './holdRules'
import type {
  BookingConflict, HoldVenueResult, VenueBookingActionResult, VenueBookingListResult,
  VenueBookingStatus, VenueBookingSummary,
} from './bookingTypes'

const POSTGRES_UNIQUE_VIOLATION = '23505'
const POSTGRES_RLS_VIOLATION = '42501'
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503'

export const VENUE_BOOKING_MESSAGES = {
  notSignedIn: 'You must be signed in to book a venue.',
  eventNotFound: 'That event could not be found.',
  notYourEvent: 'You can only book venues for events assigned to you.',
  eventNotBookable: 'A venue can only be booked for an approved event that is being planned.',
  noEventTimes: 'The event needs a start and end time before a venue can be booked.',
  outsideSlots: 'The event times do not fall within any bookable slot.',
  alreadyHeld: 'This event already has a tentative hold. Release it before holding another venue.',
  unavailable: 'That venue is not available for the requested slots, including its setup and turnaround slots.',
  notSubmittable: 'This hold can no longer be submitted. It may have expired or already been sent for review.',
  notReleasable: 'This hold can no longer be released. It may have already been reviewed or released.',
  loadFailed: 'Your venue booking requests could not be loaded. Please try again.',
  rlsDenied: 'You are not permitted to book venues for this event.',
  unknownVenue: 'That venue could not be found.',
  unexpected: 'Something went wrong booking the venue. Please try again.',
} as const

export type VenueBookingResult = HoldVenueResult

interface TimeSlotRow { code: SlotCode; starts_at: string; ends_at: string; sort_order: number }

export async function loadTimeSlots(): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('code, starts_at, ends_at, sort_order')
    .order('sort_order')
  if (error) {
    console.error('[venues] loadTimeSlots', error)
    return []
  }
  return ((data ?? []) as TimeSlotRow[]).map((row) => ({
    code: row.code, startsAt: row.starts_at, endsAt: row.ends_at, sortOrder: row.sort_order,
  }))
}

/** Holds that ran out still occupy cells until they are released, so free them first. */
async function releaseExpiredHolds(venueId: string): Promise<void> {
  const { data } = await supabase
    .from('venue_bookings')
    .select('id')
    .eq('venue_id', venueId)
    .eq('status', 'held')
    .lt('hold_expires_at', new Date().toISOString())
  const ids = (data ?? []).map((row: { id: string }) => row.id)
  if (ids.length === 0) return
  await supabase.from('venue_slot_claims').delete().in('booking_id', ids)
  await supabase.from('venue_bookings').update({ status: 'expired' }).in('id', ids)
}

function describeError(error: { code?: string; message?: string } | null): string {
  switch (error?.code) {
    case POSTGRES_UNIQUE_VIOLATION: return VENUE_BOOKING_MESSAGES.unavailable
    case POSTGRES_RLS_VIOLATION: return VENUE_BOOKING_MESSAGES.rlsDenied
    case POSTGRES_FOREIGN_KEY_VIOLATION: return VENUE_BOOKING_MESSAGES.unknownVenue
    default:
      console.error('[venues] booking', error)
      return VENUE_BOOKING_MESSAGES.unexpected
  }
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data?.user?.id ?? null
}

interface ConflictRow { slot_date: string; slot: SlotCode; kind: BookingConflict['kind'] }

/** Which of the cells this hold needed are already taken, and by what. Best effort: a
 *  failure here must not replace the refusal itself with a vaguer error. */
async function findConflicts(venueId: string, cells: ClaimCell[]): Promise<BookingConflict[]> {
  if (cells.length === 0) return []
  const dates = cells.map((cell) => cell.date).sort()
  const { data, error } = await supabase
    .from('venue_slot_claims')
    .select('slot_date, slot, kind')
    .eq('venue_id', venueId)
    .gte('slot_date', dates[0])
    .lte('slot_date', dates[dates.length - 1])
  if (error) {
    console.error('[venues] findConflicts', error)
    return []
  }
  const wanted = new Set(cells.map((cell) => `${cell.date}|${cell.slot}`))
  return ((data ?? []) as ConflictRow[])
    .filter((row) => wanted.has(`${row.slot_date}|${row.slot}`))
    .map((row) => ({ date: row.slot_date, slot: row.slot, kind: row.kind }))
}

const refused = (reason: string, conflicts: BookingConflict[] = []): HoldVenueResult =>
  ({ ok: false, reason, conflicts })

interface BookableEventRow {
  proposed_start: string | null
  proposed_end: string | null
  status: string
  coordinator_id: string | null
}

/**
 * Places a tentative hold on a venue for an approved event the coordinator manages. The
 * event's own start and end decide the slots; the caller never states them. The primary key
 * on venue_slot_claims is what refuses a clash, so two coordinators racing cannot both win.
 */
export async function holdVenue(
  eventId: string,
  venueId: string,
  holdDays?: number,
): Promise<HoldVenueResult> {
  const userId = await currentUserId()
  if (!userId) return refused(VENUE_BOOKING_MESSAGES.notSignedIn)

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('proposed_start, proposed_end, status, coordinator_id')
    .eq('id', eventId)
    .maybeSingle()
  if (eventError || !event) return refused(VENUE_BOOKING_MESSAGES.eventNotFound)

  const row = event as BookableEventRow
  if (row.coordinator_id !== userId) return refused(VENUE_BOOKING_MESSAGES.notYourEvent)
  if (!canBookForEventStatus(row.status)) return refused(VENUE_BOOKING_MESSAGES.eventNotBookable)
  if (!row.proposed_start || !row.proposed_end) return refused(VENUE_BOOKING_MESSAGES.noEventTimes)

  // AC: an event can have at most one active tentative hold at a time. The database enforces
  // this too; checking first turns a bare 23505 into something the coordinator can act on.
  const { data: existing } = await supabase
    .from('venue_bookings')
    .select('id')
    .eq('event_id', eventId)
    .in('status', [...ACTIVE_HOLD_STATUSES])
    .maybeSingle()
  if (existing) return refused(VENUE_BOOKING_MESSAGES.alreadyHeld)

  const slots = await loadTimeSlots()
  const claims = claimsForEvent(new Date(row.proposed_start), new Date(row.proposed_end), slots)
  if (claims.length === 0) return refused(VENUE_BOOKING_MESSAGES.outsideSlots)

  await releaseExpiredHolds(venueId)

  const { data: booking, error: bookingError } = await supabase
    .from('venue_bookings')
    .insert({
      event_id: eventId,
      venue_id: venueId,
      requested_by: userId,
      status: 'held',
      hold_expires_at: holdExpiryFrom(new Date(), holdDays),
    })
    .select('id')
    .single()
  if (bookingError || !booking) return refused(describeError(bookingError))

  // One statement, so every cell is claimed or none is.
  const { error: claimError } = await supabase.from('venue_slot_claims').insert(
    claims.map((cell) => ({
      venue_id: venueId, slot_date: cell.date, slot: cell.slot, kind: cell.kind, booking_id: booking.id,
    })),
  )
  if (claimError) {
    // The two inserts are not one transaction, so undo the booking row by hand.
    await supabase.from('venue_bookings').delete().eq('id', booking.id)
    const conflicts = claimError.code === POSTGRES_UNIQUE_VIOLATION
      ? await findConflicts(venueId, claims)
      : []
    const detail = describeConflicts(conflicts)
    const reason = detail
      ? `${VENUE_BOOKING_MESSAGES.unavailable} Clashes: ${detail}.`
      : describeError(claimError)
    return refused(reason, conflicts)
  }

  return { ok: true, bookingId: booking.id }
}

/** AC: converts a live hold into a booking request for Venue Staff. The slots stay claimed,
 *  so nothing is freed here — only the booking's status moves. Database RLS checks
 *  the current event assignment, including bookings created by a previous coordinator. */
export async function submitVenueBooking(bookingId: string): Promise<VenueBookingActionResult> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, reason: VENUE_BOOKING_MESSAGES.notSignedIn }

  const { data, error } = await supabase
    .from('venue_bookings')
    .update({ status: 'pending_approval' })
    .eq('id', bookingId)
    .eq('status', 'held')
    .gt('hold_expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, reason: describeError(error) }
  if (!data) return { ok: false, reason: VENUE_BOOKING_MESSAGES.notSubmittable }
  return { ok: true }
}

/** The current event coordinator can release an inherited hold. RLS enforces
 *  assignment at write time; requested_by remains the historical creator. */
export async function releaseHold(bookingId: string): Promise<VenueBookingActionResult> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, reason: VENUE_BOOKING_MESSAGES.notSignedIn }

  const { data, error } = await supabase
    .from('venue_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .in('status', ['held', 'pending_approval'])
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, reason: describeError(error) }
  if (!data) return { ok: false, reason: VENUE_BOOKING_MESSAGES.notReleasable }

  // Cells are freed only once the booking is known to be released, so a refused update
  // never leaves a live booking with no claims.
  const { error: claimError } = await supabase
    .from('venue_slot_claims').delete().eq('booking_id', bookingId)
  if (claimError) return { ok: false, reason: describeError(claimError) }
  return { ok: true }
}

interface BookingListRow {
  id: string
  venue_id: string
  event_id: string
  status: VenueBookingStatus
  hold_expires_at: string | null
  review_note: string | null
  review_alternative: string | null
  created_at: string
  venues: { name: string } | null
  events: { reference: string | null; name: string | null } | null
  venue_slot_claims: { slot_date: string; slot: SlotCode; kind: 'event' | 'buffer' | 'maintenance' }[] | null
}

function toSummary(row: BookingListRow): VenueBookingSummary {
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venues?.name ?? '',
    eventId: row.event_id,
    eventReference: row.events?.reference ?? null,
    eventName: row.events?.name ?? null,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    reviewNote: row.review_note,
    ...(row.review_alternative ? { reviewAlternative: row.review_alternative } : {}),
    createdAt: row.created_at,
    cells: (row.venue_slot_claims ?? [])
      .filter((claim): claim is { slot_date: string; slot: SlotCode; kind: 'event' | 'buffer' } =>
        claim.kind !== 'maintenance')
      .map((claim): ClaimCell => ({ date: claim.slot_date, slot: claim.slot, kind: claim.kind }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot)),
  }
}

/** List bookings for events currently assigned to the coordinator. Calendar RLS
 *  permits broader reads, so an inner event join must filter the parent bookings,
 *  not merely hide the nested event. This includes inherited bookings. */
export async function listMyVenueBookings(): Promise<VenueBookingListResult> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, reason: VENUE_BOOKING_MESSAGES.notSignedIn }

  const { data, error } = await supabase
    .from('venue_bookings')
    .select(`
      id, venue_id, event_id, status, hold_expires_at, review_note, review_alternative, created_at,
      venues(name), events!inner(reference, name), venue_slot_claims(slot_date, slot, kind)
    `)
    .eq('events.coordinator_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[venues] listMyVenueBookings', error)
    return { ok: false, reason: VENUE_BOOKING_MESSAGES.loadFailed }
  }
  return { ok: true, bookings: ((data ?? []) as unknown as BookingListRow[]).map(toSummary) }
}

export { BOOKABLE_EVENT_STATUSES }
