import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueBookingRejectionForm } from '../components/VenueBookingRejectionForm'
import type { VenueBookingStatus } from '../bookingTypes'

const mocks = vi.hoisted(() => ({ reject: vi.fn(), role: 'venue_staff' }))
vi.mock('../venueBookingReviewService', () => ({ rejectVenueBooking: mocks.reject }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { role: mocks.role } }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.reject.mockResolvedValue({ ok: true })
})

test.each([
  ['AC-010.4.10', 'organiser'], ['AC-010.4.11', 'coordinator'],
  ['AC-010.4.12', 'coordinator_lead'], ['AC-010.4.13', 'operations_manager'],
  ['AC-010.4.14', 'tech_support'], ['AC-010.4.15', 'attendee'], ['AC-010.4.16', ''],
])('%s: %s cannot access the rejection form', (_id, role) => {
  mocks.role = role
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
  expect(mocks.reject).not.toHaveBeenCalled()
})

test('AC-010.8.15: the form requires a nonblank reason before rejection', async () => {
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), '   ')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a rejection reason.')
  expect(mocks.reject).not.toHaveBeenCalled()
})

test('AC-010.8.16: a valid rejection reports success and closes the action', async () => {
  const onRejected = vi.fn()
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={onRejected} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), 'Venue unsuitable')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(mocks.reject).toHaveBeenCalledWith('booking-1', 'Venue unsuitable')
  expect(await screen.findByRole('status')).toHaveTextContent('Booking rejected.')
  expect(onRejected).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
})

test('AC-010.9.4: Venue Staff can suggest an alternative arrangement when rejecting', async () => {
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), 'Unavailable')
  await user.type(screen.getByLabelText('Suggested alternative (optional)'), 'Try Friday')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(mocks.reject).toHaveBeenCalledWith('booking-1', 'Unavailable', 'Try Friday')
})

test.each<[string, VenueBookingStatus]>([
  ['AC-010.12.6', 'confirmed'], ['AC-010.12.7', 'rejected'], ['AC-010.12.8', 'cancelled'],
  ['AC-010.12.9', 'expired'], ['AC-010.12.10', 'held'],
])('%s: a %s booking has no rejection action', (_id, status) => {
  render(<VenueBookingRejectionForm bookingId="booking-1" status={status} onRejected={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Reject booking' })).not.toBeInTheDocument()
})

test('AC-010.12.14: double-clicking while a decision is pending sends it once', async () => {
  let finish!: (result: { ok: true }) => void
  mocks.reject.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), 'Unavailable')
  await user.dblClick(screen.getByRole('button', { name: 'Reject booking' }))
  fireEvent.submit(screen.getByLabelText('Rejection reason').closest('form')!)
  expect(mocks.reject).toHaveBeenCalledOnce()
  await act(async () => finish({ ok: true }))
})

test('AC-010.12.15: an unsuccessful decision preserves the reason and locks retry until reload', async () => {
  mocks.reject.mockResolvedValue({ ok: false, reason: 'Already reviewed. Reload.' })
  const onRejected = vi.fn()
  render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={onRejected} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), 'Unavailable')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Already reviewed. Reload.')
  expect(screen.getByLabelText('Rejection reason')).toHaveValue('Unavailable')
  expect(screen.getByRole('button', { name: 'Reject booking' })).toBeDisabled()
  fireEvent.submit(screen.getByLabelText('Rejection reason').closest('form')!)
  expect(mocks.reject).toHaveBeenCalledOnce()
  expect(onRejected).not.toHaveBeenCalled()
})

test('AC-010.12.17: a response after leaving the form cannot update a different booking page', async () => {
  let finish!: (result: { ok: true }) => void
  mocks.reject.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const onRejected = vi.fn()
  const view = render(<VenueBookingRejectionForm bookingId="booking-1" status="pending_approval" onRejected={onRejected} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Rejection reason'), 'Unavailable')
  await user.click(screen.getByRole('button', { name: 'Reject booking' }))
  view.unmount()
  await act(async () => finish({ ok: true }))
  expect(onRejected).not.toHaveBeenCalled()
})
