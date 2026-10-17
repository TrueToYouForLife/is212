import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RequestListItem } from '../components/RequestListItem'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'
import type { EventRequestSummary } from '../types'

/** US17 AC4: the Requests list names the assigned Coordinator on each card. */
const mocks = vi.hoisted(() => ({ role: 'organiser', list: vi.fn(), names: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))
vi.mock('../eventReviewService', () => ({ listEventRequests: mocks.list }))
vi.mock('../eventCoordinatorService', () => ({ loadCoordinatorNames: mocks.names }))
vi.mock('../arrangementReviewService', () => ({ listArrangementReviewCounts: async () => ({ ok: true, value: {} }) }))
vi.mock('../coordinatorAssignmentService', () => ({ listAssignmentCoordinators: async () => ({ ok: true, value: [] }) }))

const request: EventRequestSummary = {
  id: 'e-1', reference: 'EVT-1', organiserId: 'viewer', coordinatorId: 'c-9', name: 'Data Workshop',
  purpose: 'Workshop', eventType: 'Workshop', proposedStart: '2035-03-10T01:00:00Z',
  proposedEnd: '2035-03-10T09:00:00Z', expectedAttendance: 40, status: 'confirmed',
  submittedAt: '2035-01-01T01:00:00Z', reviewNote: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'organiser'
  mocks.list.mockResolvedValue({ ok: true, requests: [request] })
  mocks.names.mockResolvedValue({ ok: true, value: { 'e-1': 'Cleo Coord' } })
})

describe('AC-017.4: the card names the Coordinator', () => {
  test('AC-017.4.21: a card shows the label it is given, and nothing when it has none', () => {
    const { rerender } = render(
      <MemoryRouter><ul><RequestListItem request={request} coordinatorLabel="Cleo Coord" /></ul></MemoryRouter>)
    expect(screen.getByText('Coordinator: Cleo Coord')).toBeInTheDocument()

    rerender(<MemoryRouter><ul><RequestListItem request={request} coordinatorLabel={null} /></ul></MemoryRouter>)
    expect(screen.queryByText(/^Coordinator:/)).not.toBeInTheDocument()
  })

  test('AC-017.4.22: an Organiser\'s own requests show who coordinates each event', async () => {
    render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
    expect(await screen.findByText('Coordinator: Cleo Coord')).toBeInTheDocument()
    expect(mocks.names).toHaveBeenCalledWith(['e-1'])
  })

  test('AC-017.4.23: an Operations Manager sees the names too', async () => {
    mocks.role = 'operations_manager'
    render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
    expect(await screen.findByText('Coordinator: Cleo Coord')).toBeInTheDocument()
  })

  test('AC-017.4.24: if the names cannot be loaded, the card still says someone is assigned', async () => {
    mocks.names.mockResolvedValue({ ok: false, reason: 'Coordinator names could not be loaded.' })
    render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
    expect(await screen.findByText('Coordinator: Coordinator assigned')).toBeInTheDocument()
  })

  test('AC-017.4.25: a Coordinator Lead\'s view does not look names up; its cards already name them', async () => {
    mocks.role = 'coordinator_lead'
    render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
    await waitFor(() => expect(mocks.list).toHaveBeenCalled())
    await screen.findByRole('heading', { name: 'Coordinator assignments' })
    expect(mocks.names).not.toHaveBeenCalled()
  })
})
