import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueDecisionNotifications } from '../components/VenueDecisionNotifications'
const mocks = vi.hoisted(() => ({ list: vi.fn(), role: 'coordinator', id: 'c1', loading: false }))
vi.mock('../venueDecisionNotificationService', () => ({ listVenueDecisionNotifications: mocks.list }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: mocks.loading, profile: { role: mocks.role, id: mocks.id } }) }))
const notice = { id: 'n1', booking_id: 'b1', event_id: 'e1', venue_name: 'Hall', event_reference: 'EVT-1',
  decision: 'confirmed', reason: null, alternative: null, reviewed_at: '2042-10-12T05:00:00Z' }
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = 'coordinator'; mocks.id = 'c1'; mocks.loading = false
  mocks.list.mockResolvedValue({ ok: true, notifications: [notice] })
})
test('AC-010.14.24: coordinator sees approval with venue, event and Singapore decision time', async () => {
  render(<VenueDecisionNotifications />)
  expect(await screen.findByText('Booking approved — Hall')).toBeInTheDocument()
  expect(screen.getByText('EVT-1')).toBeInTheDocument()
  expect(screen.getByText(/12 Oct 2042, 13:00/)).toBeInTheDocument()
})
test('AC-010.14.25: rejection includes its reason and suggested alternative', async () => {
  mocks.list.mockResolvedValue({ ok: true, notifications: [{ ...notice, decision: 'rejected', reason: 'Unavailable', alternative: 'Try Friday' }] })
  render(<VenueDecisionNotifications />)
  expect(await screen.findByText('Booking rejected — Hall')).toBeInTheDocument()
  expect(screen.getByText('Reason: Unavailable')).toBeInTheDocument()
  expect(screen.getByText('Suggested alternative: Try Friday')).toBeInTheDocument()
})
test('AC-010.14.26: a missing reference is explicit and optional alternative is not invented', async () => {
  mocks.list.mockResolvedValue({ ok: true, notifications: [{ ...notice, event_reference: null }] })
  render(<VenueDecisionNotifications />)
  expect(await screen.findByText('Event reference unavailable')).toBeInTheDocument()
  expect(screen.queryByText(/Suggested alternative:/)).not.toBeInTheDocument()
})
test('AC-010.14.27: no decisions has an explicit empty state', async () => {
  mocks.list.mockResolvedValue({ ok: true, notifications: [] })
  render(<VenueDecisionNotifications />)
  expect(await screen.findByText('No booking decision notifications yet.')).toBeInTheDocument()
})
test('AC-010.14.28: a failed read shows an error and manual refresh recovers', async () => {
  mocks.list.mockResolvedValueOnce({ ok: false, reason: 'Could not load.' })
  render(<VenueDecisionNotifications />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load.')
  expect(screen.queryByText('No booking decision notifications yet.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Refresh notifications' }))
  expect(await screen.findByText('Booking approved — Hall')).toBeInTheDocument()
})
test('AC-010.14.29: other roles do not load or display coordinator notifications', () => {
  mocks.role = 'venue_staff'
  render(<VenueDecisionNotifications />)
  expect(mocks.list).not.toHaveBeenCalled()
  expect(screen.queryByText('Booking decision notifications')).not.toBeInTheDocument()
})
test('AC-010.14.30: session loading defers the read', () => {
  mocks.loading = true
  render(<VenueDecisionNotifications />)
  expect(mocks.list).not.toHaveBeenCalled()
})
test('AC-010.14.31: a late response from the previous coordinator cannot replace the current list', async () => {
  let resolve!: (value: unknown) => void
  mocks.list.mockReturnValueOnce(new Promise((r) => { resolve = r }))
  const view = render(<VenueDecisionNotifications />)
  expect(screen.getByRole('button')).toBeDisabled()
  mocks.id = 'c2'
  mocks.list.mockResolvedValue({ ok: true, notifications: [] })
  view.rerender(<VenueDecisionNotifications />)
  expect(await screen.findByText('No booking decision notifications yet.')).toBeInTheDocument()
  await act(async () => resolve({ ok: true, notifications: [notice] }))
  expect(screen.queryByText('EVT-1')).not.toBeInTheDocument()
})
