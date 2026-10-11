import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'
import type { EventRequestSummary } from '../types'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('../eventReviewService', () => ({ listEventRequests: mocks.list }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'coordinator-a', role: 'coordinator' } }),
}))
// Lead-only service is not used by the coordinator view.
vi.mock('../coordinatorAssignmentService', () => ({ listAssignmentCoordinators: vi.fn() }))

test('AC-017.4.6: coordinator sees assigned requests first and refresh moves reassigned requests between sections', async () => {
  const base: EventRequestSummary = {
    id: 'other', reference: 'EVT-001', organiserId: 'organiser', coordinatorId: 'coordinator-b',
    name: 'Other event', purpose: 'Workshop', eventType: 'Workshop',
    proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
    expectedAttendance: 40, status: 'submitted', submittedAt: '2029-12-01T01:00:00Z', reviewNote: null,
  }
  const rows = [
    base,
    { ...base, id: 'mine-new', name: 'My newer event', coordinatorId: 'coordinator-a' },
    { ...base, id: 'unassigned', name: 'Unassigned event', coordinatorId: null },
    { ...base, id: 'mine-old', name: 'My older event', coordinatorId: 'coordinator-a' },
  ]
  mocks.list.mockResolvedValue({ ok: true, requests: rows })
  const user = userEvent.setup()
  render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
  await screen.findByText('My newer event')
  const mine = screen.getByRole('region', { name: 'Assigned to me' })
  const others = screen.getByRole('region', { name: 'Other event requests' })
  expect(mine.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(mine).getAllByRole('heading', { level: 3 }).map(el => el.textContent))
    .toEqual(['My newer event', 'My older event'])
  expect(within(others).getAllByRole('heading', { level: 3 }).map(el => el.textContent))
    .toEqual(['Other event', 'Unassigned event'])
  expect(within(mine).getAllByText('Assigned to you')).toHaveLength(2)
  expect(within(others).queryByText('Assigned to you')).not.toBeInTheDocument()
  expect(within(mine).getAllByRole('link')[0]).toHaveAttribute('href', '/requests/mine-new')

  mocks.list.mockResolvedValue({ ok: true, requests: rows.map(row => ({ ...row, coordinatorId: 'coordinator-b' })) })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  await waitFor(() => expect(within(mine).queryAllByRole('listitem')).toHaveLength(0))
  expect(within(mine).getByText('No event requests are assigned to you yet.')).toBeInTheDocument()
  expect(within(others).getAllByRole('listitem')).toHaveLength(4)

  mocks.list.mockResolvedValue({ ok: true, requests: [] })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  await waitFor(() => expect(screen.queryAllByRole('listitem')).toHaveLength(0))
  expect(screen.getByRole('region', { name: 'Assigned to me' })).toHaveTextContent('No event requests are assigned to you yet.')
})
