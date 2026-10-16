import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueSearchPage } from '../pages/VenueSearchPage'
import type { VenueSearchFilters } from '../types'

const mocks = vi.hoisted(() => ({ search: vi.fn(), assess: vi.fn() }))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'coordinator-1', role: 'coordinator' } }),
}))
vi.mock('../../../lib/features', () => ({ FEATURES: { venueSuitability: true, venueBlocks: false } }))
vi.mock('../venueSearchService', () => ({ searchVenues: mocks.search, listMyAssignedEvents: async () => [] }))
vi.mock('../venueBookingService', () => ({ loadTimeSlots: async () => [] }))
vi.mock('../suitabilityService', () => ({ assessVenuesForEvent: mocks.assess }))
// The real filters are US8's; these two buttons stand in for "pick my event" and "Search".
vi.mock('../components/VenueFilters', () => ({
  VenueFilters: ({ filters, onChange, onSearch }: {
    filters: VenueSearchFilters
    onChange: (next: VenueSearchFilters) => void
    onSearch: () => void
  }) => (
    <div>
      <button type="button" onClick={() => onChange({ ...filters, eventId: 'event-1' })}>Use my event</button>
      <button type="button" onClick={onSearch}>Search</button>
    </div>
  ),
}))

const HALL = {
  id: 'v-hall', name: 'Main Hall', capacity: 200, layout: 'theatre',
  accessibility: [], facility: {}, status: 'active', location: 'Level 2',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.search.mockResolvedValue({ ok: true, venues: [HALL] })
  mocks.assess.mockResolvedValue({
    ok: true,
    value: [{
      venue: { id: 'v-hall', name: 'Main Hall', location: 'Level 2', status: 'active', layouts: [], accessibility: [], facility: {} },
      verdict: 'unsuitable',
      reasons: [{ code: 'facility', message: 'Missing facilities: Projector.' }],
      fittingLayouts: [],
    }],
  })
})

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test("AC-018.1.34: searching for one of your events shows each result's verdict for it", async () => {
    render(<MemoryRouter><VenueSearchPage /></MemoryRouter>)
    await screen.findByText('Main Hall')
    fireEvent.click(screen.getByRole('button', { name: 'Use my event' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Unsuitable for this event')).toBeInTheDocument()
    expect(mocks.assess).toHaveBeenCalledWith('event-1', [], ['v-hall'])
  })

  test('AC-018.1.35: a search not tied to an event does not check suitability', async () => {
    render(<MemoryRouter><VenueSearchPage /></MemoryRouter>)
    await screen.findByText('Main Hall')
    expect(mocks.assess).not.toHaveBeenCalled()
    expect(screen.queryByText(/for this event/)).not.toBeInTheDocument()
  })
})
