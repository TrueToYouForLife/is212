import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { MyVenueBookingsPage } from '../pages/MyVenueBookingsPage'

vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: false, profile: { id: 'c1', role: 'coordinator' } }) }))
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
