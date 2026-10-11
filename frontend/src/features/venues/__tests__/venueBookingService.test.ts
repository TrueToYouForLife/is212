import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  VENUE_BOOKING_MESSAGES as messages, holdVenue, listMyVenueBookings, loadTimeSlots,
  releaseHold, submitVenueBooking,
} from '../venueBookingService'
import {
  BOOKING_ID, COORDINATOR_ID, EVENT_ID, SLOT_ROWS, VENUE_ID, APPROVED_EVENT,
  callOrder, createSupabaseFake, eventWith, sgt,
} from './fixtures/venueBooking'
import type { FakeResult } from './fixtures/venueBooking'

// AC-009 = Submit venue booking request. AC-010 = Tentative hold.
// Replace both with the real story numbers once the Jira keys are assigned.

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const fake = createSupabaseFake()
const NOW = '2026-10-05T04:00:00.000Z'

interface HoldPlan {
  event?: Record<string, unknown> | null
  existingHold?: unknown
  lapsedHoldIds?: string[]
  booking?: FakeResult
  claims?: FakeResult
  conflicts?: FakeResult
}

/** Plans every query holdVenue makes, in the order each table is touched. */
function plan({ event = APPROVED_EVENT, existingHold = null, lapsedHoldIds = [], booking, claims, conflicts }: HoldPlan = {}) {
  const hasLapsed = lapsedHoldIds.length > 0
  fake.plan('events', { data: event })
  fake.plan('time_slots', { data: SLOT_ROWS })
  // venue_bookings: one-active-hold check, lapsed-hold lookup, (expiring them), the new hold.
  fake.plan('venue_bookings',
    { data: existingHold },
    { data: lapsedHoldIds.map((id) => ({ id })) },
    ...(hasLapsed ? [{} as FakeResult] : []),
    booking ?? { data: { id: BOOKING_ID } },
  )
  // venue_slot_claims: (freeing lapsed cells), the new claims, then the conflict lookup.
  fake.plan('venue_slot_claims',
    ...(hasLapsed ? [{} as FakeResult] : []),
    claims ?? {},
    conflicts ?? { data: [] },
  )
}

interface ClaimRow { venue_id: string; slot_date: string; slot: string; kind: string; booking_id: string }
const insertedClaims = (): ClaimRow[] =>
  (fake.callsTo('venue_slot_claims', 'insert')[0]?.[0] as ClaimRow[] | undefined) ?? []
const cellsOfKind = (kind: 'event' | 'buffer') =>
  insertedClaims().filter((row) => row.kind === kind).map((row) => `${row.slot_date} ${row.slot}`)
const bookingInsert = () =>
  fake.callsTo('venue_bookings', 'insert')[0]?.[0] as Record<string, unknown> | undefined

