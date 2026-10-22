import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueDetailsPage } from '../pages/VenueDetailsPage'
import { VenueTimetablePage } from '../pages/VenueTimetablePage'
import { MyVenueBookingsPage } from '../pages/MyVenueBookingsPage'
import { QUARTER_HOUR_SLOTS as SLOTS } from '../quarterHourSlots'
import { buildTimetable } from '../venueTimetable'
import { BOOKING_ID, EVENT_ID, VENUE_ID, sgt } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({
  role: 'coordinator' as string,
  getVenue: vi.fn(), getVenueTimetable: vi.fn(),
  loadTimeSlots: vi.fn(), listMyAssignedEvents: vi.fn(),
  holdVenue: vi.fn(), listMyVenueBookings: vi.fn(), submitVenueBooking: vi.fn(), releaseHold: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../venueTimetableService', () => ({
  getVenue: mocks.getVenue,
  getVenueTimetable: mocks.getVenueTimetable,
  VENUE_TIMETABLE_MESSAGES: { loadFailed: 'Venue availability could not be loaded. Please try again.' },
}))
vi.mock('../venueSearchService', () => ({ listMyAssignedEvents: mocks.listMyAssignedEvents }))
vi.mock('../venueBookingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../venueBookingService')>()
  return {
    ...actual,
    loadTimeSlots: mocks.loadTimeSlots,
    holdVenue: mocks.holdVenue,
    listMyVenueBookings: mocks.listMyVenueBookings,
    submitVenueBooking: mocks.submitVenueBooking,
    releaseHold: mocks.releaseHold,
  }
})

test('AC-010.9.6: the coordinator sees the suggested alternative on a rejected booking', async () => {
  mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [{
    id: BOOKING_ID, venueId: VENUE_ID, venueName: 'Alpha Hall', eventId: EVENT_ID,
    eventReference: 'EVT-1', status: 'rejected', reviewNote: 'Unavailable',
    reviewAlternative: 'Try Friday', cells: [],
  }] })
  renderAt('/venues/bookings', '/venues/bookings', <MyVenueBookingsPage />)
  expect(await screen.findByText(/Try Friday/)).toBeInTheDocument()
})

const VENUE = {
  id: VENUE_ID, name: 'Alpha Hall', capacity: 200, layout: 'theatre',
  accessibility: ['wheelchair_access'], facility: { projector: true, microphone: 4 },
  setupMinutes: 15, turnaroundMinutes: 15, status: 'active' as const, location: 'Bras Basah',
}

const ASSIGNED_EVENT = {
  id: EVENT_ID, reference: 'EVT-1', name: 'Gala',
  proposedStart: sgt('2026-10-12', '09:00'), proposedEnd: sgt('2026-10-12', '11:00'),
  expectedAttendance: 120, layoutPreference: 'Theatre', accessibilityRequirements: null,
  equipmentRequirements: null,
}

const EMPTY_TIMETABLE = buildTimetable(SLOTS, [], '2026-10-12', 7)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'coordinator'
  mocks.getVenue.mockResolvedValue({ ok: true, venue: VENUE })
  mocks.getVenueTimetable.mockResolvedValue({ ok: true, timetable: EMPTY_TIMETABLE })
  mocks.loadTimeSlots.mockResolvedValue(SLOTS)
  mocks.listMyAssignedEvents.mockResolvedValue([ASSIGNED_EVENT])
  mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [] })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T04:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** userEvent needs its own timer hook when fake timers are installed. */
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

function renderAt(path: string, routePath: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={routePath} element={element} /></Routes>
    </MemoryRouter>,
  )
}

