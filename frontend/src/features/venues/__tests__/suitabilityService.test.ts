import { beforeEach, describe, expect, test, vi } from 'vitest'
import { QUARTER_HOUR_SLOTS as SLOTS } from '../quarterHourSlots'
import {
  SUITABILITY_MESSAGES, assessVenueForBooking, assessVenuesForEvent, loadEventSuitability, saveVenueRequirements,
} from '../suitabilityService'



const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

type Result = { data: unknown; error: { code?: string; message?: string } | null }

interface FakeQuery {
  calls: Record<string, unknown[][]>
  [method: string]: unknown
}

/** Stands in for a Supabase query: every builder method records its arguments and returns
 *  the query itself; awaiting it, or calling single/maybeSingle, gives the canned result. */
function query(result: Result): FakeQuery {
  const calls: Record<string, unknown[][]> = {}
  const builder: FakeQuery = {
    calls,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  for (const method of ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'order', 'upsert']) {
    builder[method] = (...args: unknown[]) => {
      calls[method] = [...(calls[method] ?? []), args]
      return builder
    }
  }
  return builder
}

/** Sends supabase.from(table) to the canned query for that table. */
function tables(map: Record<string, FakeQuery>) {
  mocks.from.mockImplementation((table: string) => map[table])
}

const EVENT_ID = 'event-1'
const EVENT_ROW = {
  id: EVENT_ID,
  reference: 'EVT-1',
  name: 'Workshop',
  proposed_start: '2041-03-10T01:00:00Z', // 9am Singapore
  proposed_end: '2041-03-10T03:00:00Z',
  expected_attendance: 60,
  layout_preference: 'theatre',
  accessibility_requirements: ['wheelchair_access'],
  facility_requirements: ['projector'],
}

const VENUE_ROWS = [
  {
    id: 'v-small', name: 'Small Room', location: 'Level 1', status: 'active', setup_minutes: 0, turnaround_minutes: 0,
    accessibility: [], facility: {}, venue_layouts: [{ layout: 'boardroom', capacity: 20 }],
  },
  {
    id: 'v-hall', name: 'Main Hall', location: 'Level 2', status: 'active', setup_minutes: 0, turnaround_minutes: 0,
    accessibility: ['wheelchair_access'], facility: { projector: true },
    venue_layouts: [{ layout: 'theatre', capacity: 200 }],
  },
]