beforeEach(() => {
  vi.resetAllMocks()
  fake.reset()
  mocks.from.mockImplementation(fake.route)
  mocks.getUser.mockResolvedValue({ data: { user: { id: COORDINATOR_ID } }, error: null })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AC-009.1 / AC-010.1 — hold a venue for an approved event you manage', () => {
  test('AC-009.1.5: places a three-day hold naming the event, venue and signed-in coordinator', async () => {
    plan()
    expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: true, bookingId: BOOKING_ID })
    expect(bookingInsert()).toEqual({
      event_id: EVENT_ID, venue_id: VENUE_ID, requested_by: COORDINATOR_ID,
      status: 'held', hold_expires_at: '2026-10-08T04:00:00.000Z',
    })
  })
  test('AC-009.1.6: a signed-out user cannot hold, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.notSignedIn, conflicts: [] })
    expect(fake.tablesTouched()).toEqual([])
  })
  test('AC-009.1.7: an expired session cannot hold', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: COORDINATOR_ID } }, error: { message: 'Expired' } })
    expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(false)
    expect(fake.tablesTouched()).toEqual([])
  })
  test('AC-009.1.8: an event that cannot be found, or is hidden by RLS, creates nothing', async () => {
    plan({ event: null })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.eventNotFound, conflicts: [] })
    expect(fake.tablesTouched()).toEqual(['events'])
  })
  test('AC-009.1.9: an event assigned to someone else is refused before anything is written', async () => {
    plan({ event: eventWith({ coordinator_id: 'someone-else' }) })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.notYourEvent, conflicts: [] })
    expect(fake.tablesTouched()).toEqual(['events'])
  })
  test('AC-009.1.10: an event with no coordinator assigned is refused', async () => {
    plan({ event: eventWith({ coordinator_id: null }) })
    expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(false)
  })
  test.each(['draft', 'submitted', 'under_review', 'confirmed', 'completed', 'cancelled', 'rejected'])(
    'AC-009.1.11: an event whose status is %s cannot be booked', async (status) => {
      plan({ event: eventWith({ status }) })
      expect(await holdVenue(EVENT_ID, VENUE_ID))
        .toEqual({ ok: false, reason: messages.eventNotBookable, conflicts: [] })
      expect(fake.tablesTouched()).toEqual(['events'])
    },
  )
  test.each(['approved', 'planning'])('AC-009.1.12: an event whose status is %s may be booked', async (status) => {
    plan({ event: eventWith({ status }) })
    expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(true)
  })
  test('AC-009.1.13: an RLS refusal on the booking row claims no cells and needs no rollback', async () => {
    plan({ booking: { error: { code: '42501' } } })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.rlsDenied, conflicts: [] })
    expect(fake.callsTo('venue_slot_claims', 'insert')).toHaveLength(0)
    expect(fake.callsTo('venue_bookings', 'delete')).toHaveLength(0)
  })
  test('AC-009.1.14: an unknown venue is reported as such', async () => {
    plan({ booking: { error: { code: '23503' } } })
    expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(false)
  })
})

describe('AC-010.4 — one active hold per event', () => {
  test('AC-010.4.1: a second hold is refused while the event already has one', async () => {
    plan({ existingHold: { id: 'existing-hold' } })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.alreadyHeld, conflicts: [] })
    expect(fake.callsTo('venue_bookings', 'insert')).toHaveLength(0)
  })
  test('AC-010.4.2: the check looks for this event’s active holds only, not every live booking', async () => {
    plan({ existingHold: { id: 'existing-hold' } })
    await holdVenue(EVENT_ID, VENUE_ID)
    const check = fake.queryThatCalled('venue_bookings', 'in')
    expect(check?.eq).toHaveBeenCalledWith('event_id', EVENT_ID)
    expect(check?.in).toHaveBeenCalledWith('status', ['held', 'pending_approval'])
  })
})

