import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { VenueBookingConflicts } from '../components/VenueBookingConflicts'
import type { VenueBookingReview } from '../venueBookingReviewService'
const booking: VenueBookingReview = {
  id: 'b1', venueName: 'Hall', status: 'pending_approval', reviewNote: null, reviewAlternative: null,
  reviewedAt: null, reviewedBy: null, conflictCheckAvailable: true,
  requestedCells: [{ date: '2032-10-12', slot: 'PM', kind: 'event' }], conflicts: [],
}
test('AC-010.3.12: displays confirmed event and blocked buffer conflicts with their causes', () => {
  render(<VenueBookingConflicts booking={{ ...booking, conflicts: [
    { date: '2032-10-12', slot: 'PM', kind: 'event', source: 'confirmed_booking', description: 'EVT-20' },
    { date: '2032-10-12', slot: 'NIGHT', kind: 'buffer', source: 'blocked_period', description: 'Maintenance' },
  ] }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('This request has venue conflicts.')
  expect(screen.getByText(/Confirmed booking.*EVT-20/)).toBeInTheDocument()
  expect(screen.getByText(/setup\/turnaround.*Blocked period.*Maintenance/)).toBeInTheDocument()
})
test('AC-010.3.13: successful empty conflict results have an explicit message', () => {
  render(<VenueBookingConflicts booking={booking} />)
  expect(screen.getByText('No confirmed-booking or active-block conflicts found.')).toBeInTheDocument()
})
test('AC-010.3.14: unavailable timing never appears conflict-free', () => {
  render(<VenueBookingConflicts booking={{ ...booking, conflictCheckAvailable: false }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Conflicts cannot be checked')
  expect(screen.queryByText(/No confirmed-booking/)).not.toBeInTheDocument()
})
test('AC-010.3.15: a missing conflict list fails closed', () => {
  render(<VenueBookingConflicts booking={{ ...booking, conflicts: undefined }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Conflicts cannot be checked')
})
test('AC-010.3.16: a missing requested-cell list fails closed', () => {
  render(<VenueBookingConflicts booking={{ ...booking, requestedCells: undefined }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Conflicts cannot be checked')
})
