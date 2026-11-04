import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { VenueBlockPreview } from '../components/VenueBlockPreview'

test('AC-012.7.17: multiple affected bookings are counted and missing event identity is explicit', () => {
  render(<VenueBlockPreview preview={{ existingBlocks: [], affectedBookings: [
    { bookingId: 'one', status: 'confirmed', eventReference: null, eventName: null, cells: [{ date: '2040-03-10', slot: 'T0900', kind: 'buffer' }] },
    { bookingId: 'two', status: 'pending_approval', eventReference: 'EVT-2', eventName: 'Event Two', cells: [] },
  ] }} />)
  expect(screen.getByText(/2 bookings will be flagged/)).toBeInTheDocument()
  expect(screen.getByText('No reference')).toBeInTheDocument()
  expect(screen.getByText(/Untitled event/)).toBeInTheDocument()
  expect(screen.getByText(/setup or turnaround/)).toBeInTheDocument()
  expect(screen.getByText('EVT-2')).toBeInTheDocument()
})