describe('AC-009.2 — slots come from the event and are consumed in full', () => {
  test('AC-009.2.16: a morning event claims AM as its event slot', async () => {
    plan()
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(cellsOfKind('event')).toEqual(['2026-10-12 AM'])
  })
  test('AC-009.2.17: a full-day event claims all three slots', async () => {
    plan({ event: eventWith({
      proposed_start: sgt('2026-10-12', '08:00'), proposed_end: sgt('2026-10-12', '21:00'),
    }) })
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(cellsOfKind('event')).toEqual(['2026-10-12 AM', '2026-10-12 PM', '2026-10-12 NIGHT'])
  })
  test.each([
    ['AC-009.2.18', { proposed_start: null, proposed_end: null }],
    ['AC-009.2.19', { proposed_start: sgt('2026-10-12', '09:00'), proposed_end: null }],
  ])('%s: an event missing a start or end cannot be booked', async (_id, times) => {
    plan({ event: eventWith(times) })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.noEventTimes, conflicts: [] })
    expect(fake.callsTo('venue_bookings', 'insert')).toHaveLength(0)
  })
  test('AC-009.2.20: an event falling between slots is refused and books nothing', async () => {
    plan({ event: eventWith({
      proposed_start: sgt('2026-10-12', '12:15'), proposed_end: sgt('2026-10-12', '12:45'),
    }) })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.outsideSlots, conflicts: [] })
    expect(fake.callsTo('venue_bookings', 'insert')).toHaveLength(0)
  })
  test('AC-009.2.21: slot definitions are read from time_slots in order', async () => {
    fake.plan('time_slots', { data: SLOT_ROWS })
    expect(await loadTimeSlots()).toEqual([
      { code: 'AM', startsAt: '07:00:00', endsAt: '12:00:00', sortOrder: 1 },
      { code: 'PM', startsAt: '13:00:00', endsAt: '18:00:00', sortOrder: 2 },
      { code: 'NIGHT', startsAt: '19:00:00', endsAt: '24:00:00', sortOrder: 3 },
    ])
    expect(fake.callsTo('time_slots', 'order')).toEqual([['sort_order']])
  })
  test('AC-009.2.22: slot definitions that fail to load come back empty and are logged', async () => {
    fake.plan('time_slots', { error: { message: 'down' } })
    expect(await loadTimeSlots()).toEqual([])
    expect(console.error).toHaveBeenCalled()
  })
})

describe('AC-009.3 — attendance and layout stay on the event record', () => {
  test('AC-009.3.1: the booking row holds references only; nothing is copied or re-entered', async () => {
    plan()
    await holdVenue(EVENT_ID, VENUE_ID)
    const row = bookingInsert()
    expect(row).toHaveProperty('event_id', EVENT_ID)
    expect(row).not.toHaveProperty('expected_attendance')
    expect(row).not.toHaveProperty('layout')
    expect(row).not.toHaveProperty('layout_preference')
  })
  test('AC-009.3.2: the event is read once, by id', async () => {
    plan()
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(fake.callsTo('events', 'select')).toHaveLength(1)
    expect(fake.callsTo('events', 'eq')).toEqual([['id', EVENT_ID]])
  })
})

describe('AC-009.5 / AC-010.3 — setup and turnaround slots are held too', () => {
  test('AC-009.5.14: a morning booking also holds the previous night and the same afternoon', async () => {
    plan()
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(cellsOfKind('buffer')).toEqual(['2026-10-11 NIGHT', '2026-10-12 PM'])
  })
  test('AC-009.5.15: every cell is written in one statement, each tagged with its kind', async () => {
    plan()
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(fake.callsTo('venue_slot_claims', 'insert')).toHaveLength(1)
    expect(insertedClaims()).toEqual([
      { venue_id: VENUE_ID, slot_date: '2026-10-11', slot: 'NIGHT', kind: 'buffer', booking_id: BOOKING_ID },
      { venue_id: VENUE_ID, slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: BOOKING_ID },
      { venue_id: VENUE_ID, slot_date: '2026-10-12', slot: 'PM', kind: 'buffer', booking_id: BOOKING_ID },
    ])
  })
})

