import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueTimetablePage } from '../pages/VenueTimetablePage'
import { QUARTER_HOUR_SLOTS as SLOTS } from '../quarterHourSlots'
import { buildTimetable } from '../venueTimetable'
import { EVENT_ID, VENUE_ID, sgt } from './fixtures/venueBooking'
import type { VenueAssessment, SuitabilityVerdict, SuitabilityReasonCode } from '../suitabilityTypes'

/**
 * US11 AC-011.10 (SCRUM-16, added from US18 on 5 October 2026): the venue's suitability is
 * checked before a hold is placed, and an unsuitable venue is held only on "Book anyway".
 *
 * A separate file from VenueBookingPages.test.tsx on purpose: that file is shared by four
 * stories and mocks the booking service without the suitability one, so adding these there
 * would mean changing its mock surface for everybody.
 *
 * Mocked: assessVenueForBooking's own verdicts are tested in suitabilityService.test.ts and the
 * alert's rendering in UnsuitableVenueAlert.test.tsx. What is untested until now, and what
 * these cover, is the wiring — that the check runs before the hold, and that the hold waits for
 * the answer.
 */

const mocks = vi.hoisted(() => ({
  getVenue: vi.fn(), getVenueTimetable: vi.fn(), loadTimeSlots: vi.fn(),
  listMyAssignedEvents: vi.fn(), holdVenue: vi.fn(), assess: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: 'coordinator' } }),
}))
vi.mock('../venueTimetableService', () => ({
  getVenue: mocks.getVenue,
  getVenueTimetable: mocks.getVenueTimetable,
  VENUE_TIMETABLE_MESSAGES: { loadFailed: 'Venue availability could not be loaded. Please try again.' },
}))
vi.mock('../venueSearchService', () => ({ listMyAssignedEvents: mocks.listMyAssignedEvents }))
vi.mock('../venueBookingService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../venueBookingService')>(),
  loadTimeSlots: mocks.loadTimeSlots,
  holdVenue: mocks.holdVenue,
}))
vi.mock('../bookingSpaceService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../bookingSpaceService')>(),
  loadSpaceLayouts: async () => [{ layout: 'theatre', capacity: 100 }],
}))
vi.mock('../suitabilityService', () => ({ assessVenueForBooking: mocks.assess }))

const VENUE = {
  id: VENUE_ID, name: 'Alpha Hall', capacity: 200, layout: 'theatre',
  accessibility: ['wheelchair_access'], facility: { projector: true },
  setupMinutes: 15, turnaroundMinutes: 15, status: 'active' as const, location: 'Bras Basah',
}

const ASSIGNED_EVENT = {
  id: EVENT_ID, reference: 'EVT-1', name: 'Gala',
  proposedStart: sgt('2026-10-12', '09:00'), proposedEnd: sgt('2026-10-12', '11:00'),
  expectedAttendance: 120, layoutPreference: 'Theatre', accessibilityRequirements: null,
  equipmentRequirements: null,
}

/** A verdict shaped the way assessVenueForBooking returns one. The reason codes matter as much
 *  as the verdict here: the page re-derives its own gate from them rather than trusting the
 *  verdict, which US18 computed for a whole event in venue search. */
function assessment(verdict: SuitabilityVerdict, ...reasons: [SuitabilityReasonCode, string][]): VenueAssessment {
  return {
    venue: {
      id: VENUE_ID, name: 'Alpha Hall', location: 'Bras Basah', status: 'active',
      layouts: [{ layout: 'theatre', capacity: 100 }], accessibility: [], facility: {},
    },
    verdict,
    reasons: reasons.map(([code, message]) => ({ code, message })),
    fittingLayouts: [],
  }
}

const TOO_SMALL: [SuitabilityReasonCode, string] =
  ['capacity', 'Alpha Hall seats 100 in theatre; 200 people are expected.']
const NO_ACCESS: [SuitabilityReasonCode, string] =
  ['accessibility', 'Alpha Hall lacks wheelchair access.']
const IS_BLOCKED: [SuitabilityReasonCode, string] =
  ['blocked', 'Alpha Hall is closed for repairs on 12 October.']

const user = () => userEvent.setup()

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getVenue.mockResolvedValue({ ok: true, venue: VENUE })
  mocks.getVenueTimetable.mockResolvedValue({ ok: true, timetable: buildTimetable(SLOTS, [], '2026-10-12', 7) })
  mocks.loadTimeSlots.mockResolvedValue(SLOTS)
  mocks.listMyAssignedEvents.mockResolvedValue([ASSIGNED_EVENT])
  mocks.holdVenue.mockResolvedValue({ ok: true, bookingId: 'booking-1' })
  mocks.assess.mockResolvedValue({ ok: true, value: assessment('suitable') })
})

/** Opens the timetable for the assigned event and fills in the space the booking needs,
 *  which is what enables the hold button. */
