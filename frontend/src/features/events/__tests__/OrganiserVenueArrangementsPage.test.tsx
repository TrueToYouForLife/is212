import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'

const mocks = vi.hoisted(() => ({ role: 'organiser', owner: 'viewer', panel: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({
  getEventRequest: async () => ({ ok: true, request: {
    id: 'event1', organiserId: mocks.owner, name: 'Venue test event', status: 'submitted',
  } }),
  listReviewDecisions: async () => ({ ok: true, decisions: [] }),
}))
vi.mock('../components/OrganiserVenueArrangements', () => ({
  OrganiserVenueArrangements: (props: unknown) => { mocks.panel(props); return <p>Venue arrangements panel</p> },
}))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: () => null }))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: () => null }))
vi.mock('../components/ChangeRequestList', () => ({ ChangeRequestList: () => null }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({ ChangeRequestReviewPanel: () => null }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: () => null }))
vi.mock('../components/DecisionHistory', () => ({ DecisionHistory: () => null }))

test('AC-042.3.4: the shared request page mounts venue arrangements only for the owning organiser', async () => {
  for (const [role, owner, visible] of [
    ['organiser', 'viewer', true], ['organiser', 'someone-else', false],
    ['coordinator', 'viewer', false], ['coordinator_lead', 'viewer', false],
    ['venue_staff', 'viewer', false], ['attendee', 'viewer', false],
  ] as const) {
    Object.assign(mocks, { role, owner })
    mocks.panel.mockClear()
    const { unmount } = render(<MemoryRouter initialEntries={['/requests/event1']}>
      <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
    </MemoryRouter>)
    await screen.findByRole('heading', { name: 'Venue test event' })
    if (visible) {
      expect(screen.getByText('Venue arrangements panel')).toBeInTheDocument()
      await waitFor(() => expect(mocks.panel).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event1' })))
    } else {
      expect(screen.queryByText('Venue arrangements panel')).not.toBeInTheDocument()
      expect(mocks.panel).not.toHaveBeenCalled()
    }
    unmount()
  }
})
