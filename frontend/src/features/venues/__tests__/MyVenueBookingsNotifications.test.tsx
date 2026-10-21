import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { MyVenueBookingsPage } from '../pages/MyVenueBookingsPage'

const replacementMocks = vi.hoisted(() => ({ role: 'coordinator', load: vi.fn().mockResolvedValue({ ok: true, value: { sources: [], venues: [], requests: [] } }) }))
vi.mock('../venueReplacementService', () => ({ getVenueReplacements: replacementMocks.load }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: false, profile: { id: 'c1', role: replacementMocks.role } }) }))
vi.mock('../venueBookingService', () => ({ listMyVenueBookings: vi.fn().mockResolvedValue({ ok: true, bookings: [] }),
  releaseHold: vi.fn(), submitVenueBooking: vi.fn() }))
vi.mock('../venueDecisionNotificationService', () => ({ listVenueDecisionNotifications: vi.fn().mockResolvedValue({
  ok: true, notifications: [{ id: 'n1', booking_id: 'b1', event_id: 'e1', venue_name: 'Hall', event_reference: 'EVT-1',
    decision: 'rejected', reason: 'Unavailable', alternative: 'Try Friday', reviewed_at: '2044-10-12T05:00:00Z' }],
}) }))

test('AC-010.14.32: the coordinator booking page displays delivered decisions even with no active bookings', async () => {
  render(<MemoryRouter><MyVenueBookingsPage /></MemoryRouter>)
  expect(await screen.findByText('Nothing held yet')).toBeInTheDocument()
  expect(await screen.findByText('Booking rejected — Hall')).toBeInTheDocument()
  expect(screen.getByText('Reason: Unavailable')).toBeInTheDocument()
  expect(screen.getByText('Suggested alternative: Try Friday')).toBeInTheDocument()
})

test('AC-020.3.61: coordinator booking page includes replacement history and removes it after role loss', async () => {
  replacementMocks.load.mockClear()
  const view = render(<MemoryRouter><MyVenueBookingsPage /></MemoryRouter>)
  expect(await screen.findByText('No replacement requests.')).toBeInTheDocument()
  expect(replacementMocks.load).toHaveBeenCalledOnce()
  replacementMocks.role = 'organiser'
  view.rerender(<MemoryRouter><MyVenueBookingsPage /></MemoryRouter>)
  expect(screen.queryByText('Venue replacements')).not.toBeInTheDocument()
  expect(replacementMocks.load).toHaveBeenCalledOnce()
  replacementMocks.role = 'coordinator'
})
