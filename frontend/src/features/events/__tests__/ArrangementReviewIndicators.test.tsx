import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'
const mocks = vi.hoisted(() => ({ counts: vi.fn(), role: 'coordinator' }))
vi.mock('../arrangementReviewService', () => ({ listArrangementReviewCounts: mocks.counts }))
vi.mock('../eventReviewService', () => ({ listEventRequests: async () => ({ ok: true, requests: [
  { id: 'mine', coordinatorId: 'viewer', name: 'My event', status: 'approved' },
  { id: 'other', coordinatorId: 'another', name: 'Other event', status: 'approved' },
] }) }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }) }))
vi.mock('../coordinatorAssignmentService', () => ({ listAssignmentCoordinators: vi.fn() }))
test('AC-041.1.12: request badges are assigned-only, preserve status, refresh and report failed counts', async () => {
  const user = userEvent.setup()
  mocks.counts.mockResolvedValue({ ok: true, value: { mine: 2, other: 3 } })
  const { unmount } = render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
  const mine = await screen.findByRole('link', { name: /My event/ })
  expect(within(mine).getByText('Needs review · 2 arrangements')).toBeInTheDocument()
  expect(within(mine).getByText('Approved')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Other event/ })).not.toHaveTextContent('Needs review')
  mocks.counts.mockResolvedValue({ ok: false, reason: 'Failed' })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Review indicators are unavailable')
  expect(screen.queryByText(/Needs review/)).not.toBeInTheDocument()
  mocks.counts.mockResolvedValue({ ok: true, value: { mine: 1 } })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  expect(await screen.findByText('Needs review · 1 arrangement')).toBeInTheDocument()
  unmount()
  mocks.counts.mockClear()
  mocks.role = 'organiser'
  render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
  await screen.findByRole('link', { name: /My event/ })
  expect(mocks.counts).not.toHaveBeenCalled()
  expect(screen.queryByText(/Needs review/)).not.toBeInTheDocument()
})
