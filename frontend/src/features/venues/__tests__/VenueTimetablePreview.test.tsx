import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueTimetablePage } from '../pages/VenueTimetablePage'
import { QUARTER_HOUR_SLOTS } from '../quarterHourSlots'
vi.mock('../bookingSpaceService', async original => ({ ...await original<typeof import('../bookingSpaceService')>(),
  loadSpaceLayouts: async () => [{ layout: 'theatre', capacity: 100 }] }))

const mocks = vi.hoisted(() => ({ venue: vi.fn(), timetable: vi.fn(), events: vi.fn(), hold: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: false, profile: { role: 'coordinator' } }) }))
vi.mock('../venueTimetableService', () => ({ getVenue: mocks.venue, getVenueTimetable: mocks.timetable }))
vi.mock('../venueSearchService', () => ({ listMyAssignedEvents: mocks.events }))
vi.mock('../venueBookingService', async (original) => ({
  ...await original<typeof import('../venueBookingService')>(),
  loadTimeSlots: async () => QUARTER_HOUR_SLOTS, holdVenue: mocks.hold,
}))
vi.mock('../components/VenueTimetableGrid', () => ({ VenueTimetableGrid: () => <div>Timetable</div> }))

const venue = { id: 'v1', name: 'Hall', setupMinutes: 30, turnaroundMinutes: 15 }
const event = { id: 'e1', reference: 'EVT-1', proposedStart: '2026-10-20T00:00:00+08:00', proposedEnd: '2026-10-20T00:30:00+08:00' }
function open() {
  return render(<MemoryRouter initialEntries={['/venues/v1/timetable']}><Routes>
    <Route path="/venues/:id/timetable" element={<VenueTimetablePage />} />
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.venue.mockResolvedValue({ ok: true, venue })
  mocks.events.mockResolvedValue([event])
  mocks.timetable.mockResolvedValue({ ok: true, timetable: { days: [] } })
})

test('AC-047.2.37: booking preview uses venue durations, shows midnight buffers and navigates to their first date', async () => {
  open()
  fireEvent.change(await screen.findByLabelText('Book for one of your events'), { target: { value: 'e1' } })
  expect(await screen.findByText('Booking time summary')).toBeInTheDocument()
  expect(screen.getByText('19 Oct 2026, 23:30 – 20 Oct 2026, 00:45')).toBeVisible()
  const details = screen.getByText('View occupied 15-minute slots (5)').closest('details')!
  expect(details).not.toHaveAttribute('open')
  expect(screen.getByText('19 Oct 2026 (23:30–23:45)')).not.toBeVisible()
  fireEvent.click(screen.getByText('View occupied 15-minute slots (5)'))
  expect(screen.getAllByText('Setup / turnaround')).toHaveLength(3)
  expect(screen.getAllByText('Event')).toHaveLength(3)
  expect(screen.getByText('20 Oct 2026 (00:30–00:45)')).toBeInTheDocument()
  expect(screen.queryByText('20 Oct 2026 (00:45–01:00)')).not.toBeInTheDocument()
  await screen.findByText('theatre (capacity 100)')
  fireEvent.change(screen.getByLabelText('Layout for this booking'), { target: { value: 'theatre' } })
  fireEvent.change(screen.getByLabelText('People in this space'), { target: { value: '25' } })
  expect(screen.getByRole('button', { name: 'Place tentative hold' })).toBeEnabled()
  await waitFor(() => expect(mocks.timetable).toHaveBeenLastCalledWith('v1', QUARTER_HOUR_SLOTS, '2026-10-19', 7))
})

test('AC-047.2.38: zero buffers show only event cells; invalid durations disable holding with an explanation', async () => {
  mocks.venue.mockResolvedValue({ ok: true, venue: { ...venue, setupMinutes: 0, turnaroundMinutes: 0 } })
  const first = open()
  fireEvent.change(await screen.findByLabelText('Book for one of your events'), { target: { value: 'e1' } })
  expect(screen.getAllByText('Event')).toHaveLength(3)
  expect(screen.queryByText('Setup / turnaround')).not.toBeInTheDocument()
  expect(screen.getAllByText('None')).toHaveLength(2)
  first.unmount()
  mocks.events.mockResolvedValue([{ ...event, proposedStart: '2026-10-20T00:07:00+08:00', proposedEnd: '2026-10-20T00:23:00+08:00' }])
  const partial = open()
  fireEvent.change(await screen.findByLabelText('Book for one of your events'), { target: { value: 'e1' } })
  expect(screen.getAllByText('20 Oct 2026, 00:07 – 20 Oct 2026, 00:23')).toHaveLength(2)
  expect(screen.getByText('Reserved slot range')).toBeVisible()
  expect(screen.getByText('20 Oct 2026, 00:00 – 20 Oct 2026, 00:30')).toBeVisible()
  partial.unmount()
  mocks.venue.mockResolvedValue({ ok: true, venue: { ...venue, setupMinutes: -15 } })
  open()
  fireEvent.change(await screen.findByLabelText('Book for one of your events'), { target: { value: 'e1' } })
  expect(screen.getByRole('alert')).toHaveTextContent('durations are invalid')
  expect(screen.getByRole('button', { name: 'Place tentative hold' })).toBeDisabled()
  expect(mocks.hold).not.toHaveBeenCalled()
})
