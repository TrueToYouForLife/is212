import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueBookingApprovalAction } from '../components/VenueBookingApprovalAction'
import type { VenueBookingReview } from '../venueBookingReviewService'
const mocks = vi.hoisted(() => ({ approve: vi.fn(), role: 'venue_staff', loading: false }))
vi.mock('../venueBookingApprovalService', () => ({ approveVenueBooking: mocks.approve }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: mocks.loading, profile: { role: mocks.role } }) }))
const booking: VenueBookingReview = { id: 'booking-1', venueName: 'Hall', status: 'pending_approval',
  reviewNote: null, reviewAlternative: null, reviewedAt: null, reviewedBy: null,
  reviewVersion: 'v1', conflictCheckAvailable: true, conflicts: [] }
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'venue_staff'; mocks.loading = false; mocks.approve.mockResolvedValue({ ok: true }) })

test('AC-010.4.26: a non-staff user cannot access approval', () => {
  mocks.role = 'coordinator'
  render(<VenueBookingApprovalAction booking={booking} onApproved={vi.fn()} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
test('AC-010.4.27: approval waits for session loading', () => {
  mocks.loading = true
  render(<VenueBookingApprovalAction booking={booking} onApproved={vi.fn()} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
test('AC-010.5.17: successful approval notifies the parent and releases its busy state', async () => {
  const saved = vi.fn(); const busy = vi.fn()
  render(<VenueBookingApprovalAction booking={booking} onApproved={saved} onBusyChange={busy} />)
  await userEvent.click(screen.getByRole('button', { name: 'Approve booking' }))
  expect(mocks.approve).toHaveBeenCalledWith('booking-1', 'v1')
  expect(saved).toHaveBeenCalledOnce()
  expect(busy.mock.calls).toEqual([[true], [false]])
})
test('AC-010.6.16: displayed conflicts prevent approval until resolved and reloaded', () => {
  render(<VenueBookingApprovalAction booking={{ ...booking, conflicts: [{ date: '2042-01-01', slot: 'AM', kind: 'buffer', source: 'blocked_period', description: 'Repair' }] }} onApproved={vi.fn()} />)
  expect(screen.getByRole('button')).toBeDisabled()
})
test('AC-010.11.6: missing timing or version prevents approval', () => {
  render(<VenueBookingApprovalAction booking={{ ...booking, reviewVersion: undefined, conflictCheckAvailable: false }} onApproved={vi.fn()} />)
  expect(screen.getByRole('button')).toBeDisabled()
})
test('AC-010.12.21: final booking has no approval action', () => {
  render(<VenueBookingApprovalAction booking={{ ...booking, status: 'confirmed' }} onApproved={vi.fn()} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
test('AC-010.12.22: repeated clicks send one request and failure locks retry until reload', async () => {
  let resolve!: (value: { ok: false; reason: string }) => void
  mocks.approve.mockReturnValue(new Promise((r) => { resolve = r }))
  render(<VenueBookingApprovalAction booking={booking} onApproved={vi.fn()} />)
  await userEvent.dblClick(screen.getByRole('button'))
  expect(mocks.approve).toHaveBeenCalledOnce()
  await act(async () => resolve({ ok: false, reason: 'Reload the changed request.' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Reload')
  expect(screen.getByRole('button')).toBeDisabled()
})
test('AC-010.12.23: leaving the page ignores a late approval response', async () => {
  let resolve!: (value: { ok: true }) => void
  mocks.approve.mockReturnValue(new Promise((r) => { resolve = r }))
  const saved = vi.fn()
  const view = render(<VenueBookingApprovalAction booking={booking} onApproved={saved} />)
  await userEvent.click(screen.getByRole('button'))
  view.unmount()
  await act(async () => resolve({ ok: true }))
  expect(saved).not.toHaveBeenCalled()
})