// The guarantee itself is the primary key on venue_slot_claims. These prove what the service
// does when the database refuses; a SQL test in backend/ must prove the refusal happens.
describe('AC-009.6 / AC-010.2 — a clashing hold is refused', () => {
  test('AC-009.6.1: a clash on any cell refuses the whole hold', async () => {
    plan({ claims: { error: { code: '23505' } } })
    const result = await holdVenue(EVENT_ID, VENUE_ID)
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.reason).toContain('not available')
  })
  test('AC-009.6.2: the booking row created for a refused attempt is removed', async () => {
    plan({ claims: { error: { code: '23505' } } })
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(fake.queryThatCalled('venue_bookings', 'delete')?.eq.mock.calls).toEqual([['id', BOOKING_ID]])
  })
  test('AC-009.6.3: an RLS refusal while claiming cells is reported and rolled back', async () => {
    plan({ claims: { error: { code: '42501' } } })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.rlsDenied, conflicts: [] })
    expect(fake.callsTo('venue_bookings', 'delete')).toHaveLength(1)
  })
  test('AC-010.6.9: lapsed holds are swept, cells first, before the new hold is placed', async () => {
    plan({ lapsedHoldIds: ['old-1', 'old-2'] })
    await holdVenue(EVENT_ID, VENUE_ID)
    const freed = fake.queryThatCalled('venue_slot_claims', 'delete')
    const expired = fake.queryThatCalled('venue_bookings', 'update')
    expect(freed?.in).toHaveBeenCalledWith('booking_id', ['old-1', 'old-2'])
    expect(expired?.update).toHaveBeenCalledWith({ status: 'expired' })
    expect(callOrder(freed, 'delete')).toBeLessThan(callOrder(expired, 'update'))
  })
  test('AC-010.6.10: only this venue’s lapsed holds are swept', async () => {
    plan({ lapsedHoldIds: ['old-1'] })
    await holdVenue(EVENT_ID, VENUE_ID)
    const lookup = fake.queryThatCalled('venue_bookings', 'lt')
    expect(lookup?.eq.mock.calls).toEqual([['venue_id', VENUE_ID], ['status', 'held']])
    expect(lookup?.lt).toHaveBeenCalledWith('hold_expires_at', NOW)
  })
  test('AC-010.6.11: with no lapsed holds, no clean-up is written', async () => {
    plan()
    await holdVenue(EVENT_ID, VENUE_ID)
    expect(fake.callsTo('venue_bookings', 'update')).toHaveLength(0)
    expect(fake.callsTo('venue_slot_claims', 'delete')).toHaveLength(0)
  })
  test('AC-009.6.4: an unrecognised database error is generic to the user and logged', async () => {
    plan({ booking: { error: { code: 'XX000', message: 'private details' } } })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.unexpected, conflicts: [] })
    expect(console.error).toHaveBeenCalled()
  })
})

describe('AC-009.7 — the refusal names which slot clashes and why', () => {
  // The booking needs 2026-10-11 NIGHT (setup), 2026-10-12 AM (event), 2026-10-12 PM (turnaround).
  const refusedWith = (rows: unknown[]) =>
    plan({ claims: { error: { code: '23505' } }, conflicts: { data: rows } })

  test('AC-009.7.6: only the cells this booking needed are reported', async () => {
    refusedWith([
      { slot_date: '2026-10-12', slot: 'PM', kind: 'buffer' },
      { slot_date: '2026-10-13', slot: 'AM', kind: 'event' }, // outside this booking's cells
    ])
    const result = await holdVenue(EVENT_ID, VENUE_ID)
    expect(result.ok ? [] : result.conflicts).toEqual([{ date: '2026-10-12', slot: 'PM', kind: 'buffer' }])
  })
  test('AC-009.7.7: the message names the date, the slot and the reason', async () => {
    refusedWith([{ slot_date: '2026-10-12', slot: 'PM', kind: 'buffer' }])
    const result = await holdVenue(EVENT_ID, VENUE_ID)
    const reason = result.ok ? '' : result.reason
    expect(reason).toContain('12 Oct 2026 (PM)')
    expect(reason).toContain('setup or turnaround')
  })
  test.each([
    ['AC-009.7.8', 'event', 'already booked'],
    ['AC-009.7.9', 'maintenance', 'blocked by Venue Staff'],
  ])('%s: a %s clash is explained as “%s”', async (_id, kind, why) => {
    refusedWith([{ slot_date: '2026-10-12', slot: 'AM', kind }])
    const result = await holdVenue(EVENT_ID, VENUE_ID)
    expect(result.ok ? '' : result.reason).toContain(why)
  })
  test('AC-009.7.10: if the clash lookup itself fails, the general refusal still stands', async () => {
    plan({ claims: { error: { code: '23505' } }, conflicts: { error: { message: 'down' } } })
    expect(await holdVenue(EVENT_ID, VENUE_ID))
      .toEqual({ ok: false, reason: messages.unavailable, conflicts: [] })
  })
})

