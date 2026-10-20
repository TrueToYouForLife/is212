/** Shared preview calculation for the 15-minute booking model in migration 0075.
 * The database remains authoritative when a booking is saved. */
export type QuarterHourCode = `T${string}`
export interface VenueBufferDurations {
  setupMinutes: number
  turnaroundMinutes: number
}
export interface OccupiedVenueCell {
  date: string
  slot: QuarterHourCode
  kind: 'event' | 'buffer'
}

const MINUTE = 60_000
const QUARTER_HOUR = 15 * MINUTE
const SINGAPORE_OFFSET = 8 * 60 * MINUTE

function validDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value % 15 === 0
}

/** Half-open intervals: ending at 12:00 does not occupy the 12:00 cell.
 * Partial cells are occupied conservatively; input event timestamps are not changed.
 * Singapore's UTC+8 offset aligns with the UTC quarter-hour grid, including midnight. */
export function occupiedVenueCells(
  start: Date,
  end: Date,
  durations: VenueBufferDurations,
): OccupiedVenueCell[] {
  const eventStart = start.getTime()
  const eventEnd = end.getTime()
  if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventEnd <= eventStart) {
    throw new Error('A finite event start before its end is required')
  }
  if (!validDuration(durations.setupMinutes) || !validDuration(durations.turnaroundMinutes)) {
    throw new Error('Venue durations must be non-negative multiples of 15 minutes')
  }
  const occupiedStart = eventStart - durations.setupMinutes * MINUTE
  const occupiedEnd = eventEnd + durations.turnaroundMinutes * MINUTE
  if (!Number.isFinite(new Date(occupiedStart + SINGAPORE_OFFSET).getTime()) ||
      !Number.isFinite(new Date(occupiedEnd + SINGAPORE_OFFSET).getTime())) {
    throw new Error('Occupied period is outside the supported date range')
  }
  const cells: OccupiedVenueCell[] = []
  for (let cellStart = Math.floor(occupiedStart / QUARTER_HOUR) * QUARTER_HOUR;
    cellStart < occupiedEnd; cellStart += QUARTER_HOUR) {
    const local = new Date(cellStart + SINGAPORE_OFFSET).toISOString()
    cells.push({
      date: local.slice(0, 10),
      slot: `T${local.slice(11, 13)}${local.slice(14, 16)}`,
      kind: cellStart < eventEnd && cellStart + QUARTER_HOUR > eventStart ? 'event' : 'buffer',
    })
  }
  return cells
}
