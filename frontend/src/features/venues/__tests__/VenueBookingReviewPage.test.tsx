import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueBookingReviewPage } from '../pages/VenueBookingReviewPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), reject: vi.fn(), role: 'venue_staff' }))
vi.mock('../venueBookingReviewService', () => ({ getVenueBookingReview: mocks.get, rejectVenueBooking: mocks.reject }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({
  loading: false, profile: { id: 'staff-1', role: mocks.role },
}) }))
const BOOKING = {
  id: 'booking-1', venueName: 'Alpha Hall', status: 'rejected', reviewNote: 'Unavailable',
  reviewAlternative: 'Try Friday', reviewedBy: 'staff-1', reviewedAt: '2030-10-10T02:00:00Z',
}
const PENDING = { ...BOOKING, status: 'pending_approval', reviewNote: null,
  reviewAlternative: null, reviewedBy: null, reviewedAt: null }
function show() {
  render(<MemoryRouter initialEntries={['/venues/bookings/booking-1/review']}>
    <Routes><Route path="/venues/bookings/:bookingId/review" element={<VenueBookingReviewPage />} /></Routes>
  </MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.get.mockResolvedValue({ ok: true, booking: BOOKING })
  mocks.reject.mockResolvedValue({ ok: true })
})

test('AC-010.3.17: the routed review displays event details and conflict information together', async () => {
  mocks.get.mockResolvedValue({ ok: true, booking: { ...PENDING,
    details: { eventName: 'Conference', reference: 'EVT-10', startsAt: null, endsAt: null,
      attendance: 120, layoutPreference: null, accessibilityNotes: null, specialArrangements: null,
      requirementsRecorded: false, layout: null, accessibility: [], facilities: [] },
    conflictCheckAvailable: true, requestedCells: [{ date: '2032-10-12', slot: 'PM', kind: 'event' }],
    conflicts: [{ date: '2032-10-12', slot: 'PM', kind: 'event', source: 'blocked_period', description: 'Maintenance' }],
  } })
  show()
  expect(await screen.findByText('Conference')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Venue conflicts' })).toHaveTextContent('Maintenance')
  expect(screen.getByLabelText('Rejection reason')).toBeInTheDocument()
})

test('AC-010.4.17: other roles do not load a staff review page', () => {
  mocks.role = 'coordinator'
  show()
  expect(mocks.get).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
})

test('AC-010.8.17: the routed page rejects a pending booking and reloads the saved record', async () => {
  mocks.get.mockResolvedValueOnce({ ok: true, booking: PENDING })
  show()
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Rejection reason'), 'Unavailable')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(await screen.findByText('Rejected')).toBeInTheDocument()
  expect(mocks.get).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
})

test('AC-010.8.18: a failed read offers reload without a rejection form', async () => {
  mocks.get.mockResolvedValue({ ok: false, reason: 'Booking unavailable.' })
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Booking unavailable.')
  expect(screen.getByRole('button', { name: 'Reload booking' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
})

test('AC-010.12.16: reload after a refused decision reads the final status and removes the form', async () => {
  mocks.get.mockResolvedValueOnce({ ok: true, booking: PENDING })
  mocks.reject.mockResolvedValue({ ok: false, reason: 'Already reviewed. Reload.' })
  show()
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Rejection reason'), 'Unavailable')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Already reviewed.')
  await user.click(screen.getByRole('button', { name: 'Reload booking' }))
  expect(await screen.findByText('Rejected')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
  expect(mocks.reject).toHaveBeenCalledOnce()
})

test('AC-010.13.5: staff see the saved rejection reason, alternative and decision record', async () => {
  show()
  expect(await screen.findByText('Alpha Hall')).toBeInTheDocument()
  expect(screen.getByText('Unavailable')).toBeInTheDocument()
  expect(screen.getByText('Try Friday')).toBeInTheDocument()
  expect(screen.getByText(/staff-1/)).toBeInTheDocument()
  expect(screen.getByText(/2030/)).toBeInTheDocument()
  expect(mocks.get).toHaveBeenCalledWith('booking-1')
})