describe('AC-009.4 / AC-010.7 — submit a hold for Venue Staff review', () => {
  test('AC-009.4.1: a live hold of the coordinator’s own moves to pending_approval', async () => {
    fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
    expect(await submitVenueBooking(BOOKING_ID)).toEqual({ ok: true })
    const update = fake.queryThatCalled('venue_bookings', 'update')
    expect(update?.update).toHaveBeenCalledWith({ status: 'pending_approval' })
    expect(update?.eq.mock.calls).toEqual([
      ['id', BOOKING_ID], ['status', 'held'],
    ])
    expect(update?.gt).toHaveBeenCalledWith('hold_expires_at', NOW)
  })
  test('AC-010.7.1: submitting frees no cells — the slots stay held while review is pending', async () => {
    fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
    await submitVenueBooking(BOOKING_ID)
    expect(fake.tablesTouched()).toEqual(['venue_bookings'])
  })
  test('AC-009.4.2: a hold that expired, was released, or belongs to someone else is refused', async () => {
    fake.plan('venue_bookings', { data: null })
    expect(await submitVenueBooking(BOOKING_ID)).toEqual({ ok: false, reason: messages.notSubmittable })
  })
  test('AC-009.4.3: a signed-out user cannot submit, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await submitVenueBooking(BOOKING_ID)).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(fake.tablesTouched()).toEqual([])
  })
  test('AC-009.4.4: an RLS refusal is reported', async () => {
    fake.plan('venue_bookings', { error: { code: '42501' } })
    expect(await submitVenueBooking(BOOKING_ID)).toEqual({ ok: false, reason: messages.rlsDenied })
  })
})

describe('AC-010.8 — releasing a hold returns its slots immediately', () => {
  test('AC-010.8.4: the booking is cancelled first, then its cells are freed', async () => {
    fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
    expect(await releaseHold(BOOKING_ID)).toEqual({ ok: true })
    const update = fake.queryThatCalled('venue_bookings', 'update')
    const freed = fake.queryThatCalled('venue_slot_claims', 'delete')
    expect(update?.update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(update?.in).toHaveBeenCalledWith('status', ['held', 'pending_approval'])
    expect(freed?.eq).toHaveBeenCalledWith('booking_id', BOOKING_ID)
    expect(callOrder(update, 'update')).toBeLessThan(callOrder(freed, 'delete'))
  })
  test('AC-010.8.5: release targets the booking without excluding an inherited hold', async () => {
    fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
    await releaseHold(BOOKING_ID)
    expect(fake.queryThatCalled('venue_bookings', 'update')?.eq.mock.calls)
      .toEqual([['id', BOOKING_ID]])
  })
  test('AC-010.8.6: a booking that is already confirmed, rejected or released cannot be released', async () => {
    fake.plan('venue_bookings', { data: null })
    expect(await releaseHold(BOOKING_ID)).toEqual({ ok: false, reason: messages.notReleasable })
    expect(fake.callsTo('venue_slot_claims', 'delete')).toHaveLength(0)
  })
  test('AC-010.8.7: a refused release frees no cells, so a live booking is never left claimless', async () => {
    fake.plan('venue_bookings', { error: { code: '42501' } })
    expect(await releaseHold(BOOKING_ID)).toEqual({ ok: false, reason: messages.rlsDenied })
    expect(fake.callsTo('venue_slot_claims', 'delete')).toHaveLength(0)
  })
  test('AC-010.8.8: a signed-out user cannot release, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await releaseHold(BOOKING_ID)).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(fake.tablesTouched()).toEqual([])
  })
})