describe('VenueDetailsPage — AC-009.1', () => {
  const show = (search = '') =>
    renderAt(`/venues/${VENUE_ID}${search}`, '/venues/:id', <VenueDetailsPage />)

  test('AC-009.1.19: shows the venue’s characteristics, with facility counts spelled out', async () => {
    show()
    expect(await screen.findByRole('heading', { name: 'Alpha Hall' })).toBeInTheDocument()
    expect(screen.getByText('Bras Basah')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('Wheelchair access')).toBeInTheDocument()
    expect(screen.getByText('Projector, Microphone (4)')).toBeInTheDocument()
  })
  test('AC-009.1.20: offers a way through to the timetable', async () => {
    show()
    const link = await screen.findByRole('link', { name: /View timetable/ })
    expect(link).toHaveAttribute('href', `/venues/${VENUE_ID}/timetable`)
  })
  test('AC-009.1.21: the event being searched for is carried through to the timetable', async () => {
    show(`?eventId=${EVENT_ID}`)
    const link = await screen.findByRole('link', { name: /View timetable/ })
    expect(link).toHaveAttribute('href', `/venues/${VENUE_ID}/timetable?eventId=${EVENT_ID}`)
  })
  test('AC-009.1.22: a venue under maintenance is flagged before a coordinator plans around it', async () => {
    mocks.getVenue.mockResolvedValue({ ok: true, venue: { ...VENUE, status: 'under_maintenance' } })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('under maintenance')
  })
  test('AC-009.1.23: a venue that cannot be loaded shows why, with a way back', async () => {
    mocks.getVenue.mockResolvedValue({ ok: false, reason: 'That venue could not be found.' })
    show()
    expect(await screen.findByText('That venue could not be found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to venue search' })).toBeInTheDocument()
  })
  test('AC-009.1.24: a non-coordinator sees nothing and the venue is never fetched', async () => {
    mocks.role = 'organiser'
    show()
    expect(await screen.findByText(/available to event coordinators/)).toBeInTheDocument()
    expect(mocks.getVenue).not.toHaveBeenCalled()
  })
})

