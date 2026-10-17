import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'
import { eventId } from './fixtures/changeRequestReview'

/** US52 (SCRUM-245): who sees the registration switch on the shared request page. */
const mocks = vi.hoisted(() => ({
  role: 'coordinator', coordinatorId: 'viewer', status: 'confirmed', enabled: true,
  get: vi.fn(), set: vi.fn(),
}))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({
  getEventRequest: (...args: unknown[]) => {
    mocks.get(...args)
    return Promise.resolve({ ok: true, request: {
      id: eventId, organiserId: 'organiser', status: mocks.status, coordinatorId: mocks.coordinatorId,
      name: 'An event', registrationRequired: mocks.enabled,
    } })
  },
  listReviewDecisions: async () => ({ ok: true, decisions: [] }),
}))
vi.mock('../registrationSettingService', () => ({ setEventRegistration: mocks.set }))
vi.mock('../eventChangeRequestService', () => ({ LOCKED_STATUSES: ['cancelled', 'rejected', 'completed'] }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({ ChangeRequestReviewPanel: () => null }))
vi.mock('../components/ChangeRequestList', () => ({ ChangeRequestList: () => null }))
vi.mock('../components/ArrangementReviewPanel', () => ({ ArrangementReviewPanel: () => null }))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: () => null }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: () => null }))
vi.mock('../components/DecisionHistory', () => ({ DecisionHistory: () => null }))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mocks, { role: 'coordinator', coordinatorId: 'viewer', status: 'confirmed', enabled: true })
})
function setup() {
  return render(<MemoryRouter initialEntries={[`/requests/${eventId}`]}>
    <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
  </MemoryRouter>)
}

test('AC-052.1.23: the assigned coordinator sees the switch on a Confirmed event', async () => {
  setup()
  expect(await screen.findByRole('button', { name: 'Disable registration' })).toBeInTheDocument()
})

test('AC-052.1.24: nobody else sees it, and nobody sees it once the event is not Confirmed', async () => {
  for (const [role, coordinatorId, status] of [
    ['coordinator', 'another-coordinator', 'confirmed'],
    ['organiser', 'viewer', 'confirmed'],
    ['coordinator_lead', 'viewer', 'confirmed'],
    ['operations_manager', 'viewer', 'confirmed'],
    ['coordinator', 'viewer', 'approved'],
    ['coordinator', 'viewer', 'planning'],
    ['coordinator', 'viewer', 'completed'],
    ['coordinator', 'viewer', 'cancelled'],
  ] as const) {
    Object.assign(mocks, { role, coordinatorId, status })
    const { unmount } = setup()
    await screen.findByRole('heading', { name: 'An event' })
    expect(screen.queryByText('Attendee registration')).not.toBeInTheDocument()
    unmount()
  }
})

test('AC-052.1.25: after a successful change the page reloads the event so it shows the new setting', async () => {
  mocks.set.mockResolvedValue({ ok: true })
  setup()
  await userEvent.click(await screen.findByRole('button', { name: 'Disable registration' }))
  await waitFor(() => expect(mocks.set).toHaveBeenCalledWith(eventId, false))
  await waitFor(() => expect(mocks.get.mock.calls.length).toBeGreaterThan(1))
})