async function openAndReady() {
  render(
    <MemoryRouter initialEntries={[`/venues/${VENUE_ID}/timetable?eventId=${EVENT_ID}`]}>
      <Routes><Route path="/venues/:id/timetable" element={<VenueTimetablePage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findByText('theatre (capacity 100)')
  await user().selectOptions(screen.getByLabelText('Layout for this booking'), 'theatre')
  await user().type(screen.getByLabelText('People in this space'), '25')
}

const hold = () => screen.getByRole('button', { name: 'Place tentative hold' })

describe('AC-011.10 — a suitable venue', () => {
  test('AC-011.10.1: the check runs first and a suitable venue is held with no warning', async () => {
    await openAndReady()
    await user().click(hold())

    await waitFor(() => expect(mocks.holdVenue).toHaveBeenCalledTimes(1))
    expect(mocks.assess).toHaveBeenCalledWith(EVENT_ID, VENUE_ID, SLOTS)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // The check must precede the hold, not merely both happen.
    expect(mocks.assess.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.holdVenue.mock.invocationCallOrder[0])
  })
})

describe('AC-011.10 — a reason the booking has outgrown', () => {
  test('AC-011.10.2: a venue too small for the whole event does not stop a booking that declares its own space', async () => {
    // The fix for the defect this gate first shipped with. assessVenueForBooking judges capacity
    // against the event's total attendance; a booking declares its own, and US49's
    // check_booking_space compares the layout capacity against that. Warning here would fire on
    // every room of a multi-venue event.
    mocks.assess.mockResolvedValue({ ok: true, value: assessment('unsuitable', TOO_SMALL) })
    await openAndReady()
    await user().click(hold())

    await waitFor(() => expect(mocks.holdVenue).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('AC-011.10.3: a capacity reason alongside a real one still raises the alert', async () => {
    // Boundary, and the guard against the case above turning into "ignore every assessment":
    // dropping capacity must not drop the reasons sitting beside it.
    mocks.assess.mockResolvedValue({ ok: true, value: assessment('unsuitable', TOO_SMALL, NO_ACCESS) })
    await openAndReady()
    await user().click(hold())

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/lacks wheelchair access/)).toBeInTheDocument()
    expect(screen.queryByText(/200 people are expected/)).not.toBeInTheDocument()
    expect(mocks.holdVenue).not.toHaveBeenCalled()
  })
})

describe('AC-011.10 — a requirement the venue does not meet', () => {
  beforeEach(() => {
    mocks.assess.mockResolvedValue({ ok: true, value: assessment('unsuitable', NO_ACCESS) })
  })

  test('AC-011.10.4: the reasons are shown and nothing is held', async () => {
    await openAndReady()
    await user().click(hold())

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/lacks wheelchair access/)).toBeInTheDocument()
    expect(mocks.holdVenue).not.toHaveBeenCalled()
  })

  test('AC-011.10.5: "Book anyway" holds the venue once the coordinator has seen why it does not fit', async () => {
    // The criterion's own wording, reachable since 0125 made accessibility and facility advisory
    // in check_booking_space. Before that the override would have produced 22023 — the bare
    // database error the alert exists to replace.
    await openAndReady()
    await user().click(hold())
    await user().click(await screen.findByRole('button', { name: 'Book anyway' }))

    await waitFor(() => expect(mocks.holdVenue).toHaveBeenCalledTimes(1))
    // One assessment, not two: answering the alert must not re-check, or a verdict that changed
    // in between would decide a hold the coordinator never saw.
    expect(mocks.assess).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('AC-011.10.6: "Choose another venue" holds nothing and restores the button', async () => {
    await openAndReady()
    await user().click(hold())
    await user().click(await screen.findByRole('button', { name: 'Choose another venue' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(mocks.holdVenue).not.toHaveBeenCalled()
    expect(hold()).toBeInTheDocument()
  })

  test('AC-011.10.7: changing the layout drops the stale verdict instead of letting it stand', async () => {
    await openAndReady()
    await user().click(hold())
    await screen.findByRole('alertdialog')

    await user().selectOptions(screen.getByLabelText('Layout for this booking'), 'theatre')

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(mocks.holdVenue).not.toHaveBeenCalled()
  })

  test('AC-011.10.8: a venue blocked for the dates is treated the same way', async () => {
    mocks.assess.mockResolvedValue({ ok: true, value: assessment('unavailable', IS_BLOCKED) })
    await openAndReady()
    await user().click(hold())

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book anyway' })).not.toBeInTheDocument()
    expect(mocks.holdVenue).not.toHaveBeenCalled()
  })
})

describe('AC-011.10 — when the check itself cannot run', () => {
  test('AC-011.10.9: a failed check lets the hold proceed rather than blocking it', async () => {
    // Failure case, and a deliberate product decision: suitability is advice, so an advisory
    // read that breaks must not deny a venue the database would accept. The same verdict is
    // available on the suitability page.
    mocks.assess.mockResolvedValue({ ok: false, reason: 'Venue availability could not be checked. Please try again.' })
    await openAndReady()
    await user().click(hold())

    await waitFor(() => expect(mocks.holdVenue).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('AC-011.10.10: a thrown check is treated the same way', async () => {
    mocks.assess.mockRejectedValue(new Error('network'))
    await openAndReady()
    await user().click(hold())

    await waitFor(() => expect(mocks.holdVenue).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})