/** Every table an assessment reads, each with a sensible default; override one per test. */
function assessTables(overrides: Record<string, FakeQuery> = {}) {
  const map: Record<string, FakeQuery> = {
    events: query({ data: EVENT_ROW, error: null }),
    event_venue_requirements: query({ data: null, error: null }),
    venues: query({ data: VENUE_ROWS, error: null }),
    venue_effective_slot_claims: query({ data: [], error: null }),
    layout_types: query({ data: [{ code: 'theatre', label: 'Theatre' }, { code: 'boardroom', label: 'Boardroom' }], error: null }),
    ...overrides,
  }
  tables(map)
  return map
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'coordinator-1' } }, error: null })
})

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test("AC-018.1.14: loads the event and the coordinator's saved requirements", async () => {
    tables({
      events: query({ data: EVENT_ROW, error: null }),
      event_venue_requirements: query({
        data: { layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['projector'] },
        error: null,
      }),
    })
    expect(await loadEventSuitability(EVENT_ID)).toEqual({
      ok: true,
      value: {
        event: {
          id: EVENT_ID,
          reference: 'EVT-1',
          name: 'Workshop',
          proposedStart: '2041-03-10T01:00:00Z',
          proposedEnd: '2041-03-10T03:00:00Z',
          expectedAttendance: 60,
          layoutPreference: 'theatre',
          accessibilityRequirements: ['wheelchair_access'],
          facilityRequirements: ['projector'],
        },
        requirements: { layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['projector'] },
      },
    })
  })
  test('AC-018.1.15: before anything is saved, the requirements are empty', async () => {
    tables({
      events: query({ data: EVENT_ROW, error: null }),
      event_venue_requirements: query({ data: null, error: null }),
    })
    const result = await loadEventSuitability(EVENT_ID)
    expect(result.ok && result.value.requirements).toEqual({ layout: null, accessibility: [], facilities: [] })
  })
  test('AC-018.1.16: someone not signed in is told to sign in', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    tables({
      events: query({ data: EVENT_ROW, error: null }),
      event_venue_requirements: query({ data: null, error: null }),
    })
    expect(await loadEventSuitability(EVENT_ID)).toEqual({ ok: false, reason: SUITABILITY_MESSAGES.notSignedIn })
  })
  test('AC-018.1.17: an event that is missing, or not visible to this coordinator, is reported', async () => {
    tables({
      events: query({ data: null, error: null }),
      event_venue_requirements: query({ data: null, error: null }),
    })
    expect(await loadEventSuitability(EVENT_ID)).toEqual({ ok: false, reason: SUITABILITY_MESSAGES.eventNotFound })
  }) 
  test('AC-018.1.18: if saved requirements cannot be loaded, an error is shown rather than empty requirements', async () => {
    tables({
      events: query({ data: EVENT_ROW, error: null }),
      event_venue_requirements: query({ data: null, error: { message: 'timeout' } }),
    })
    expect(await loadEventSuitability(EVENT_ID)).toEqual({ ok: false, reason: SUITABILITY_MESSAGES.unexpected })
  })
  test('AC-018.1.19: saving cleans the requirements and stamps them with the signed-in coordinator', async () => {
    const save = query({ data: { layout: 'theatre', accessibility: ['hearing_loop'], facilities: [] }, error: null })
    tables({ event_venue_requirements: save })
    const result = await saveVenueRequirements(EVENT_ID, {
      layout: ' theatre ',
      accessibility: ['hearing_loop', 'hearing_loop', ''],
      facilities: [],
    })
    expect(save.calls.upsert).toEqual([[
      { event_id: EVENT_ID, layout: 'theatre', accessibility: ['hearing_loop'], facilities: [], updated_by: 'coordinator-1' },
      { onConflict: 'event_id' },
    ]])
    expect(result).toEqual({ ok: true, value: { layout: 'theatre', accessibility: ['hearing_loop'], facilities: [] } })
  })
  test('AC-018.1.20: a coordinator not assigned to the event is told only the assigned coordinator can save', async () => {
    tables({ event_venue_requirements: query({ data: null, error: { code: '42501', message: 'denied' } }) })
    expect(await saveVenueRequirements(EVENT_ID, { layout: null, accessibility: [], facilities: [] }))
      .toEqual({ ok: false, reason: SUITABILITY_MESSAGES.saveDenied })
  })
  test('AC-018.1.21: a layout that is not in the catalogue is refused with a clear message', async () => {
    tables({ event_venue_requirements: query({ data: null, error: { code: '23503', message: 'fk' } }) })
    expect(await saveVenueRequirements(EVENT_ID, { layout: 'stage', accessibility: [], facilities: [] }))
      .toEqual({ ok: false, reason: SUITABILITY_MESSAGES.unknownLayout })
  })
  test('AC-018.1.22: every venue that is not retired is assessed, suitable first, with layout names from the catalogue', async () => {
    const map = assessTables({
      event_venue_requirements: query({ data: { layout: 'theatre', accessibility: [], facilities: [] }, error: null }),
    })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    if (!result.ok) throw new Error(result.reason)
    expect(map.venues.calls.neq).toEqual([['status', 'retired']])
    expect(result.value.map((a) => [a.venue.name, a.verdict])).toEqual([['Main Hall', 'suitable'], ['Small Room', 'unsuitable']])
    expect(result.value[1].reasons).toEqual([{ code: 'layout', message: 'Does not support the Theatre layout.' }])
  })
  test('AC-018.1.31: when given venue ids, only those venues are assessed', async () => {
    const map = assessTables()
    await assessVenuesForEvent(EVENT_ID, SLOTS, ['v-hall'])
    expect(map.venues.calls.in).toEqual([['id', ['v-hall']]])
  })
})


describe('AC-018.4 — venues taken by bookings or maintenance are blacked out', () => {
  test('AC-018.4.7: a booking or block on a slot this event needs blacks the venue out; other slots do not', async () => {
    assessTables({
      venue_effective_slot_claims: query({
        data: [
          { venue_id: 'v-hall', slot_date: '2041-03-10', slot: 'T0900', kind: 'maintenance', venue_bookings: null },
          { venue_id: 'v-small', slot_date: '2041-03-12', slot: 'T0900', kind: 'event', venue_bookings: { event_id: 'other' } },
        ],
        error: null,
      }),
    })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    if (!result.ok) throw new Error(result.reason)
    const hall = result.value.find((a) => a.venue.id === 'v-hall')
    const small = result.value.find((a) => a.venue.id === 'v-small')
    expect(hall?.verdict).toBe('unavailable')
    expect(hall?.reasons[0]).toEqual({ code: 'blocked', message: 'Blocked by Venue Staff on 10 Mar 2041 (09:00–09:15).' })
    expect(small?.reasons.map((reason) => reason.code)).not.toContain('booked')
  })
  test("AC-018.4.8: this event's own hold on a venue is not counted as a clash", async () => {
    assessTables({
      venue_effective_slot_claims: query({
        data: [{ venue_id: 'v-hall', slot_date: '2041-03-10', slot: 'T0900', kind: 'event', venue_bookings: { event_id: EVENT_ID } }],
        error: null,
      }),
    })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    if (!result.ok) throw new Error(result.reason)
    expect(result.value.find((a) => a.venue.id === 'v-hall')?.verdict).toBe('suitable')
  })
  test('AC-018.4.9: if bookings and blocks cannot be checked, an error is shown rather than every venue looking free', async () => {
    assessTables({ venue_effective_slot_claims: query({ data: null, error: { message: 'timeout' } }) })
    expect(await assessVenuesForEvent(EVENT_ID, SLOTS))
      .toEqual({ ok: false, reason: SUITABILITY_MESSAGES.availabilityFailed })
  })
  test('AC-018.4.10: an event without times is not offered any venue as free', async () => {
    assessTables({ events: query({ data: { ...EVENT_ROW, proposed_start: null, proposed_end: null }, error: null }) })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    if (!result.ok) throw new Error(result.reason)
    expect(result.value.every((a) => a.verdict === 'unavailable')).toBe(true)
    expect(result.value[0].reasons[0].code).toBe('timing')
  })
  test('AC-018.4.11: overnight events use the full-day quarter-hour catalogue', async () => {
    assessTables({
      events: query({
        data: { ...EVENT_ROW, proposed_start: '2041-03-10T18:30:00Z', proposed_end: '2041-03-10T19:00:00Z' }, // 2:30–3am Singapore
        error: null,
      }),
    })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    if (!result.ok) throw new Error(result.reason)
    expect(result.value.every((a) => a.reasons.every((r) => r.code !== 'timing'))).toBe(true)
    expect(result.value.find((a) => a.venue.id === 'v-hall')?.verdict).toBe('suitable')
  })
})

