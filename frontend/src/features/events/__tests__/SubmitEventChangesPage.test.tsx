import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SubmitEventChangesPage } from '../pages/SubmitEventChangesPage'
import { eventId } from './fixtures/changeRequestReview'

/**
 * INTEGRATION. The request-changes page wired to a stubbed read, exercising the gates the
 * organiser actually meets: ownership, event state, and seeing the current details beside
 * the form.
 *
 * These belong at page level rather than on the form or the service because each gate is
 * a composition: the page reads the event, compares it against the signed-in profile and
 * only then renders the form prefilled from what it read. The service has its own cases
 * for the same rules, since hiding a control is a courtesy and the service is the control.
 */

const mocks = vi.hoisted(() => ({ getEventRequest: vi.fn(), useCurrentUser: vi.fn() }))

vi.mock('../eventReviewService', () => ({ getEventRequest: mocks.getEventRequest }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: mocks.useCurrentUser }))
vi.mock('../components/EventChangeRequestForm', () => ({
  // The form has its own tests; here we only care that the page renders it and hands it
  // the current values it read, so a stub keeps the assertions about the page.
  EventChangeRequestForm: ({ current }: { current?: Record<string, unknown> }) => (
    <div data-testid="change-form" data-current={JSON.stringify(current ?? null)}>
      change form
    </div>
  ),
}))

const ORGANISER = { id: 'organiser-1', role: 'organiser' as const, fullName: 'Jo Organiser' }

