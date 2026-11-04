import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueAvailabilityGrid } from '../components/VenueAvailabilityGrid'
import { buildTimetable } from '../venueTimetable'
import { getVenueTimetable } from '../venueTimetableService'
import type { VenueAvailability } from '../venueAvailability'
import { SLOTS, createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))
const fake = createSupabaseFake()

beforeEach(() => {
  vi.resetAllMocks()
  fake.reset()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'coordinator-1' } }, error: null })
  mocks.from.mockImplementation(fake.route)
})

describe('AC-010.5 — the calendar shows every kind of occupancy', () => {
  test('AC-010.5.21: a claim whose booking status did not come back does not occupy its slot', () => {
    const timetable = buildTimetable(SLOTS, [{ slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: 'b-1',
      booking_status: null, event_reference: 'EVT-1', closure_reason: null }], '2026-10-12', 1)
    expect(timetable.days[0][0].state).toBe('free')
  })

  test('AC-010.5.22: when the database returns no rows at all, every slot is free', async () => {
    fake.plan('venue_effective_slot_claims', { data: null })
    const result = await getVenueTimetable('venue-1', SLOTS, '2026-10-12', 1)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.timetable.days[0].every((cell) => cell.state === 'free')).toBe(true)
  })

  test('AC-010.5.23: a venue whose timetable has no days gets an empty group rather than breaking the grid', () => {
    const availability = { dates: [], slots: SLOTS, rows: [{ venue: { id: 'v-1', name: 'Alpha Hall', location: '', status: 'active' },
      timetable: { dates: [], slots: SLOTS, days: [] } }] } as unknown as VenueAvailability
    render(<MemoryRouter><VenueAvailabilityGrid availability={availability} linkVenues={false} /></MemoryRouter>)
    const group = screen.getByTestId('venue-v-1')
    expect(group.querySelectorAll('tr')).toHaveLength(0)
  })
})
