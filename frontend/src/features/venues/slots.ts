// src/features/venues/slots.ts
import type { QuarterHourCode } from './venueOccupiedSlots'

// Legacy codes remain for consumers awaiting conversion; new selectors use quarters.
export type SlotCode = 'AM' | 'PM' | 'NIGHT' | QuarterHourCode

export interface TimeSlot {
  code: SlotCode
  startsAt: string   // '07:00:00'
  endsAt: string     // '12:00:00', or '24:00:00' for the last slot
  sortOrder: number
}
export interface SlotCell { date: string; slot: SlotCode }
export type ClaimKind = 'event' | 'buffer'
export interface ClaimCell extends SlotCell { kind: ClaimKind }

const SGT_OFFSET_MINUTES = 8 * 60   // Singapore has no daylight saving

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** The instant (ms since epoch) of a Singapore wall-clock time on a given date. */
function sgtInstant(date: string, minutesAfterMidnight: number): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d, 0, minutesAfterMidnight - SGT_OFFSET_MINUTES)
}

function sgtDate(instant: number): string {
  return new Date(instant + SGT_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10)
}

function sortSlots(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Every slot an event touches, in time order. A slot is used if the event overlaps it at all. */
export function slotsForRange(start: Date, end: Date, slots: TimeSlot[]): SlotCell[] {
  const ordered = sortSlots(slots)
  const cells: SlotCell[] = []
  const lastDate = sgtDate(end.getTime())
  for (let date = sgtDate(start.getTime()); date <= lastDate; date = addDays(date, 1)) {
    for (const slot of ordered) {
      const slotStart = sgtInstant(date, toMinutes(slot.startsAt))
      const slotEnd = sgtInstant(date, toMinutes(slot.endsAt))
      if (slotStart < end.getTime() && slotEnd > start.getTime()) {
        cells.push({ date, slot: slot.code })
      }
    }
  }
  return cells
}

/** TURNAROUND SLOT: The slot immediately after this one. After NIGHT comes tomorrow's first slot. */
export function nextCell(cell: SlotCell, slots: TimeSlot[]): SlotCell {
  const ordered = sortSlots(slots)
  const index = ordered.findIndex((slot) => slot.code === cell.slot)
  return index === ordered.length - 1
    ? { date: addDays(cell.date, 1), slot: ordered[0].code }
    : { date: cell.date, slot: ordered[index + 1].code }
}

/** SETUP SLOT: The slot immediately before this one. Before AM comes yesterday's last slot. */
export function prevCell(cell: SlotCell, slots: TimeSlot[]): SlotCell {
  const ordered = sortSlots(slots)
  const index = ordered.findIndex((slot) => slot.code === cell.slot)
  return index === 0
    ? { date: addDays(cell.date, -1), slot: ordered[ordered.length - 1].code }
    : { date: cell.date, slot: ordered[index - 1].code }
}

/**
 * What a booking must claim: one buffer slot immediately before the event (setup), the
 * event's own slots, and one buffer slot immediately after (turnaround). A multi-slot event
 * (e.g. AM+PM) only gets one buffer on each end of the whole span, not between its own
 * internal slots.
 */
export function claimsForEvent(start: Date, end: Date, slots: TimeSlot[]): ClaimCell[] {
  const eventCells = slotsForRange(start, end, slots)
  if (eventCells.length === 0) return []
  const before = prevCell(eventCells[0], slots)
  const after = nextCell(eventCells[eventCells.length - 1], slots)
  return [
    { ...before, kind: 'buffer' },
    ...eventCells.map((cell): ClaimCell => ({ ...cell, kind: 'event' })),
    { ...after, kind: 'buffer' },
  ]
}

export function datesFrom(fromDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, offset) => addDays(fromDate, offset))
}

/** The real start/end instant of one slot on one date — lets a plain date+slot filter be
 *  previewed for availability the same way claimsForEvent previews it for a real event. */
export function slotWindow(date: string, slotCode: SlotCode, slots: TimeSlot[]): { start: Date; end: Date } {
  const slot = slots.find((candidate) => candidate.code === slotCode)
  if (!slot) throw new Error(`Unknown slot code: ${slotCode}`)
  return {
    start: new Date(sgtInstant(date, toMinutes(slot.startsAt))),
    end: new Date(sgtInstant(date, toMinutes(slot.endsAt))),
  }
}