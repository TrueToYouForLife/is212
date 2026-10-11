import { beforeEach, expect, test, vi } from 'vitest'
import { getVenueBookingReview, rejectVenueBooking } from '../venueBookingReviewService'
import { BOOKING_ID, createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
const fake = createSupabaseFake()
beforeEach(() => {
  vi.clearAllMocks()
  fake.reset()
  mocks.from.mockImplementation(fake.route)
})

test('AC-010.2.15: successful RPC read preserves event requirements', async () => {
  mocks.rpc.mockResolvedValue({ data: { id: BOOKING_ID, details: { attendance: 120, facilities: ['projector'] } }, error: null })
  expect(await getVenueBookingReview(BOOKING_ID)).toMatchObject({ ok: true, booking: { details: { attendance: 120, facilities: ['projector'] } } })
})
test('AC-010.2.16: permission errors do not expose the server message or booking data', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private server detail' } })
  const result = await getVenueBookingReview(BOOKING_ID)
  expect(result).toMatchObject({ ok: false })
  expect(JSON.stringify(result)).not.toContain('private server detail')
})
test('AC-010.2.17: a missing RPC row is unavailable', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect(await getVenueBookingReview(BOOKING_ID)).toMatchObject({ ok: false })
})
test('AC-010.2.18: an interrupted read is unavailable without automatic retries', async () => {
  mocks.rpc.mockRejectedValue(new Error('Offline'))
  expect(await getVenueBookingReview(BOOKING_ID)).toMatchObject({ ok: false })
  expect(mocks.rpc).toHaveBeenCalledOnce()
})

test('AC-010.8.13: blank rejection reason is refused before a database call', async () => {
  expect(await rejectVenueBooking(BOOKING_ID, ' \n\t ')).toEqual({ ok: false, reason: 'Enter a rejection reason.' })
  expect(mocks.from).not.toHaveBeenCalled()
})

test('AC-010.8.14: rejection saves a trimmed reason using a pending-status guard', async () => {
  fake.plan('venue_bookings', { data: { id: BOOKING_ID }, error: null })
  expect(await rejectVenueBooking(BOOKING_ID, '  Venue unsuitable  ')).toEqual({ ok: true })
  expect(fake.callsTo('venue_bookings', 'update')).toEqual([[expect.objectContaining({ status: 'rejected', review_note: 'Venue unsuitable' })]])
  expect(fake.callsTo('venue_bookings', 'eq')).toEqual([['id', BOOKING_ID], ['status', 'pending_approval']])
  expect(fake.tablesTouched()).toEqual(['venue_bookings'])
})

test('AC-010.9.3: saves a trimmed optional alternative in the same decision update', async () => {
  fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
  expect(await rejectVenueBooking(BOOKING_ID, 'Unavailable', ' Try Friday ')).toEqual({ ok: true })
  expect(fake.callsTo('venue_bookings', 'update')).toEqual([[{
    status: 'rejected', review_note: 'Unavailable', review_alternative: 'Try Friday',
  }]])
})

test('AC-010.9.7: an omitted alternative is stored as null', async () => {
  fake.plan('venue_bookings', { data: { id: BOOKING_ID } })
  await rejectVenueBooking(BOOKING_ID, 'Unavailable')
  expect(fake.callsTo('venue_bookings', 'update')[0][0]).toHaveProperty('review_alternative', null)
})

test('AC-010.12.11: a stale decision affecting no booking is not reported as success', async () => {
  fake.plan('venue_bookings', { data: null })
  expect(await rejectVenueBooking(BOOKING_ID, 'Unavailable')).toMatchObject({ ok: false })
  expect(fake.tablesTouched()).toEqual(['venue_bookings'])
})

test('AC-010.12.12: a database refusal is reported without separate slot deletion', async () => {
  fake.plan('venue_bookings', { error: { code: '42501' } })
  expect(await rejectVenueBooking(BOOKING_ID, 'Unavailable')).toMatchObject({ ok: false })
  expect(fake.tablesTouched()).toEqual(['venue_bookings'])
})

test('AC-010.12.13: an interrupted request is not retried automatically', async () => {
  mocks.from.mockImplementation(() => { throw new Error('Connection lost') })
  expect(await rejectVenueBooking(BOOKING_ID, 'Unavailable')).toMatchObject({ ok: false })
  expect(mocks.from).toHaveBeenCalledOnce()
})

test('AC-010.13.4: review readback uses the saved decision identity, time and alternative', async () => {
  mocks.rpc.mockResolvedValue({ data: {
    id: BOOKING_ID, status: 'rejected', venueName: 'Alpha Hall',
    reviewNote: 'Unavailable', reviewAlternative: 'Try Friday',
    reviewedBy: 'staff-1', reviewedAt: '2030-10-10T02:00:00Z',
  } })
  expect(await getVenueBookingReview(BOOKING_ID)).toEqual({ ok: true, booking: {
    id: BOOKING_ID, status: 'rejected', venueName: 'Alpha Hall',
    reviewNote: 'Unavailable', reviewAlternative: 'Try Friday',
    reviewedBy: 'staff-1', reviewedAt: '2030-10-10T02:00:00Z',
  } })
  expect(mocks.rpc).toHaveBeenCalledWith('get_venue_booking_review', { p_booking_id: BOOKING_ID })
})