describe('AC-009.9 — view your requests and their status', () => {
  const ROW = {
    id: BOOKING_ID, venue_id: VENUE_ID, event_id: EVENT_ID, status: 'held',
    hold_expires_at: '2026-10-08T04:00:00+00:00', review_note: null, created_at: '2026-10-05T04:00:00+00:00',
    venues: { name: 'Alpha Hall' }, events: { reference: 'EVT-1', name: 'Gala' },
    venue_slot_claims: [
      { slot_date: '2026-10-12', slot: 'PM', kind: 'buffer' },
      { slot_date: '2026-10-12', slot: 'AM', kind: 'event' },
    ],
  }

  test('AC-009.9.1: lists the coordinator’s own bookings with venue, event, status and slots', async () => {
    fake.plan('venue_bookings', { data: [ROW] })
    expect(await listMyVenueBookings()).toEqual({ ok: true, bookings: [{
      id: BOOKING_ID, venueId: VENUE_ID, venueName: 'Alpha Hall', eventId: EVENT_ID,
      eventReference: 'EVT-1', eventName: 'Gala', status: 'held',
      holdExpiresAt: '2026-10-08T04:00:00+00:00', reviewNote: null, createdAt: '2026-10-05T04:00:00+00:00',
      cells: [
        { date: '2026-10-12', slot: 'AM', kind: 'event' },
        { date: '2026-10-12', slot: 'PM', kind: 'buffer' },
      ],
    }] })
  })
  test('AC-009.9.2: only this coordinator’s bookings are requested, newest first', async () => {
    fake.plan('venue_bookings', { data: [] })
    await listMyVenueBookings()
    expect(fake.callsTo('venue_bookings', 'eq')).toEqual([['events.coordinator_id', COORDINATOR_ID]])
    expect(String(fake.callsTo('venue_bookings', 'select')[0][0])).toContain('events!inner(')
    expect(fake.callsTo('venue_bookings', 'order')).toEqual([['created_at', { ascending: false }]])
  })
  test('AC-009.9.3: a rejected request shows the Venue Staff note', async () => {
    fake.plan('venue_bookings', { data: [{ ...ROW, status: 'rejected', review_note: 'Clashes with maintenance.' }] })
    expect(await listMyVenueBookings()).toMatchObject({
      ok: true, bookings: [{ status: 'rejected', reviewNote: 'Clashes with maintenance.' }],
    })
  })
  test('AC-010.9.5: the coordinator query includes the saved alternative', async () => {
    fake.plan('venue_bookings', { data: [{ ...ROW, status: 'rejected', review_alternative: 'Try Friday' }] })
    expect(await listMyVenueBookings()).toMatchObject({ ok: true, bookings: [{ reviewAlternative: 'Try Friday' }] })
    expect(String(fake.callsTo('venue_bookings', 'select')[0][0])).toContain('review_alternative')
  })
  test('AC-009.9.4: a failed load is reported, never shown as an empty list, and is logged', async () => {
    fake.plan('venue_bookings', { error: { message: 'down' } })
    expect(await listMyVenueBookings()).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalled()
  })
  test('AC-009.9.5: an assigned booking whose venue cannot be read still appears', async () => {
    fake.plan('venue_bookings', { data: [{ ...ROW, venues: null, venue_slot_claims: null }] })
    expect(await listMyVenueBookings()).toMatchObject({
      ok: true, bookings: [{ venueName: '', eventReference: 'EVT-1', eventName: 'Gala', cells: [] }],
    })
  })
  test('AC-009.9.6: a signed-out user sees nothing, and nothing is queried', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await listMyVenueBookings()).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(fake.tablesTouched()).toEqual([])
  })
})

describe('AC-009.8 — Venue Staff are notified', () => {
  // A database trigger on venue_bookings owns this, following the change-request pattern in
  // 0016. The client must not insert notification rows, so there is nothing to assert here;
  // the SQL test in backend/ is what proves it.
  test.todo('AC-009.8.1: submitting a request queues a notification for Venue Staff (SQL test)')
})
