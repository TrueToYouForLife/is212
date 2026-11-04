/**
 * PURE MODULE — turns claim rows into the grid a calendar draws. No React, no Supabase.
 *
 * Free cells are never stored: the grid always draws one cell per slot per date, and a cell
 * is free unless a claim row covers it.
 */
import { datesFrom } from './slots'
import type { SlotCode, TimeSlot } from './slots'
import type { TimetableCell, TimetableState, VenueTimetable } from './bookingTypes'
import { LIVE_BOOKING_STATUSES } from './holdRules'
import type { VenueBookingStatus } from './bookingTypes'

/** One venue_slot_claims row joined to whatever holds it. */
export interface TimetableClaimRow {
  slot_date: string
  slot: SlotCode
  kind: 'event' | 'buffer' | 'maintenance'
  booking_id: string | null
  booking_status: VenueBookingStatus | null
  event_reference: string | null
  closure_reason: string | null
}

function freeCell(date: string, slot: SlotCode): TimetableCell {
  return { date, slot, state: 'free', role: null, bookingId: null, eventReference: null, closureReason: null }
}

function toCell(date: string, slot: SlotCode, row: TimetableClaimRow): TimetableCell {
  if (row.kind === 'maintenance') {
    return {
      date, slot, state: 'maintenance', role: null, bookingId: null,
      eventReference: null, closureReason: row.closure_reason,
    }
  }
  return {
    date, slot,
    // stillOccupies has already dropped any claim without a live booking status.
    state: row.booking_status as TimetableState,
    role: row.kind,
    bookingId: row.booking_id,
    eventReference: row.event_reference,
    closureReason: null,
  }
}

/**
 * A claim whose booking has been rejected, cancelled or expired should already have been
 * deleted, but a lapsed hold stays until something sweeps it. Dropping dead claims here
 * stops the calendar showing a slot as taken when nothing holds it.
 */
function stillOccupies(row: TimetableClaimRow): boolean {
  if (row.kind === 'maintenance') return true
  return row.booking_status !== null && LIVE_BOOKING_STATUSES.includes(row.booking_status)
}

export function buildTimetable(
  slots: TimeSlot[],
  claims: TimetableClaimRow[],
  fromDate: string,
  days: number,
): VenueTimetable {
  const ordered = [...slots].sort((a, b) => a.sortOrder - b.sortOrder)
  const byCell = new Map<string, TimetableClaimRow>()
  for (const row of claims) {
    if (stillOccupies(row)) byCell.set(`${row.slot_date}|${row.slot}`, row)
  }

  return {
    fromDate,
    days: datesFrom(fromDate, days).map((date) =>
      ordered.map((slot) => {
        const row = byCell.get(`${date}|${slot.code}`)
        return row ? toCell(date, slot.code, row) : freeCell(date, slot.code)
      }),
    ),
  }
}

const STATE_LABELS: Record<TimetableState, string> = {
  free: 'Available',
  held: 'Tentatively held',
  pending_approval: 'Awaiting Venue Staff',
  confirmed: 'Confirmed booking',
  maintenance: 'Blocked',
}

/** AC: a held slot reads as "Tentatively held" to authorised internal users. */
export function timetableCellLabel(cell: TimetableCell): string {
  const base = STATE_LABELS[cell.state]
  return cell.role === 'buffer' ? `${base} (setup/turnaround)` : base
}
