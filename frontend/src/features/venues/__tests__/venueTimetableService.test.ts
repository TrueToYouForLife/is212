import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VENUE_TIMETABLE_MESSAGES as messages, getVenue, getVenueTimetable } from '../venueTimetableService'
import { COORDINATOR_ID, SLOTS, VENUE_ID, createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const fake = createSupabaseFake()

const VENUE_ROW = {
  setup_minutes: 30, turnaround_minutes: 45,
  id: VENUE_ID, name: 'Alpha Hall', capacity: 200, layout: 'theatre',
  accessibility: ['wheelchair_access'], facility: { projector: true }, status: 'active', location: 'Bras Basah',
}

beforeEach(() => {
  vi.resetAllMocks()
  fake.reset()
  mocks.from.mockImplementation(fake.route)
  mocks.getUser.mockResolvedValue({ data: { user: { id: COORDINATOR_ID } }, error: null })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('getVenue', () => {
  test('AC-009.1.15: returns one venue, normalising a null accessibility, facility or location', async () => {
    fake.plan('venues', { data: { ...VENUE_ROW, accessibility: null, facility: null, location: null } })
    expect(await getVenue(VENUE_ID)).toEqual({ ok: true, venue: {
      setupMinutes: 30, turnaroundMinutes: 45,
      id: VENUE_ID, name: 'Alpha Hall', capacity: 200, layout: 'theatre',
      accessibility: [], facility: {}, status: 'active', location: '',
    } })
  })
  test('AC-009.1.16: a venue that does not exist is reported, not returned as empty', async () => {
    fake.plan('venues', { data: null })
    expect(await getVenue(VENUE_ID)).toEqual({ ok: false, reason: messages.venueNotFound })
  })
  test('AC-009.1.17: a failed lookup is reported and logged', async () => {
    fake.plan('venues', { error: { message: 'down' } })
    expect(await getVenue(VENUE_ID)).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalled()
  })
  test('AC-009.1.18: a signed-out user reads nothing, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getVenue(VENUE_ID)).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(fake.tablesTouched()).toEqual([])
  })
})

describe('AC-010.5 — the venue availability calendar', () => {
  test('AC-010.5.10: reads one venue’s claims across the requested window only', async () => {
    fake.plan('venue_effective_slot_claims', { data: [] })
    await getVenueTimetable(VENUE_ID, SLOTS, '2026-10-12', 7)
    expect(fake.callsTo('venue_effective_slot_claims', 'eq')).toEqual([['venue_id', VENUE_ID]])
    expect(fake.callsTo('venue_effective_slot_claims', 'gte')).toEqual([['slot_date', '2026-10-12']])
    expect(fake.callsTo('venue_effective_slot_claims', 'lte')).toEqual([['slot_date', '2026-10-18']])
  })
  test('AC-010.5.11: holds, requests, confirmed bookings and blocks all arrive in one query', async () => {
    fake.plan('venue_effective_slot_claims', { data: [
      { slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: 'b-1',
        venue_bookings: { status: 'held', events: { reference: 'EVT-1' } }, venue_closures: null },
      { slot_date: '2026-10-12', slot: 'PM', kind: 'buffer', booking_id: 'b-1',
        venue_bookings: { status: 'held', events: { reference: 'EVT-1' } }, venue_closures: null },
      { slot_date: '2026-10-13', slot: 'AM', kind: 'event', booking_id: 'b-2',
        venue_bookings: { status: 'confirmed', events: { reference: 'EVT-2' } }, venue_closures: null },
      { slot_date: '2026-10-13', slot: 'PM', kind: 'maintenance', booking_id: null,
        venue_bookings: null, venue_closures: { reason: 'Floor resurfacing' } },
    ] })
    const result = await getVenueTimetable(VENUE_ID, SLOTS, '2026-10-12', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [day1, day2] = result.timetable.days
    expect(day1.map((cell) => cell.state)).toEqual(['held', 'held', 'free'])
    expect(day1[0].eventReference).toBe('EVT-1')
    expect(day1[1].role).toBe('buffer')
    expect(day2.map((cell) => cell.state)).toEqual(['confirmed', 'maintenance', 'free'])
    expect(day2[1].closureReason).toBe('Floor resurfacing')
  })
  test('AC-010.5.12: a failed load is reported rather than drawn as an empty, free week', async () => {
    fake.plan('venue_effective_slot_claims', { error: { message: 'down' } })
    expect(await getVenueTimetable(VENUE_ID, SLOTS, '2026-10-12'))
      .toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalled()
  })
  test('AC-010.5.13: a signed-out user sees no calendar, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getVenueTimetable(VENUE_ID, SLOTS, '2026-10-12'))
      .toEqual({ ok: false, reason: messages.notSignedIn })
    expect(fake.tablesTouched()).toEqual([])
  })
})
