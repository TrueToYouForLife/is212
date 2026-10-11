import { describe, expect, test } from 'vitest'
import { buildVenueAvailability } from '../venueAvailability'
import type { AvailabilityClaimRow, AvailabilityVenue } from '../venueAvailability'
import { SLOTS } from './fixtures/venueBooking'

const HALL: AvailabilityVenue = { id: 'v-hall', name: 'Alpha Hall', location: 'Level 1', status: 'active' }
const ROOM: AvailabilityVenue = { id: 'v-room', name: 'Breakout Room', location: 'Level 2', status: 'active' }

function claim(overrides: Partial<AvailabilityClaimRow>): AvailabilityClaimRow {
  return {
    venue_id: HALL.id, slot_date: '2026-10-12', slot: 'AM', kind: 'event',
    booking_id: 'b-1', booking_status: 'confirmed', event_reference: 'EVT-1', closure_reason: null,
    ...overrides,
  }
}

/** The state of one venue's cell, by date and slot. */
function stateOf(result: ReturnType<typeof buildVenueAvailability>, venueId: string, date: string, slot: string) {
  const row = result.rows.find((candidate) => candidate.venue.id === venueId)
  return row?.timetable.days.flat().find((cell) => cell.date === date && cell.slot === slot)
}

describe('AC-019.2 — bookings and confirmed events are blocked out', () => {
  test('AC-019.2.1: each venue gets only its own bookings, never another venue\'s', () => {
    const result = buildVenueAvailability([HALL, ROOM], SLOTS, [
      claim({ venue_id: HALL.id, slot: 'AM' }),
      claim({ venue_id: ROOM.id, slot: 'PM', booking_id: 'b-2', event_reference: 'EVT-2' }),
    ], '2026-10-12', 7)

    expect(stateOf(result, HALL.id, '2026-10-12', 'AM')?.state).toBe('confirmed')
    expect(stateOf(result, HALL.id, '2026-10-12', 'PM')?.state).toBe('free')
    expect(stateOf(result, ROOM.id, '2026-10-12', 'AM')?.state).toBe('free')
    expect(stateOf(result, ROOM.id, '2026-10-12', 'PM')).toMatchObject({ state: 'confirmed', eventReference: 'EVT-2' })
  })

  test('AC-019.2.2: a confirmed booking is blocked out, and a hold or request is shown as taken but distinct', () => {
    const result = buildVenueAvailability([HALL], SLOTS, [
      claim({ slot: 'AM', booking_status: 'confirmed' }),
      claim({ slot: 'PM', booking_id: 'b-2', booking_status: 'held' }),
      claim({ slot: 'NIGHT', booking_id: 'b-3', booking_status: 'pending_approval' }),
    ], '2026-10-12', 7)

    expect(stateOf(result, HALL.id, '2026-10-12', 'AM')?.state).toBe('confirmed')
    expect(stateOf(result, HALL.id, '2026-10-12', 'PM')?.state).toBe('held')
    expect(stateOf(result, HALL.id, '2026-10-12', 'NIGHT')?.state).toBe('pending_approval')
  })

  test('AC-019.2.3: a Venue Staff block is shown as blocked, with its reason', () => {
    const result = buildVenueAvailability([HALL], SLOTS, [
      claim({ kind: 'maintenance', booking_id: null, booking_status: null, event_reference: null, closure_reason: 'Aircon repair' }),
    ], '2026-10-12', 7)

    expect(stateOf(result, HALL.id, '2026-10-12', 'AM')).toMatchObject({ state: 'maintenance', closureReason: 'Aircon repair' })
  })

  test.each(['cancelled', 'rejected', 'expired'] as const)(
    'AC-019.2.4: a slot left behind by a %s booking reads as free, not blocked',
    (status) => {
      const result = buildVenueAvailability([HALL], SLOTS, [claim({ booking_status: status })], '2026-10-12', 7)
      expect(stateOf(result, HALL.id, '2026-10-12', 'AM')?.state).toBe('free')
    },
  )

  test('AC-019.2.5: a venue with nothing booked is a fully free week', () => {
    const result = buildVenueAvailability([HALL], SLOTS, [], '2026-10-12', 7)
    const cells = result.rows[0].timetable.days.flat()
    expect(cells).toHaveLength(21)
    expect(cells.every((cell) => cell.state === 'free')).toBe(true)
  })

  test('AC-019.2.6: a booking for a venue that is not listed, such as a retired one, is not drawn anywhere', () => {
    const result = buildVenueAvailability([HALL], SLOTS, [claim({ venue_id: 'v-retired' })], '2026-10-12', 7)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].timetable.days.flat().every((cell) => cell.state === 'free')).toBe(true)
  })

  test('AC-019.2.7: venues are listed by name, whatever order they arrive in', () => {
    const result = buildVenueAvailability([ROOM, HALL], SLOTS, [], '2026-10-12', 7)
    expect(result.rows.map((row) => row.venue.name)).toEqual(['Alpha Hall', 'Breakout Room'])
  })

  test('AC-019.2.8: the week spans the requested days in order, across a month end', () => {
    const result = buildVenueAvailability([HALL], SLOTS, [claim({ slot_date: '2026-11-02' })], '2026-10-28', 7)
    expect(result.dates).toEqual([
      '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03',
    ])
    expect(stateOf(result, HALL.id, '2026-11-02', 'AM')?.state).toBe('confirmed')
  })
})