describe('AC-018.2 — coordinators are alerted when booking an unsuitable venue', () => {
  test('AC-018.2.1: before booking, the chosen venue alone is checked against the event', async () => {
    const map = assessTables({ venues: query({ data: [VENUE_ROWS[0]], error: null }) })
    const result = await assessVenueForBooking(EVENT_ID, 'v-small', SLOTS)
    expect(map.venues.calls.in).toEqual([['id', ['v-small']]])
    expect(result.ok && result.value.venue.id).toBe('v-small')
  })

  test('AC-018.2.2: a venue that no longer exists or is retired is reported, not treated as fine', async () => {
    assessTables({ venues: query({ data: [], error: null }) })
    expect(await assessVenueForBooking(EVENT_ID, 'v-gone', SLOTS))
      .toEqual({ ok: false, reason: SUITABILITY_MESSAGES.venueNotFound })
  })
})

describe('US47 suitability occupied periods', () => {
  test('AC-047.2.30: each venue uses its own buffers, excludes adjacent cells and ignores its own hold', async () => {
    const venues = [
      { ...VENUE_ROWS[1], id: 'buffered', setup_minutes: 30, turnaround_minutes: 15 },
      { ...VENUE_ROWS[1], id: 'zero' },
    ]
    const claims = query({ data: venues.flatMap((venue) => [
      { venue_id: venue.id, slot_date: '2041-03-10', slot: 'T0830', kind: 'maintenance', venue_bookings: null },
      { venue_id: venue.id, slot_date: '2041-03-10', slot: 'T1100', kind: 'event', venue_bookings: { event_id: 'other' } },
      { venue_id: venue.id, slot_date: '2041-03-10', slot: 'T1115', kind: 'maintenance', venue_bookings: null },
      { venue_id: venue.id, slot_date: '2041-03-10', slot: 'T0900', kind: 'event', venue_bookings: { event_id: EVENT_ID } },
    ]), error: null })
    assessTables({ venues: query({ data: venues, error: null }), venue_effective_slot_claims: claims })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    if (!result.ok) throw new Error(result.reason)
    expect(result.value.find((v) => v.venue.id === 'zero')?.verdict).toBe('suitable')
    const buffered = result.value.find((v) => v.venue.id === 'buffered')!
    expect(buffered.verdict).toBe('unavailable')
    expect(buffered.reasons.map((r) => r.code)).toEqual(['blocked', 'booked'])
    expect(buffered.reasons.map((r) => r.message).join(' ')).not.toContain('11:15–11:30')
  })

  test('AC-047.2.31: invalid durations or reversed timing fail closed, and midnight buffers query both dates', async () => {
    const invalidContexts: Record<string, FakeQuery>[] = [
      { venues: query({ data: [{ ...VENUE_ROWS[1], setup_minutes: 10 }], error: null }) },
      { events: query({ data: { ...EVENT_ROW, proposed_end: EVENT_ROW.proposed_start }, error: null }) },
    ]
    for (const overrides of invalidContexts) {
      assessTables(overrides)
      expect(await assessVenuesForEvent(EVENT_ID, SLOTS))
        .toEqual({ ok: false, reason: SUITABILITY_MESSAGES.availabilityFailed })
    }
    const map = assessTables({
      venues: query({ data: [{ ...VENUE_ROWS[1], setup_minutes: 15 }], error: null }),
      events: query({ data: { ...EVENT_ROW, proposed_start: '2041-03-09T16:00:00Z', proposed_end: '2041-03-09T16:15:00Z' }, error: null }),
      venue_effective_slot_claims: query({ data: [{ venue_id: 'v-hall', slot_date: '2041-03-09', slot: 'T2345', kind: 'maintenance', venue_bookings: null }], error: null }),
    })
    const result = await assessVenuesForEvent(EVENT_ID, SLOTS)
    expect(result.ok && result.value[0].verdict).toBe('unavailable')
    expect(map.venue_effective_slot_claims.calls.gte).toEqual([['slot_date', '2041-03-09']])
    expect(map.venue_effective_slot_claims.calls.lte).toEqual([['slot_date', '2041-03-10']])
  })
})