describe('VenueTimetablePage — AC-009.2 / AC-011.1', () => {
  const show = (search = '') =>
    renderAt(`/venues/${VENUE_ID}/timetable${search}`, '/venues/:id/timetable', <VenueTimetablePage />)

  test('AC-011.5.19: draws the venue’s calendar for the coming week', async () => {
    show()
    expect(await screen.findByRole('columnheader', { name: '12 Oct 2026' })).toBeInTheDocument()
    expect(mocks.getVenueTimetable).toHaveBeenCalledWith(VENUE_ID, SLOTS, expect.any(String), 7)
  })
  test('AC-009.2.24: choosing an event highlights the slots it would take, including setup and turnaround', async () => {
    show()
    await screen.findByLabelText('Book for one of your events')
    await user().selectOptions(screen.getByLabelText('Book for one of your events'), EVENT_ID)
    expect(await screen.findByText('12 Oct 2026 (09:00–09:15)')).toBeInTheDocument()
    expect(screen.getByText('12 Oct 2026 (08:45–09:00)')).toBeInTheDocument()
    expect(screen.getByText('12 Oct 2026 (11:00–11:15)')).toBeInTheDocument()
    expect(screen.getAllByText('Setup / turnaround')).toHaveLength(2)
  })
  test('AC-011.1.1: holding sends the event and venue, and no slots, because the event decides them', async () => {
    mocks.holdVenue.mockResolvedValue({ ok: true, bookingId: BOOKING_ID })
    show(`?eventId=${EVENT_ID}`)
    await user().click(await screen.findByRole('button', { name: 'Place tentative hold' }))
    expect(mocks.holdVenue).toHaveBeenCalledWith(EVENT_ID, VENUE_ID)
  })
  test('AC-011.1.2: a successful hold confirms, says when it expires, and reloads the calendar', async () => {
    mocks.holdVenue.mockResolvedValue({ ok: true, bookingId: BOOKING_ID })
    show(`?eventId=${EVENT_ID}`)
    await user().click(await screen.findByRole('button', { name: 'Place tentative hold' }))
    expect(await screen.findByRole('status')).toHaveTextContent('expires in 3 days')
    await waitFor(() => expect(mocks.getVenueTimetable).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: 'Place tentative hold' })).not.toBeInTheDocument()
  })
  test('AC-009.7.11: a refused hold shows which slot clashes and why', async () => {
    mocks.holdVenue.mockResolvedValue({
      ok: false,
      reason: 'That venue is not available. Clashes: 12 Oct 2026 (11:00–11:15) — already booked.',
      conflicts: [{ date: '2026-10-12', slot: 'PM', kind: 'event' }],
    })
    show(`?eventId=${EVENT_ID}`)
    await user().click(await screen.findByRole('button', { name: 'Place tentative hold' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('12 Oct 2026 (11:00–11:15) — already booked')
  })
  test('AC-011.1.3: with no event chosen there is nothing to hold', async () => {
    show()
    await screen.findByLabelText('Book for one of your events')
    expect(screen.queryByRole('button', { name: 'Place tentative hold' })).not.toBeInTheDocument()
  })
  test('AC-011.5.20: a calendar that cannot be loaded says so rather than showing a free week', async () => {
    mocks.getVenueTimetable.mockResolvedValue({ ok: false, reason: 'Venue availability could not be loaded. Please try again.' })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  test('AC-009.1.25: a non-coordinator cannot reach the booking controls', async () => {
    mocks.role = 'venue_staff'
    show()
    expect(await screen.findByText(/available to event coordinators/)).toBeInTheDocument()
    expect(mocks.getVenueTimetable).not.toHaveBeenCalled()
  })
})

describe('MyVenueBookingsPage — AC-009.9 / AC-011.7 / AC-011.8', () => {
  const HELD = {
    id: BOOKING_ID, venueId: VENUE_ID, venueName: 'Alpha Hall', eventId: EVENT_ID,
    eventReference: 'EVT-1', eventName: 'Gala', status: 'held' as const,
    holdExpiresAt: '2026-10-08T04:00:00.000Z', reviewNote: null, createdAt: '2026-10-05T04:00:00.000Z',
    cells: [
      { date: '2026-10-11', slot: 'T2345' as const, kind: 'buffer' as const },
      { date: '2026-10-12', slot: 'T0900' as const, kind: 'event' as const },
    ],
  }
  const show = () => renderAt('/venues/bookings', '/venues/bookings', <MyVenueBookingsPage />)

  test('AC-009.9.13: lists each request with its venue, event, status and slots', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [HELD] })
    show()
    expect(await screen.findByRole('heading', { name: 'Alpha Hall' })).toBeInTheDocument()
    expect(screen.getByText('EVT-1')).toBeInTheDocument()
    expect(screen.getByText('Tentatively held')).toBeInTheDocument()
    expect(screen.getByText('12 Oct 2026 (09:00–09:15)')).toBeInTheDocument()
  })
  test('AC-011.6.12: a live hold says how long is left before it expires', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [HELD] })
    show()
    expect(await screen.findByText(/Expires in 3 day/)).toBeInTheDocument()
  })
  test('AC-011.6.13: a hold whose time has run out says so and cannot be submitted', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({
      ok: true, bookings: [{ ...HELD, holdExpiresAt: '2026-10-01T04:00:00.000Z' }],
    })
    show()
    expect(await screen.findByText(/has expired/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument()
  })
  test('AC-011.7.2: submitting a live hold sends it for review and reloads the list', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [HELD] })
    mocks.submitVenueBooking.mockResolvedValue({ ok: true })
    show()
    await user().click(await screen.findByRole('button', { name: 'Submit for approval' }))
    expect(mocks.submitVenueBooking).toHaveBeenCalledWith(BOOKING_ID)
    await waitFor(() => expect(mocks.listMyVenueBookings).toHaveBeenCalledTimes(2))
  })
  test('AC-011.8.9: releasing a hold frees it and reloads the list', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [HELD] })
    mocks.releaseHold.mockResolvedValue({ ok: true })
    show()
    await user().click(await screen.findByRole('button', { name: 'Release hold' }))
    expect(mocks.releaseHold).toHaveBeenCalledWith(BOOKING_ID)
    await waitFor(() => expect(mocks.listMyVenueBookings).toHaveBeenCalledTimes(2))
  })
  test('AC-011.8.10: a refused release says why instead of failing silently', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({ ok: true, bookings: [HELD] })
    mocks.releaseHold.mockResolvedValue({ ok: false, reason: 'This hold can no longer be released.' })
    show()
    await user().click(await screen.findByRole('button', { name: 'Release hold' }))
    expect(await screen.findByText('This hold can no longer be released.')).toBeInTheDocument()
  })
  test('AC-009.9.14: a request awaiting review can be released but not submitted again', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({
      ok: true, bookings: [{ ...HELD, status: 'pending_approval' as const }],
    })
    show()
    expect(await screen.findByText('Awaiting Venue Staff')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Release hold' })).toBeInTheDocument()
  })
  test('AC-009.9.15: a rejected request shows the Venue Staff note and offers no actions', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({
      ok: true, bookings: [{ ...HELD, status: 'rejected' as const, reviewNote: 'Clashes with maintenance.' }],
    })
    show()
    expect(await screen.findByText('Clashes with maintenance.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Release hold' })).not.toBeInTheDocument()
  })
  test('AC-009.9.16: having held nothing yet reads as an invitation, not an error', async () => {
    show()
    expect(await screen.findByText(/have not held a venue yet/)).toBeInTheDocument()
  })
  test('AC-009.9.17: a failed load is reported, never shown as an empty list', async () => {
    mocks.listMyVenueBookings.mockResolvedValue({ ok: false, reason: 'Your venue booking requests could not be loaded.' })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByText(/have not held a venue yet/)).not.toBeInTheDocument()
  })
})
