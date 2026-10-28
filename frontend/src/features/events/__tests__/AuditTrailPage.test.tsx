import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'
import { eventId } from './fixtures/changeRequestReview'

/** US34 (SCRUM-231): who is shown the audit trail on the shared request page. */
const mocks = vi.hoisted(() => ({ role: 'coordinator', coordinatorId: 'viewer' }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({
  getEventRequest: async () => ({ ok: true, request: {
    id: eventId, organiserId: 'organiser', status: 'confirmed', coordinatorId: mocks.coordinatorId,
    name: 'An event', registrationRequired: false,
  } }),
  listReviewDecisions: async () => ({ ok: true, decisions: [] }),
}))
vi.mock('../audit/AuditTrailCard', () => ({ AuditTrailCard: () => <p>Audit trail card</p> }))
vi.mock('../readiness/EventReadinessCard', () => ({ EventReadinessCard: () => null }))
vi.mock('../../registrations/components/EventWaitlistPanel', () => ({ EventWaitlistPanel: () => null }))
vi.mock('../eventChangeRequestService', () => ({ LOCKED_STATUSES: ['cancelled', 'rejected', 'completed'] }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({ ChangeRequestReviewPanel: () => null }))
vi.mock('../components/ChangeRequestList', () => ({ ChangeRequestList: () => null }))
vi.mock('../components/ArrangementReviewPanel', () => ({ ArrangementReviewPanel: () => null }))
vi.mock('../components/PlanningUpdatePanel', () => ({ PlanningUpdatePanel: () => null }))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: () => null }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: () => null }))
vi.mock('../components/DecisionHistory', () => ({ DecisionHistory: () => null }))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: () => null }))

beforeEach(() => Object.assign(mocks, { role: 'coordinator', coordinatorId: 'viewer' }))
function setup() {
  return render(<MemoryRouter initialEntries={[`/requests/${eventId}`]}>
    <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
  </MemoryRouter>)
}

test('AC-034.3.14: the assigned Coordinator and the Coordinator Lead see the audit trail', async () => {
  for (const [role, coordinatorId] of [['coordinator', 'viewer'], ['coordinator_lead', 'someone-else']] as const) {
    Object.assign(mocks, { role, coordinatorId })
    const { unmount } = setup()
    expect(await screen.findByText('Audit trail card')).toBeInTheDocument()
    unmount()
  }
})

test('AC-034.4.7: an unassigned Coordinator, the Organiser and other roles are not shown the audit trail', async () => {
  for (const [role, coordinatorId] of [
    ['coordinator', 'another-coordinator'],
    ['organiser', 'viewer'],
    ['operations_manager', 'viewer'],
    ['venue_staff', 'viewer'],
  ] as const) {
    Object.assign(mocks, { role, coordinatorId })
    const { unmount } = setup()
    await screen.findByRole('heading', { name: 'An event' })
    expect(screen.queryByText('Audit trail card')).not.toBeInTheDocument()
    unmount()
  }
})
