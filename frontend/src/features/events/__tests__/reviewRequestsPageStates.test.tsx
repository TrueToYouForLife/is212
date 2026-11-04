import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'

const mocks = vi.hoisted(() => ({
  user: { loading: false, profile: { id: 'user-1', role: 'organiser' } as null | { id: string; role: string } },
  listEventRequests: vi.fn(), listArrangementReviewCounts: vi.fn(), loadCoordinatorNames: vi.fn(),
}))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => mocks.user }))
vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  listEventRequests: mocks.listEventRequests,
}))
vi.mock('../arrangementReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../arrangementReviewService')>()),
  listArrangementReviewCounts: mocks.listArrangementReviewCounts,
}))
vi.mock('../eventCoordinatorService', () => ({ loadCoordinatorNames: mocks.loadCoordinatorNames }))

function renderPage() {
  return render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.loading = false
  mocks.user.profile = { id: 'user-1', role: 'organiser' }
  mocks.listEventRequests.mockResolvedValue({ ok: true, requests: [] })
  mocks.listArrangementReviewCounts.mockResolvedValue({ ok: true, value: {} })
  mocks.loadCoordinatorNames.mockResolvedValue({ ok: true, value: {} })
})

describe('AC-004.1 — the request list in its less common states', () => {
  test('AC-004.1.13: while the session is checked the list waits and asks for nothing', async () => {
    mocks.user.loading = true
    mocks.user.profile = null
    renderPage()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Loading requests…')).toBeInTheDocument()
    expect(mocks.listEventRequests).not.toHaveBeenCalled()
  })

  test('AC-004.1.14: when the requests cannot be loaded, the reason is shown as an alert', async () => {
    mocks.listEventRequests.mockResolvedValue({ ok: false, reason: 'The event requests could not be loaded.' })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('The event requests could not be loaded.')
  })

  test('AC-004.1.15: an organiser with no requests is told they have not created any', async () => {
    renderPage()
    expect(await screen.findByText('You have not created any event requests yet.')).toBeInTheDocument()
    expect(mocks.listEventRequests).toHaveBeenCalledWith(true)
  })

  test('AC-004.1.16: an operations manager with nothing submitted is told requests appear once submitted', async () => {
    mocks.user.profile = { id: 'user-2', role: 'operations_manager' }
    renderPage()
    expect(await screen.findByText(/No requests have been submitted yet/)).toBeInTheDocument()
    expect(screen.getByText('Event operations manager')).toBeInTheDocument()
    expect(mocks.listEventRequests).toHaveBeenCalledWith(false)
  })
})
