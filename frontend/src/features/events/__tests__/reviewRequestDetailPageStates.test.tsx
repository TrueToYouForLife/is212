import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'
import type { EventRequestDetail } from '../types'

const mocks = vi.hoisted(() => ({
  user: { loading: false, profile: { id: 'coord-1', role: 'coordinator' } as null | { id: string; role: string } },
  getEventRequest: vi.fn(), listReviewDecisions: vi.fn(),
  arrangementCount: 0,
}))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => mocks.user }))
vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  getEventRequest: mocks.getEventRequest,
  listReviewDecisions: mocks.listReviewDecisions,
}))
// The page hosts many panels, each with its own tests; here they are stand-ins so the page's
// own states can be checked without each panel's services.
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => function Stub() { return <div data-testid={name} /> },
}))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: stub('request-details') }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: stub('review-actions') }))
vi.mock('../reschedule/RescheduleEventForm', () => ({ RescheduleEventForm: stub('reschedule') }))
vi.mock('../components/DecisionHistory', () => ({
  DecisionHistory: ({ decisions }: { decisions: unknown[] }) => <p>{`${decisions.length} decisions shown`}</p>,
}))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: stub('status-panel') }))
vi.mock('../components/ChangeRequestList', () => ({ ChangeRequestList: stub('change-list') }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({ ChangeRequestReviewPanel: stub('change-review') }))
vi.mock('../components/ArrangementReviewPanel', () => ({
  ArrangementReviewPanel: ({ onCount }: { onCount: (count: number | null) => void }) => {
    useEffect(() => { onCount(mocks.arrangementCount) }, [onCount])
    return <div data-testid="arrangement-reviews" />
  },
}))
vi.mock('../components/OrganiserVenueArrangements', () => ({ OrganiserVenueArrangements: stub('organiser-venues') }))
vi.mock('../components/OrganiserEquipmentArrangements', () => ({ OrganiserEquipmentArrangements: stub('organiser-equipment') }))
vi.mock('../components/RegistrationSettingPanel', () => ({ RegistrationSettingPanel: stub('registration-setting') }))
vi.mock('../../registrations/components/EventWaitlistPanel', () => ({ EventWaitlistPanel: stub('waitlist') }))
vi.mock('../components/PlanningUpdatePanel', () => ({ PlanningUpdatePanel: stub('planning-update') }))
vi.mock('../components/RegistrationsCard', () => ({ RegistrationsCard: stub('registrations') }))
vi.mock('../components/ClarificationResponseForm', () => ({ ClarificationResponseForm: stub('clarification-form') }))
vi.mock('../components/ClarificationRoundHistory', () => ({ ClarificationRoundHistory: stub('clarification-history') }))
vi.mock('../audit/AuditTrailCard', () => ({ AuditTrailCard: stub('audit') }))
vi.mock('../readiness/EventReadinessCard', () => ({ EventReadinessCard: stub('readiness') }))
vi.mock('../components/EventVenueBookings', () => ({ EventVenueBookings: stub('venue-bookings') }))
vi.mock('../../safety/SafetyReviewDecisionsPanel', () => ({ SafetyReviewDecisionsPanel: stub('safety') }))

const EVENT_ID = 'c0ffee00-0000-4000-8000-000000000001'
const REQUEST = {
  id: EVENT_ID, reference: 'EVT-1', organiserId: 'org-1', coordinatorId: 'coord-1', name: 'Gala', purpose: 'Annual dinner',
  eventType: 'Dinner', proposedStart: '2035-03-10T01:00:00Z', proposedEnd: '2035-03-10T09:00:00Z', expectedAttendance: 80,
  status: 'planning', submittedAt: '2035-01-01T01:00:00Z', reviewNote: null, description: null, programme: null,
  layoutPreference: null, accessibilityRequirements: [], facilityRequirements: [], equipmentRequirements: [],
  registrationRequired: false, specialArrangements: null, reviewedAt: null, createdAt: null, updatedAt: null,
} as unknown as EventRequestDetail

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/requests/${EVENT_ID}`]}>
      <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.loading = false
  mocks.user.profile = { id: 'coord-1', role: 'coordinator' }
  mocks.arrangementCount = 0
  mocks.getEventRequest.mockResolvedValue({ ok: true, request: REQUEST })
  mocks.listReviewDecisions.mockResolvedValue({ ok: true, decisions: [] })
})

describe('AC-004.1 — the request page in its less common states', () => {
  test('AC-004.1.17: while the session is checked the page waits and asks for nothing', async () => {
    mocks.user.loading = true
    mocks.user.profile = null
    renderPage()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Loading request…')).toBeInTheDocument()
    expect(mocks.getEventRequest).not.toHaveBeenCalled()
    expect(mocks.listReviewDecisions).not.toHaveBeenCalled()
  })

  test('AC-004.1.18: a request that cannot be loaded shows why, with a way back to the list', async () => {
    mocks.getEventRequest.mockResolvedValue({ ok: false, reason: 'That event request could not be found, or you are not permitted to see it.' })
    renderPage()
    expect(await screen.findByText('Request unavailable')).toBeInTheDocument()
    expect(screen.getByText(/could not be found, or you are not permitted/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to all requests' })).toHaveAttribute('href', '/requests')
  })

  test('AC-004.1.19: a request with no name is headed by its purpose', async () => {
    mocks.getEventRequest.mockResolvedValue({ ok: true, request: { ...REQUEST, name: null } })
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Annual dinner' })).toBeInTheDocument()
  })
})

describe('AC-041 — the assigned coordinator is pointed to arrangements needing review', () => {
  test('AC-004.1.20: one open review reads in the singular, several in the plural', async () => {
    mocks.arrangementCount = 1
    const { unmount } = renderPage()
    expect(await screen.findByRole('link', { name: /Needs review: 1 arrangement needs review/ })).toHaveAttribute('href', '#arrangement-reviews')
    unmount()
    mocks.arrangementCount = 3
    renderPage()
    expect(await screen.findByRole('link', { name: /Needs review: 3 arrangements need review/ })).toBeInTheDocument()
  })
})

describe('AC-037 — an organiser asked for clarification sees the question first', () => {
  test('AC-004.1.21: a returned request with a question shows the organiser the clarification form', async () => {
    mocks.user.profile = { id: 'org-1', role: 'organiser' }
    mocks.getEventRequest.mockResolvedValue({ ok: true, request: { ...REQUEST, status: 'submitted', reviewNote: 'How many guests need wheelchair access?' } })
    renderPage()
    expect(await screen.findByText('Clarification requested')).toBeInTheDocument()
    expect(screen.getByTestId('clarification-form')).toBeInTheDocument()
    expect(mocks.listReviewDecisions).not.toHaveBeenCalled()
  })
})

describe('AC-004.4 — staff see the decision history', () => {
  test('AC-004.1.22: the history shows while loading, then its decisions', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.listReviewDecisions.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderPage()
    expect(await screen.findByText('Loading decision history…')).toBeInTheDocument()
    finish({ ok: true, decisions: [{ id: 'd-1' }, { id: 'd-2' }] })
    expect(await screen.findByText('2 decisions shown')).toBeInTheDocument()
  })

  test('AC-004.1.23: a history that cannot be loaded says so, without hiding the rest of the page', async () => {
    mocks.listReviewDecisions.mockResolvedValue({ ok: false, reason: 'The decision history could not be loaded.' })
    renderPage()
    expect(await screen.findByText('The decision history could not be loaded.')).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('request-details')).toBeInTheDocument()
  })
})