const EVENT = {
  id: eventId,
  reference: 'EVT-2026-0001',
  organiserId: ORGANISER.id,
  name: 'Annual dinner',
  purpose: 'Thank the volunteers',
  eventType: 'Dinner',
  description: null,
  proposedStart: '2099-06-01T10:00:00Z',
  proposedEnd: '2099-06-01T14:00:00Z',
  expectedAttendance: 180,
  status: 'submitted' as const,
  submittedAt: '2026-01-01T00:00:00Z',
  programme: null,
  layoutPreference: 'banquet',
  accessibilityRequirements: ['wheelchair_access'],
  facilityRequirements: ['projector'],
  equipmentRequirements: ['wireless_mic'],
  registrationRequired: false,
  specialArrangements: null,
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

function setup() {
  render(
    <MemoryRouter initialEntries={[`/requests/${eventId}/request-change`]}>
      <Routes>
        <Route path="/requests/:id/request-change" element={<SubmitEventChangesPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.useCurrentUser.mockReturnValue({
    session: { user: { id: ORGANISER.id } }, profile: ORGANISER, loading: false,
  })
  mocks.getEventRequest.mockResolvedValue({ ok: true, request: EVENT })
})

describe('AC-006.1 — changes can only be requested for events belonging to the organiser', () => {
  test('AC-006.1.6: the owning organiser is given the change form', async () => {
    setup()
    expect(await screen.findByTestId('change-form')).toBeInTheDocument()
  })

  test('AC-006.1.7: an event belonging to someone else is refused and no form is offered', async () => {
    mocks.getEventRequest.mockResolvedValue({
      ok: true, request: { ...EVENT, organiserId: 'someone-else' },
    })
    setup()
    expect(await screen.findByText(/does not belong to your account/i)).toBeInTheDocument()
    expect(screen.queryByTestId('change-form')).not.toBeInTheDocument()
  })

  test('AC-006.1.8: a signed-out visitor is asked to sign in rather than shown the form', async () => {
    mocks.useCurrentUser.mockReturnValue({ session: null, profile: null, loading: false })
    setup()
    expect(await screen.findByText(/signed in as an event organiser/i)).toBeInTheDocument()
    expect(screen.queryByTestId('change-form')).not.toBeInTheDocument()
  })

  test('AC-006.1.9: a signed-in non-organiser is told the page is not for their role', async () => {
    mocks.useCurrentUser.mockReturnValue({
      session: { user: { id: 'coord-1' } },
      profile: { id: 'coord-1', role: 'coordinator', fullName: 'Casey Coordinator' },
      loading: false,
    })
    setup()
    expect(await screen.findByText(/Not available for your role/i)).toBeInTheDocument()
    expect(screen.queryByTestId('change-form')).not.toBeInTheDocument()
  })
})

describe('AC-006.2 — changes can only be requested while the event state permits it', () => {
  test.each([
    ['AC-006.2.8', 'cancelled'],
    ['AC-006.2.9', 'completed'],
    ['AC-006.2.10', 'rejected'],
  ])('%s: a %s event offers no change form', async (_id, status) => {
    mocks.getEventRequest.mockResolvedValue({ ok: true, request: { ...EVENT, status } })
    setup()
    expect(await screen.findByText(/can no longer be changed/i)).toBeInTheDocument()
    expect(screen.queryByTestId('change-form')).not.toBeInTheDocument()
  })

  test('AC-006.2.11: a permitted status still offers the form, so the gate is not refusing everything', async () => {
    mocks.getEventRequest.mockResolvedValue({ ok: true, request: { ...EVENT, status: 'planning' } })
    setup()
    expect(await screen.findByTestId('change-form')).toBeInTheDocument()
    expect(screen.queryByText(/can no longer be changed/i)).not.toBeInTheDocument()
  })

  test('AC-006.2.13: a confirmed event offers the form, alongside the details still in force', async () => {
    // The page half of AC-006.2.7. Both gates read LOCKED_STATUSES, so both needed a
    // case: the page used to hide the form on exactly the event AC-006.9 describes.
    mocks.getEventRequest.mockResolvedValue({ ok: true, request: { ...EVENT, status: 'confirmed' } })
    setup()
    expect(await screen.findByTestId('change-form')).toBeInTheDocument()
    expect(screen.getByText('Current event details')).toBeInTheDocument()
  })
})

describe('AC-006.3 — the organiser can access the previously submitted details', () => {
  test('AC-006.3.1: the current event details are shown alongside the form', async () => {
    setup()
    expect(await screen.findByText('Current event details')).toBeInTheDocument()
    expect(screen.getByText('Annual dinner')).toBeInTheDocument()
    expect(screen.getByText('Thank the volunteers')).toBeInTheDocument()
  })

  test('AC-006.3.2: the form is prefilled from the details that were read, not from defaults', async () => {
    // This is what makes the diff rule work: the controls compare against these values, so
    // if the page passed defaults instead, an untouched control would propose a change.
    setup()
    const form = await screen.findByTestId('change-form')
    expect(JSON.parse(form.dataset.current ?? 'null')).toEqual({
      layoutPreference: 'banquet',
      accessibilityRequirements: ['wheelchair_access'],
      facilityRequirements: ['projector'],
      equipmentRequirements: ['wireless_mic'],
    })
  })

  test('AC-006.3.3: an event that cannot be read reports the reason instead of an empty form', async () => {
    mocks.getEventRequest.mockResolvedValue({ ok: false, reason: 'That event request could not be found.' })
    setup()
    expect(await screen.findByText('That event request could not be found.')).toBeInTheDocument()
    expect(screen.queryByTestId('change-form')).not.toBeInTheDocument()
  })

  test('AC-006.3.4: the details are not claimed to be missing while they are still loading', async () => {
    // A pending read must not fall through to "unavailable", or a slow connection looks
    // like a deleted event.
    mocks.getEventRequest.mockReturnValue(new Promise(() => {}))
    setup()
    expect(await screen.findByText(/Loading event details/i)).toBeInTheDocument()
    expect(screen.queryByText('Request unavailable')).not.toBeInTheDocument()
  })

  test('AC-006.3.5: an event with no requirements recorded yet still opens the form', async () => {
    // Boundary: the first change request on an event that asked for nothing. Empty lists
    // and a null layout are legitimate current values, not a failure to load.
    mocks.getEventRequest.mockResolvedValue({
      ok: true,
      request: {
        ...EVENT, layoutPreference: null, accessibilityRequirements: [],
        facilityRequirements: [], equipmentRequirements: [],
      },
    })
    setup()
    const form = await screen.findByTestId('change-form')
    expect(JSON.parse(form.dataset.current ?? 'null')).toEqual({
      layoutPreference: null, accessibilityRequirements: [],
      facilityRequirements: [], equipmentRequirements: [],
    })
  })
})

describe('AC-006.9 — the original details remain in force and visible until approval', () => {
  test('AC-006.9.3: the page states that the original submission stays in force until reviewed', async () => {
    setup()
    expect(
      await screen.findByText(/original submission stays in force until a coordinator reviews/i),
    ).toBeInTheDocument()
  })

  test('AC-006.9.4: the details on display are the stored event, shown beside the proposal form', async () => {
    // "Visible until approved" is the half of AC9 the service cannot cover: the service
    // only proves the event is not written to. This proves the organiser can still see
    // what is in force while proposing something different.
    setup()
    expect(await screen.findByText('Current event details')).toBeInTheDocument()
    expect(screen.getByText('Proposed changes')).toBeInTheDocument()
    expect(screen.getByText('Annual dinner')).toBeInTheDocument()
  })

  test('AC-006.9.5: the page reads the event and never writes it', async () => {
    setup()
    await screen.findByTestId('change-form')
    expect(mocks.getEventRequest).toHaveBeenCalledWith(eventId)
  })
})
