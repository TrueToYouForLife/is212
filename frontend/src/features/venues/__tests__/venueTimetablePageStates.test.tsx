import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueTimetablePage } from '../pages/VenueTimetablePage'
import { QUARTER_HOUR_SLOTS as SLOTS } from '../quarterHourSlots'
import { buildTimetable } from '../venueTimetable'
import { EVENT_ID, VENUE_ID, sgt } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({
  userLoading: false,
  getVenue: vi.fn(), getVenueTimetable: vi.fn(), loadTimeSlots: vi.fn(), listMyAssignedEvents: vi.fn(),
}))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: mocks.userLoading ? null : { id: 'viewer', role: 'coordinator' } }),
}))
vi.mock('../venueTimetableService', () => ({
  getVenue: mocks.getVenue,
  getVenueTimetable: mocks.getVenueTimetable,
  VENUE_TIMETABLE_MESSAGES: { loadFailed: 'Venue availability could not be loaded. Please try again.' },
}))
vi.mock('../venueSearchService', () => ({ listMyAssignedEvents: mocks.listMyAssignedEvents }))
vi.mock('../venueBookingService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../venueBookingService')>()),
  loadTimeSlots: mocks.loadTimeSlots,
}))
vi.mock('../bookingSpaceService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../bookingSpaceService')>()),
  loadSpaceLayouts: async () => [],
}))

const VENUE = {
  id: VENUE_ID, name: 'Alpha Hall', capacity: 200, layout: 'theatre', accessibility: [], facility: {},
  setupMinutes: 15, turnaroundMinutes: 15, status: 'active' as const, location: 'Bras Basah',
}
const EVENT = {
  id: EVENT_ID, reference: 'EVT-1', name: 'Gala',
  proposedStart: sgt('2026-10-12', '09:00'), proposedEnd: sgt('2026-10-12', '11:00'),
  expectedAttendance: 120, layoutPreference: null, accessibilityRequirements: null, equipmentRequirements: null,
}
const TIMETABLE = buildTimetable(SLOTS, [], '2026-10-12', 7)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/venues/${VENUE_ID}/timetable?from=2026-10-12`]}>
      <Routes><Route path="/venues/:id/timetable" element={<VenueTimetablePage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.userLoading = false
  mocks.getVenue.mockResolvedValue({ ok: true, venue: VENUE })
  mocks.getVenueTimetable.mockResolvedValue({ ok: true, timetable: TIMETABLE })
  mocks.loadTimeSlots.mockResolvedValue(SLOTS)
  mocks.listMyAssignedEvents.mockResolvedValue([EVENT])
})
afterEach(() => cleanup())

describe('AC-010.5 — the venue timetable page in its less common states', () => {
  test('AC-010.5.24: while the session is checked the page says so and loads nothing', () => {
    mocks.userLoading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.getVenue).not.toHaveBeenCalled()
  })

  test('AC-010.5.25: events without a reference are listed by name, and without a name by their id', async () => {
    mocks.listMyAssignedEvents.mockResolvedValue([
      { ...EVENT, id: 'evt-named', reference: null, name: 'Spring Gala' },
      { ...EVENT, id: 'evt-bare', reference: null, name: null },
    ])
    renderPage()
    expect(await screen.findByRole('option', { name: 'Spring Gala' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'evt-bare' })).toBeInTheDocument()
  })

  test('AC-010.5.26: an event with no timing cannot be previewed, and the coordinator is told why', async () => {
    mocks.listMyAssignedEvents.mockResolvedValue([{ ...EVENT, proposedStart: null, proposedEnd: null }])
    renderPage()
    await screen.findByRole('option', { name: 'EVT-1' })
    fireEvent.change(screen.getByLabelText('Book for one of your events'), { target: { value: EVENT_ID } })
    expect(await screen.findByText(/The event timing or venue setup\/turnaround durations are invalid/)).toBeInTheDocument()
  })

  test('AC-010.5.27: when the venue itself could not be loaded, choosing an event explains the timing cannot be worked out', async () => {
    mocks.getVenue.mockResolvedValue({ ok: false, reason: 'That venue could not be found.' })
    renderPage()
    await screen.findByRole('option', { name: 'EVT-1' })
    fireEvent.change(screen.getByLabelText('Book for one of your events'), { target: { value: EVENT_ID } })
    expect(await screen.findByText('Booking timing could not be loaded. Please reload.')).toBeInTheDocument()
  })

  test('AC-010.5.28: changing the week reloads the timetable from the new date', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'EVT-1' })
    mocks.getVenueTimetable.mockClear()
    await act(async () => { fireEvent.change(screen.getByLabelText('Week beginning'), { target: { value: '2026-10-19' } }) })
    await vi.waitFor(() => expect(mocks.getVenueTimetable).toHaveBeenCalledWith(VENUE_ID, SLOTS, '2026-10-19', expect.any(Number)))
  })

  test('AC-010.5.29: leaving the page before it has loaded drops the late answers quietly', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.getVenue.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderPage()
    unmount()
    await act(async () => { finish({ ok: true, venue: VENUE }) })
    expect(mocks.getVenueTimetable).not.toHaveBeenCalled()
  })
})
