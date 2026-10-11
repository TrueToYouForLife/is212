import { beforeEach, expect, test, vi } from 'vitest'
import { listPendingVenueBookings } from '../venueBookingQueueService'
import { createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from } }))
const fake = createSupabaseFake()
beforeEach(() => { vi.clearAllMocks(); fake.reset(); mocks.from.mockImplementation(fake.route) })

test('AC-010.1.1: requests only pending bookings in stable oldest-first order', async () => {
  fake.plan('venue_bookings', { data: [{ id: 'b1', created_at: '2030-01-01', venues: { name: 'Hall' } }] })
  expect(await listPendingVenueBookings()).toEqual({ ok: true, bookings: [{ id: 'b1', createdAt: '2030-01-01', venueName: 'Hall' }] })
  expect(fake.callsTo('venue_bookings', 'eq')).toEqual([['status', 'pending_approval']])
  expect(fake.callsTo('venue_bookings', 'order')).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]])
})
test('AC-010.1.2: no matching requests is a successful empty queue', async () => {
  fake.plan('venue_bookings', { data: [] })
  expect(await listPendingVenueBookings()).toEqual({ ok: true, bookings: [] })
})
test('AC-010.1.3: a failed database read is not presented as an empty queue', async () => {
  fake.plan('venue_bookings', { error: { code: '42501' } })
  expect(await listPendingVenueBookings()).toMatchObject({ ok: false })
})
test('AC-010.1.4: an interrupted request returns a recoverable error', async () => {
  mocks.from.mockImplementation(() => { throw new Error('Offline') })
  expect(await listPendingVenueBookings()).toMatchObject({ ok: false })
})
test('AC-010.1.9: an unreadable venue does not discard its pending booking', async () => {
  fake.plan('venue_bookings', { data: [{ id: 'b1', created_at: '2030-01-01', venues: null }] })
  expect(await listPendingVenueBookings()).toMatchObject({ ok: true, bookings: [{ id: 'b1', venueName: 'Venue unavailable' }] })
})
test('AC-010.1.10: a successful response without rows maps to an empty queue', async () => {
  fake.plan('venue_bookings', { data: null })
  expect(await listPendingVenueBookings()).toEqual({ ok: true, bookings: [] })
})
