import { afterEach, expect, test, vi } from 'vitest'
import { listMyVenueBookings, releaseHold, submitVenueBooking } from '../venueBookingService'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

afterEach(() => vi.resetAllMocks())

test('AC-017.4.3: the new coordinator lists, submits and releases an inherited booking while the previous coordinator cannot', async () => {
  const original = '17500000-0000-0000-0000-000000000003'
  const current = '17500000-0000-0000-0000-000000000004'
  let signedIn = current
  let hasClaim = true
  const event = { id: 'event-17', coordinator_id: current, reference: 'EVT-17', name: 'Transferred event' }
  const booking = {
    id: 'booking-17', event_id: event.id, venue_id: 'venue-17', requested_by: original,
    status: 'held', hold_expires_at: '2099-01-01T00:00:00Z', review_note: null,
    review_alternative: null, created_at: '2026-10-09T00:00:00Z',
    venues: { name: 'Hall' }, events: event,
    venue_slot_claims: [{ slot_date: '2030-01-01', slot: 'AM', kind: 'event' }],
  }
  mocks.getUser.mockImplementation(async () => ({ data: { user: { id: signedIn } }, error: null }))

  // Small service boundary stub: reads honour query filters; writes model the
  // current-assignee database contract tested against real PostgreSQL in .4.2.
  // Keeping requested_by different from coordinator_id exposes obsolete filters.
  mocks.from.mockImplementation((table: string) => {
    const filters: ((row: Record<string, unknown>) => boolean)[] = []
    let update: Record<string, unknown> | undefined
    let deleting = false
    const value = (row: Record<string, unknown>, key: string): unknown =>
      key.split('.').reduce<unknown>((part, name) =>
        part && typeof part === 'object' ? (part as Record<string, unknown>)[name] : undefined, row)
    const result = () => {
      const rows: Record<string, unknown>[] = table === 'events' ? [event]
        : table === 'venue_bookings' ? [booking]
          : table === 'venue_slot_claims' && hasClaim ? [{ booking_id: booking.id }] : []
      let matched = rows.filter((row) => filters.every((filter) => filter(row)))
      if (update || deleting) {
        if (signedIn !== current) matched = []
        if (matched.length && update) Object.assign(booking, update)
        if (matched.length && deleting) hasClaim = false
      }
      return { data: matched, error: null }
    }
    const query = {
      select: () => query,
      order: () => query,
      eq: (key: string, expected: unknown) => {
        filters.push((row) => value(row, key) === expected)
        return query
      },
      in: (key: string, expected: unknown[]) => {
        filters.push((row) => expected.includes(value(row, key)))
        return query
      },
      gt: (key: string, expected: string) => {
        filters.push((row) => String(value(row, key)) > expected)
        return query
      },
      update: (changes: Record<string, unknown>) => { update = changes; return query },
      delete: () => { deleting = true; return query },
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data[0] ?? null } },
      then: (resolve: (response: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    }
    return query
  })

  const listed = await listMyVenueBookings()
  expect(listed.ok).toBe(true)
  if (!listed.ok) throw new Error(listed.reason)
  expect(listed.bookings.map((item) => item.id)).toEqual([booking.id])

  signedIn = original
  expect(await listMyVenueBookings()).toEqual({ ok: true, bookings: [] })
  expect((await submitVenueBooking(booking.id)).ok).toBe(false)
  expect((await releaseHold(booking.id)).ok).toBe(false)
  expect(booking.status).toBe('held')
  expect(hasClaim).toBe(true)

  signedIn = current
  expect(await submitVenueBooking(booking.id)).toEqual({ ok: true })
  expect(booking.status).toBe('pending_approval')
  expect(hasClaim).toBe(true)
  expect(await releaseHold(booking.id)).toEqual({ ok: true })
  expect(booking.status).toBe('cancelled')
  expect(hasClaim).toBe(false)
  expect(booking.requested_by).toBe(original)
})
