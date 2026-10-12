import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VENUE_AVAILABILITY_MESSAGES as messages, getVenueAvailability } from '../venueAvailabilityService'
import { COORDINATOR_ID, SLOTS, createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const fake = createSupabaseFake()

const VENUE_ROWS = [
  { id: 'v-hall', name: 'Alpha Hall', location: 'Level 1', status: 'active' },
  { id: 'v-room', name: 'Breakout Room', location: null, status: 'under_maintenance' },
]

beforeEach(() => {
  vi.resetAllMocks()
  fake.reset()
  mocks.from.mockImplementation(fake.route)
  mocks.getUser.mockResolvedValue({ data: { user: { id: COORDINATOR_ID } }, error: null })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-019.1 — staff can view availability across dates', () => {
  test('AC-019.1.1: a signed-out user reads nothing, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getVenueAvailability(SLOTS, '2026-10-12')).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(fake.tablesTouched()).toEqual([])
  })

  test('AC-019.1.2: reads every venue except retired ones, by name, and every claim in the week only', async () => {
    fake.plan('venues', { data: [] })
    fake.plan('venue_slot_claims', { data: [] })
    await getVenueAvailability(SLOTS, '2026-10-12', 7)

    expect(fake.callsTo('venues', 'neq')).toEqual([['status', 'retired']])
    expect(fake.callsTo('venues', 'order')).toEqual([['name']])
    expect(fake.callsTo('venue_slot_claims', 'gte')).toEqual([['slot_date', '2026-10-12']])
    expect(fake.callsTo('venue_slot_claims', 'lte')).toEqual([['slot_date', '2026-10-18']])
    // Every venue in one read, not one query per venue.
    expect(fake.callsTo('venue_slot_claims', 'eq')).toEqual([])
  })

  test('AC-019.1.3: bookings and blocks from the joined rows land on their own venue\'s cells', async () => {
    fake.plan('venues', { data: VENUE_ROWS })
    fake.plan('venue_slot_claims', { data: [
      { venue_id: 'v-hall', slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: 'b-1',
        venue_bookings: { status: 'confirmed', events: { reference: 'EVT-1' } }, venue_closures: null },
      { venue_id: 'v-room', slot_date: '2026-10-13', slot: 'PM', kind: 'maintenance', booking_id: null,
        venue_bookings: null, venue_closures: { reason: 'Aircon repair' } },
    ] })

    const result = await getVenueAvailability(SLOTS, '2026-10-12', 7)
    if (!result.ok) throw new Error(result.reason)
    const [hall, room] = result.availability.rows
    expect(hall.venue).toEqual({ id: 'v-hall', name: 'Alpha Hall', location: 'Level 1', status: 'active' })
    expect(room.venue).toEqual({ id: 'v-room', name: 'Breakout Room', location: '', status: 'under_maintenance' })
    expect(hall.timetable.days[0][0]).toMatchObject({ state: 'confirmed', eventReference: 'EVT-1' })
    expect(room.timetable.days[1][1]).toMatchObject({ state: 'maintenance', closureReason: 'Aircon repair' })
  })

  test('AC-019.1.4: a booking whose event cannot be read still blocks its slot', async () => {
    fake.plan('venues', { data: [VENUE_ROWS[0]] })
    fake.plan('venue_slot_claims', { data: [
      { venue_id: 'v-hall', slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: 'b-1',
        venue_bookings: { status: 'confirmed', events: null }, venue_closures: null },
      { venue_id: 'v-hall', slot_date: '2026-10-12', slot: 'PM', kind: 'event', booking_id: 'b-2',
        venue_bookings: null, venue_closures: null },
    ] })

    const result = await getVenueAvailability(SLOTS, '2026-10-12', 7)
    if (!result.ok) throw new Error(result.reason)
    expect(result.availability.rows[0].timetable.days[0][0]).toMatchObject({ state: 'confirmed', eventReference: null })
    // No booking attached at all: nothing holds the slot, so it is free (as on the US10 timetable).
    expect(result.availability.rows[0].timetable.days[0][1].state).toBe('free')
  })

  test('AC-019.1.5: a failed venue read is reported, never drawn as an empty, free week, and is logged', async () => {
    fake.plan('venues', { error: { message: 'down' } })
    fake.plan('venue_slot_claims', { data: [] })
    expect(await getVenueAvailability(SLOTS, '2026-10-12')).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalled()
  })

  test('AC-019.1.6: a failed claims read is reported, never drawn as a free week', async () => {
    fake.plan('venues', { data: VENUE_ROWS })
    fake.plan('venue_slot_claims', { error: { message: 'down' } })
    expect(await getVenueAvailability(SLOTS, '2026-10-12')).toEqual({ ok: false, reason: messages.loadFailed })
  })

  test('AC-019.1.7: with no slot times loaded nothing is queried, and the failure is reported', async () => {
    expect(await getVenueAvailability([], '2026-10-12')).toEqual({ ok: false, reason: messages.loadFailed })
    expect(fake.tablesTouched()).toEqual([])
  })

  test('AC-019.1.8: an empty payload is an empty calendar, not an error', async () => {
    fake.plan('venues', { data: null })
    fake.plan('venue_slot_claims', { data: null })
    const result = await getVenueAvailability(SLOTS, '2026-10-12')
    expect(result).toMatchObject({ ok: true, availability: { rows: [] } })
  })
})
