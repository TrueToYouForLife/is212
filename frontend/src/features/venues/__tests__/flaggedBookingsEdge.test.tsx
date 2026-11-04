import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { FlaggedBookingsPage } from '../pages/FlaggedBookingsPage'

const mocks = vi.hoisted(() => ({ loading: false, list: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.loading, profile: mocks.loading ? null : { id: 'coordinator-1', role: 'coordinator' } }),
}))
vi.mock('../venueAlertService', () => ({ listMyFlaggedBookings: mocks.list }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loading = false
})

describe('AC-012.8 — coordinators see the bookings a venue closure affects', () => {
  test('AC-012.8.23: while the session is loading the page shows nothing yet', () => {
    mocks.loading = true
    const { container } = render(<MemoryRouter><FlaggedBookingsPage /></MemoryRouter>)
    expect(container).toBeEmptyDOMElement()
  })

  test('AC-012.8.24: a flag whose event has no reference or name is still listed, with plain placeholders', async () => {
    mocks.list.mockResolvedValue({ ok: true, value: [{
      id: 'flag-1', bookingId: 'b-1', eventId: 'e-1', eventReference: null, eventName: null, venueName: 'Second Hall',
      detail: 'Venue blocked: Ceiling repair', cells: [{ date: '2040-03-10', slot: 'AM', kind: 'event' }],
      createdAt: '2040-01-05T02:00:00+00:00',
    }] })
    render(<MemoryRouter><FlaggedBookingsPage /></MemoryRouter>)
    expect(await screen.findByText('Event')).toBeInTheDocument()
    expect(screen.getByText('Untitled event')).toBeInTheDocument()
  })
})
