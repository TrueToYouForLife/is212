import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'
import { eventId } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ role: 'organiser', reviewPanel: vi.fn(), list: vi.fn(), flags: vi.fn(), coordinatorId: 'viewer' }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({
  getEventRequest: async () => ({ ok: true, request: { id: eventId, organiserId: 'viewer', status: 'approved', coordinatorId: mocks.coordinatorId, name: 'An event' } }),
  listReviewDecisions: async () => ({ ok: true, decisions: [] }),
}))
vi.mock('../eventChangeRequestService', () => ({ LOCKED_STATUSES: ['cancelled', 'rejected', 'confirmed'] }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({
  ChangeRequestReviewPanel: (props: unknown) => { mocks.reviewPanel(props); return <p>Coordinator change review</p> },
}))
vi.mock('../components/ChangeRequestList', () => ({
  ChangeRequestList: (props: unknown) => { mocks.list(props); return <p>Read-only changes</p> },
}))
vi.mock('../components/ArrangementReviewPanel', () => ({ ArrangementReviewPanel: (props: unknown) => { mocks.flags(props); return <p>Arrangement flags</p> } }))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: () => null }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: () => null }))
vi.mock('../components/DecisionHistory', () => ({ DecisionHistory: () => null }))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: () => null }))
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'organiser'; mocks.coordinatorId = 'viewer' })
function setup() {
  render(<MemoryRouter initialEntries={[`/requests/${eventId}`]}>
    <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
  </MemoryRouter>)
}
test('AC-007.2.30: the organiser detail page mounts the read-only list without coordinator controls', async () => {
  setup()
  expect(await screen.findByText('Read-only changes')).toBeInTheDocument()
  expect(mocks.reviewPanel).not.toHaveBeenCalled()
})
test('AC-007.2.31: the coordinator detail page connects the event ID and refresh callback to the review panel', async () => {
  mocks.role = 'coordinator'
  setup()
  expect(await screen.findByText('Coordinator change review')).toBeInTheDocument()
  expect(mocks.reviewPanel).toHaveBeenCalledWith({ eventId, onReviewed: expect.any(Function) })
  expect(mocks.list).not.toHaveBeenCalled()
})

test('AC-041.1.9: only the assigned coordinator sees arrangement reviews and page refresh reloads them', async () => {
  for (const role of ['organiser', 'operations_manager', 'coordinator_lead', 'coordinator']) {
    mocks.role = role
    mocks.coordinatorId = 'another-coordinator'
    const { unmount } = render(<MemoryRouter initialEntries={[`/requests/${eventId}`]}>
      <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
    </MemoryRouter>)
    await screen.findByRole('heading', { name: 'An event' })
    expect(screen.queryByText('Arrangement flags')).not.toBeInTheDocument()
    unmount()
  }
  expect(mocks.flags).not.toHaveBeenCalled()
  mocks.coordinatorId = 'viewer'
  setup()
  await screen.findByText('Arrangement flags')
  expect(mocks.flags).toHaveBeenLastCalledWith({ eventId, refreshVersion: 0, onCount: expect.any(Function) })
  const reportCount = mocks.flags.mock.lastCall?.[0].onCount
  act(() => reportCount(2))
  expect(screen.getByRole('link', { name: /2 arrangements need review/ })).toHaveAttribute('href', '#arrangement-reviews')
  act(() => reportCount(0))
  expect(screen.queryByRole('link', { name: /arrangements need review/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }))
  await waitFor(() => expect(mocks.flags).toHaveBeenLastCalledWith({ eventId, refreshVersion: 1, onCount: expect.any(Function) }))
})
