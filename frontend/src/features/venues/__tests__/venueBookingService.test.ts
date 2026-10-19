import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  VENUE_BOOKING_MESSAGES as messages, listMyVenueBookings,
  releaseHold, submitVenueBooking,
} from '../venueBookingService'
import {
  BOOKING_ID, COORDINATOR_ID, EVENT_ID, VENUE_ID,
  callOrder, createSupabaseFake,
} from './fixtures/venueBooking'

// AC-009 = Submit venue booking request. AC-010 = Tentative hold.
// Replace both with the real story numbers once the Jira keys are assigned.

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const fake = createSupabaseFake()
const NOW = '2026-10-05T04:00:00.000Z'

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
  /**
   * `notify_venue_staff_of_booking_request()` in 0035 owns this: an AFTER UPDATE trigger
   * on venue_bookings writes venue_booking_notifications in the same transaction as the
   * submission, so a notification cannot be missing for a request that exists.
   *
   * What the client owes that design is the absence of a write path. These cases prove the
   * browser never touches the notification table and never supplies a recipient, which is
   * what makes the trigger the single source of the row. They cannot prove the row is
   * actually written — only a database test can, and AC-009.8 has none yet (see below).
   */
  test('AC-009.8.1: submitting a request writes no notification itself, leaving the trigger to do it', async () => {
    fake.plan('venue_bookings', { data: { id: BOOKING_ID } })

    expect(await submitVenueBooking(BOOKING_ID)).toEqual({ ok: true })

    // venue_bookings and nothing else. A client insert here would mean a request could be
    // submitted with no notification, or a notification with no request.
    expect(fake.tablesTouched()).toEqual(['venue_bookings'])
    expect(fake.tablesTouched()).not.toContain('venue_booking_notifications')
  })

  test('AC-009.8.2: the submission sends only the status, so it cannot name its own recipient', async () => {
    // The trigger resolves recipients from the venue_staff role. If the client could pass a
    // recipient, it could direct or suppress the notification for a request it owns.
    fake.plan('venue_bookings', { data: { id: BOOKING_ID } })

    await submitVenueBooking(BOOKING_ID)

    const update = fake.queryThatCalled('venue_bookings', 'update')
    expect(update?.update).toHaveBeenCalledWith({ status: 'pending_approval' })
    expect(update?.update).toHaveBeenCalledTimes(1)
  })

  test('AC-009.8.3: a refused submission touches nothing, so no notification can be orphaned', async () => {
    // The trigger fires on a successful update. A refusal must not reach the table at all,
    // or Venue Staff would be told about a request that was never submitted.
    fake.plan('venue_bookings', { data: null })

    expect(await submitVenueBooking(BOOKING_ID)).toEqual({ ok: false, reason: messages.notSubmittable })
    expect(fake.tablesTouched()).not.toContain('venue_booking_notifications')
  })

  // STILL OWED: a database test that the trigger writes the row, that it is scoped to
  // venue_staff recipients, and that the browser has no insert grant on the table. The
  // original note here claimed "the SQL test in backend/ is what proves it" — no such test
  // exists in backend/supabase/tests/, so the database half of AC-009.8 is unproven. That
  // is a US9 ticket, not part of this change.
})
