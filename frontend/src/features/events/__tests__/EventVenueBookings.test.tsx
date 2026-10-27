import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { EventVenueBookings } from '../components/EventVenueBookings'
const read = vi.hoisted(() => vi.fn())
vi.mock('../eventVenueBookingsService', () => ({ loadEventVenueBookings: read }))
vi.mock('../../../lib/features', () => ({ FEATURES: { venueBooking: true } }))
const row = (status: string, n = 1) => ({ booking_id: `booking-${n}`, venue_name: `Hall ${n}`, status,
  space_layout: 'theatre', space_attendance: 30, review_note: null, review_alternative: null })
beforeEach(() => { read.mockReset() })
test('AC-049.5.30: every booking status is visible with per-space requirements and rejection details', async () => {
  read.mockResolvedValue({ ok: true, value: ['held','pending_approval','confirmed','rejected','cancelled','expired']
    .map((s,i) => ({ ...row(s,i), ...(s === 'rejected' ? { review_note: 'Too small', review_alternative: 'Hall B' } : {}) })) })
  render(<MemoryRouter><EventVenueBookings eventId="e1" /></MemoryRouter>)
  expect(await screen.findByText('Approved')).toBeInTheDocument()
  for (const label of ['Held — not submitted','Awaiting Venue Staff','Rejected','Cancelled','Expired']) expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.getAllByText('Layout: theatre · People: 30')).toHaveLength(6)
  expect(screen.getByText('Decision note: Too small')).toBeInTheDocument()
  expect(screen.getByText('Suggested alternative: Hall B')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Manage venue bookings' })).toHaveAttribute('href','/venues/bookings')
})
test('AC-049.5.31: failed refresh removes stale status and successful retry shows the decision', async () => {
  read.mockResolvedValueOnce({ ok: true, value: [row('pending_approval')] })
    .mockResolvedValueOnce({ ok: false, reason: 'Unavailable' })
    .mockResolvedValue({ ok: true, value: [row('confirmed')] })
  render(<MemoryRouter><EventVenueBookings eventId="e1" /></MemoryRouter>)
  await screen.findByText('Awaiting Venue Staff')
  await userEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable')
  expect(screen.queryByText('Awaiting Venue Staff')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button'))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
})
test('AC-049.5.32: empty event, legacy requirements and event change do not reuse old bookings', async () => {
  read.mockResolvedValueOnce({ ok: true, value: [] }).mockResolvedValue({ ok: true, value: [{ ...row('confirmed'), space_layout: null }] })
  const { rerender } = render(<MemoryRouter><EventVenueBookings eventId="e1" /></MemoryRouter>)
  await screen.findByText('No venue bookings yet.')
  rerender(<MemoryRouter><EventVenueBookings eventId="e2" /></MemoryRouter>)
  await waitFor(() => expect(read).toHaveBeenLastCalledWith('e2'))
  expect(await screen.findByText(/Legacy booking/)).toBeInTheDocument()
})
