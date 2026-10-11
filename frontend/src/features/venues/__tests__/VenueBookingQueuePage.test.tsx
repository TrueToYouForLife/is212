import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueBookingQueuePage } from '../pages/VenueBookingQueuePage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), role: 'venue_staff', id: 'u1', loading: false }))
vi.mock('../venueBookingQueueService', () => ({ listPendingVenueBookings: mocks.list }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: mocks.loading, profile: { id: mocks.id, role: mocks.role } }) }))
const show = () => render(<MemoryRouter><VenueBookingQueuePage /></MemoryRouter>)
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'venue_staff'; mocks.id = 'u1'; mocks.loading = false; mocks.list.mockResolvedValue({ ok: true, bookings: [] }) })

test('AC-010.1.5: pending requests link to their existing review page', async () => {
  mocks.list.mockResolvedValue({ ok: true, bookings: [{ id: 'b1', venueName: 'Hall', createdAt: '2030-01-01T02:00:00Z' }] })
  show()
  expect(await screen.findByRole('link', { name: 'Review booking at Hall' })).toHaveAttribute('href', '/venues/bookings/b1/review')
})
test('AC-010.1.6: the queue explicitly identifies the empty boundary', async () => {
  show()
  expect(await screen.findByText('No bookings are awaiting review.')).toBeInTheDocument()
})
test('AC-010.1.7: failed loads show an error and can be retried manually', async () => {
  mocks.list.mockResolvedValueOnce({ ok: false, reason: 'Offline' })
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  expect(screen.queryByText('No bookings are awaiting review.')).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reload requests' }))
  expect(await screen.findByText('No bookings are awaiting review.')).toBeInTheDocument()
})
test('AC-010.1.8: another role neither sees nor loads the staff queue', () => {
  mocks.role = 'coordinator'
  show()
  expect(mocks.list).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Reload requests' })).not.toBeInTheDocument()
})
test('AC-010.1.11: the queue waits until the session has finished loading', () => {
  mocks.loading = true
  show()
  expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  expect(mocks.list).not.toHaveBeenCalled()
})
test('AC-010.1.12: a stale response cannot overwrite a newer staff session queue', async () => {
  let finish!: () => void
  mocks.list.mockReturnValueOnce(new Promise((resolve) => {
    finish = () => resolve({ ok: true, bookings: [{ id: 'old', venueName: 'Old hall', createdAt: '2030-01-01' }] })
  }))
  mocks.list.mockResolvedValue({ ok: true, bookings: [{ id: 'new', venueName: 'New hall', createdAt: '2030-01-01' }] })
  const view = show()
  mocks.id = 'u2'
  view.rerender(<MemoryRouter><VenueBookingQueuePage /></MemoryRouter>)
  expect(await screen.findByText('New hall')).toBeInTheDocument()
  await act(async () => finish())
  expect(screen.getByText('New hall')).toBeInTheDocument()
  expect(screen.queryByText('Old hall')).not.toBeInTheDocument()
})
