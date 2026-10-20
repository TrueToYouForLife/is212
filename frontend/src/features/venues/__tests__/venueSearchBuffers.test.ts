import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }))
import { QUARTER_HOUR_SLOTS } from '../quarterHourSlots'
import { searchVenues } from '../venueSearchService'
import type { VenueSearchFilters } from '../types'
const filters: VenueSearchFilters = { keyword: '', location: '', minAttendance: '', layout: '', accessibility: [], facilities: [], date: '', slot: '', eventId: 'event' }
function query(data: unknown, error: unknown = null) {
  const q: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'order', 'in', 'gte', 'lte', 'maybeSingle']) q[name] = vi.fn(() => q)
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve)
  return q
}
function setup(claimError: unknown = null, event: unknown = { proposed_start: '2047-10-25T10:00:00+08:00', proposed_end: '2047-10-25T12:00:00+08:00' }) {
  const venues = query([0, 30].map(minutes => ({ id: `venue-${minutes}`, name: 'Hall', capacity: 100, layout: 'theatre', accessibility: [], facility: {}, status: 'active', location: 'Test', setup_minutes: minutes, turnaround_minutes: 0 })))
  const claims = query([0, 30].map(minutes => ({ venue_id: `venue-${minutes}`, slot_date: '2047-10-25', slot: 'T0930' })), claimError)
  mocks.from.mockImplementation((table: string) => table === 'venues' ? venues : table === 'events' ? query(event) : claims)
  return { venues, claims }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'coordinator' } }, error: null })
})
test('AC-047.2.26: search uses each venue duration so setup-only occupancy excludes only the buffered venue', async () => {
  const { venues, claims } = setup()
  const result = await searchVenues(filters, [])
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.venues.map(v => v.id)).toEqual(['venue-0'])
  expect(venues.select).toHaveBeenCalledWith(expect.stringContaining('setup_minutes, turnaround_minutes'))
  expect(claims.gte).toHaveBeenCalledWith('slot_date', '2047-10-25')
})
test('AC-047.2.27: unreadable occupancy or incomplete event timing cannot appear as available venues', async () => {
  setup({ message: 'Unavailable' })
  expect((await searchVenues(filters, [])).ok).toBe(false)
  setup(null, { proposed_start: null, proposed_end: null })
  expect((await searchVenues(filters, [])).ok).toBe(false)
})


test('AC-047.2.29: manual quarter-hour search checks venue buffers through the loaded slot window', async () => {
  setup()
  const result = await searchVenues({ ...filters, eventId: '', date: '2047-10-25', slot: 'T1000' }, QUARTER_HOUR_SLOTS)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.venues.map(v => v.id)).toEqual(['venue-0'])
})
