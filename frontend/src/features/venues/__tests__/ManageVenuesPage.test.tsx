import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ManageVenuesPage } from '../pages/ManageVenuesPage'

const mocks = vi.hoisted(() => ({ role: 'venue_staff' as string, userLoading: false, list: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: { id: 'user-1', role: mocks.role } }),
}))
vi.mock('../venueManagementService', () => ({ listManagedVenues: mocks.list }))

function renderPage() {
  return render(<MemoryRouter><ManageVenuesPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.userLoading = false
  mocks.list.mockResolvedValue({ ok: true, venues: [
    { id: 'v1', name: 'Alpha Hall', location: 'Level 1', status: 'active', capacity: 120 },
    { id: 'v2', name: 'Beta Room', location: '', status: 'retired', capacity: 20 },
  ] })
})

describe('AC-046.2 — Venue Staff can edit any of a venue’s details', () => {
  test('AC-046.2.20: Venue Staff see every venue with a link to edit it, and a way to add one', async () => {
    renderPage()
    expect(screen.getByText('Loading venues…')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Edit Alpha Hall' })).toHaveAttribute('href', '/venues/v1/edit')
    expect(screen.getByRole('link', { name: 'Edit Beta Room' })).toHaveAttribute('href', '/venues/v2/edit')
    expect(screen.getByText('Level 1 · up to 120 · Active')).toBeInTheDocument()
    expect(screen.getByText('up to 20 · Retired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add venue' })).toHaveAttribute('href', '/venues/new')
  })

  test('AC-046.2.21: a failed list is reported; an empty catalogue says so', async () => {
    mocks.list.mockResolvedValueOnce({ ok: false, reason: 'The venues could not be loaded. Please try again.' })
    const { unmount } = renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('The venues could not be loaded.')
    unmount()
    mocks.list.mockResolvedValueOnce({ ok: true, venues: [] })
    renderPage()
    expect(await screen.findByText('No venues yet')).toBeInTheDocument()
  })

  test('AC-046.2.22: leaving before the list arrives does not update the page', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.list.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderPage()
    await waitFor(() => expect(mocks.list).toHaveBeenCalled())
    unmount()
    finish({ ok: true, venues: [] })
    await Promise.resolve()
    expect(screen.queryByText('No venues yet')).toBeNull()
  })
})

describe('AC-046.6 — only Venue Staff can edit venues', () => {
  test.each(['coordinator', 'coordinator_lead', 'organiser', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-046.6.16: a %s is told managing venues is for Venue Staff, and nothing is loaded',
    (role) => {
      mocks.role = role
      renderPage()
      expect(screen.getByText('Managing venues is available to Venue Staff.')).toBeInTheDocument()
      expect(mocks.list).not.toHaveBeenCalled()
    },
  )

  test('AC-046.6.17: while the session is still loading, nothing is shown or loaded yet', () => {
    mocks.userLoading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
