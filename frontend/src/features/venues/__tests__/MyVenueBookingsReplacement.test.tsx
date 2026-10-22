import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { MyVenueBookingsPage } from '../pages/MyVenueBookingsPage'
import { replacementFixture, replacementIds as ids } from './venueReplacementFixtures'
const mocks = vi.hoisted(() => ({ load: vi.fn(), bookings: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: false, profile: { id: 'c1', role: 'coordinator' } }) }))
vi.mock('../venueReplacementService', () => ({ getVenueReplacements: mocks.load }))
vi.mock('../venueBookingService', () => ({ listMyVenueBookings: mocks.bookings, releaseHold: vi.fn(), submitVenueBooking: vi.fn() }))
vi.mock('../components/VenueDecisionNotifications', () => ({ VenueDecisionNotifications: () => null }))
const show = () => render(<MemoryRouter><MyVenueBookingsPage /></MemoryRouter>)
beforeEach(() => {
  vi.resetAllMocks()
  const value = structuredClone(replacementFixture); value.requests = []
  mocks.load.mockResolvedValue({ ok: true, value })
  mocks.bookings.mockResolvedValue({ ok: true, bookings: [{ id: ids.source, eventId: ids.event, venueId: ids.target,
    venueName: 'Retired Hall', eventName: 'Workshop', status: 'confirmed', cells: [] }] })
})
test('AC-048.1.2: each affected original shows both reasons and a replacement entry point using one shared context load', async () => {
  show()
  expect(await screen.findByText('Needs replacement')).toBeInTheDocument()
  expect(screen.getByText('Venue blocked: Ceiling unsafe')).toBeInTheDocument()
  expect(screen.getByText('Venue retired: Building closed')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Find replacement' })).toHaveAttribute('href', `/venues/bookings/${ids.source}/replacement`)
  expect(mocks.load).toHaveBeenCalledOnce()
})
test('AC-048.1.3: failed replacement reads show an error instead of false empty eligibility, and manual reload recovers', async () => {
  mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Reviews unavailable' })
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Reviews unavailable')
  expect(screen.queryByText(/No affected bookings/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reload replacements' }))
  expect(await screen.findByText('Needs replacement')).toBeInTheDocument()
})
test('AC-048.5.2: original remains Needs replacement through pending, rejected and withdrawn requests; approval refresh removes it', async () => {
  const pending = structuredClone(replacementFixture); pending.sources = []
  mocks.load.mockResolvedValueOnce({ ok: true, value: pending })
  show()
  expect(await screen.findByText('Needs replacement')).toBeInTheDocument()
  expect(screen.getByText(/Replacement request awaiting Venue Staff/)).toBeInTheDocument()
  // The source list excludes pending proposals; the independent affected list retains the badge.
  for (const status of ['rejected', 'withdrawn'] as const) {
    const value = structuredClone(replacementFixture); value.requests[0].status = status
    mocks.load.mockResolvedValue({ ok: true, value })
    await userEvent.click(screen.getByRole('button', { name: 'Reload replacements' }))
    expect(await screen.findByText('Needs replacement')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Find replacement' })).toBeInTheDocument()
  }
  const value = structuredClone(replacementFixture); value.sources = []; value.affectedBookings = []
  value.requests[0].status = 'approved'; value.requests[0].replacementBookingId = ids.replacement
  mocks.load.mockResolvedValue({ ok: true, value })
  mocks.bookings.mockResolvedValue({ ok: true, bookings: [{ id: ids.source, eventId: ids.event, venueName: 'Retired Hall', status: 'cancelled', cells: [] },
    { id: ids.replacement, eventId: ids.event, venueName: 'Alternative Hall', status: 'confirmed', cells: [] }] })
  await userEvent.click(screen.getByRole('button', { name: 'Reload replacements' }))
  await waitFor(() => expect(screen.queryByText('Needs replacement')).not.toBeInTheDocument())
  expect(await screen.findByText('Released')).toBeInTheDocument()
  expect(screen.getByText(/Replacement booking recorded/)).toHaveTextContent(ids.replacement)
})
