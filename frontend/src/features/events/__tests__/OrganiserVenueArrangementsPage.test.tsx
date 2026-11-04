import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { ReviewRequestDetailPage } from '../pages/ReviewRequestDetailPage'

const mocks = vi.hoisted(() => ({ role: 'organiser', owner: 'viewer', coordinator: 'viewer',
  panel: vi.fn(), equipment: vi.fn(), readiness: vi.fn(), bookings: vi.fn(), safety: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({
  getEventRequest: async () => ({ ok: true, request: {
    id: 'event1', organiserId: mocks.owner, coordinatorId: mocks.coordinator, name: 'Venue test event', status: 'submitted',
  } }),
  listReviewDecisions: async () => ({ ok: true, decisions: [] }),
}))
vi.mock('../components/OrganiserVenueArrangements', () => ({
  OrganiserVenueArrangements: (props: unknown) => { mocks.panel(props); return <p>Venue arrangements panel</p> },
}))
vi.mock('../components/OrganiserEquipmentArrangements', () => ({
  OrganiserEquipmentArrangements: (props: unknown) => { mocks.equipment(props); return <p>Equipment arrangements panel</p> },
}))
vi.mock('../components/RequestDetails', () => ({ RequestDetails: () => null }))
vi.mock('../status/RequestStatusPanel', () => ({ RequestStatusPanel: () => null }))
vi.mock('../components/ChangeRequestList', () => ({ ChangeRequestList: () => null }))
vi.mock('../components/ChangeRequestReviewPanel', () => ({ ChangeRequestReviewPanel: () => null }))
vi.mock('../components/ReviewActions', () => ({ ReviewActions: () => null }))
vi.mock('../components/DecisionHistory', () => ({ DecisionHistory: () => null }))
vi.mock('../audit/AuditTrailCard', () => ({ AuditTrailCard: () => null }))
vi.mock('../readiness/EventReadinessCard', () => ({
  EventReadinessCard: (props: unknown) => { mocks.readiness(props); return <p>Coordinator readiness</p> },
}))
vi.mock('../components/EventVenueBookings', () => ({
  EventVenueBookings: (props: unknown) => { mocks.bookings(props); return <p>Staff venue bookings</p> },
}))
vi.mock('../../safety/SafetyReviewDecisionsPanel', () => ({
  SafetyReviewDecisionsPanel: (props: unknown) => { mocks.safety(props); return <p>Internal safety decisions</p> },
}))

test('AC-042.3.4: the shared request page mounts venue and equipment arrangements only for the owning organiser', async () => {
  for (const [role, owner, visible] of [
    ['organiser', 'viewer', true], ['organiser', 'someone-else', false],
    ['coordinator', 'viewer', false], ['coordinator_lead', 'viewer', false],
    ['venue_staff', 'viewer', false], ['attendee', 'viewer', false],
    ['tech_support', 'viewer', false], ['operations_manager', 'viewer', false],
  ] as const) {
    Object.assign(mocks, { role, owner })
    mocks.panel.mockClear()
    mocks.equipment.mockClear()
    const { unmount } = render(<MemoryRouter initialEntries={['/requests/event1']}>
      <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
    </MemoryRouter>)
    await screen.findByRole('heading', { name: 'Venue test event' })
    if (visible) {
      expect(screen.getByText('Venue arrangements panel')).toBeInTheDocument()
      expect(screen.getByText('Equipment arrangements panel')).toBeInTheDocument()
      expect(mocks.equipment).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event1' }))
      await waitFor(() => expect(mocks.panel).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event1' })))
    } else {
      expect(screen.queryByText('Venue arrangements panel')).not.toBeInTheDocument()
      expect(mocks.panel).not.toHaveBeenCalled()
      expect(screen.queryByText('Equipment arrangements panel')).not.toBeInTheDocument()
      expect(mocks.equipment).not.toHaveBeenCalled()
    }
    unmount()
  }
})

test('AC-042.3.8: internal readiness, booking and safety panels mount only for the assigned Coordinator, leaving Organiser summaries available', async () => {
  for (const [role, coordinator, allowed] of [
    ['organiser', 'viewer', false], ['coordinator', 'viewer', true],
    ['coordinator', 'someone-else', false], ['coordinator_lead', 'viewer', false],
    ['attendee', 'viewer', false],
  ] as const) {
    Object.assign(mocks, { role, coordinator, owner: 'viewer' })
    for (const spy of [mocks.readiness, mocks.bookings, mocks.safety]) spy.mockClear()
    const { unmount } = render(<MemoryRouter initialEntries={['/requests/event1']}>
      <Routes><Route path="/requests/:id" element={<ReviewRequestDetailPage />} /></Routes>
    </MemoryRouter>)
    await screen.findByRole('heading', { name: 'Venue test event' })
    for (const [text, spy] of [
      ['Coordinator readiness', mocks.readiness], ['Staff venue bookings', mocks.bookings],
      ['Internal safety decisions', mocks.safety],
    ] as const) {
      if (allowed) {
        expect(screen.getByText(text)).toBeInTheDocument()
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event1' }))
      } else {
        expect(screen.queryByText(text)).not.toBeInTheDocument()
        expect(spy).not.toHaveBeenCalled()
      }
    }
    if (role === 'organiser') {
      expect(screen.getByText('Venue arrangements panel')).toBeInTheDocument()
      expect(screen.getByText('Equipment arrangements panel')).toBeInTheDocument()
    }
    unmount()
  }
})
