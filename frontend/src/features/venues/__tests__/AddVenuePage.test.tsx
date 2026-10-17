import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AddVenuePage } from '../pages/AddVenuePage'

const mocks = vi.hoisted(() => ({
  role: 'venue_staff' as string,
  userLoading: false,
  loadLayouts: vi.fn(),
  addVenue: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: { id: 'user-1', role: mocks.role } }),
}))
vi.mock('../venueManagementService', () => ({
  loadLayoutOptions: mocks.loadLayouts,
  addVenue: mocks.addVenue,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AddVenuePage />
    </MemoryRouter>,
  )
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

function fillValidVenue(name = 'Grand Hall') {
  type(/^Venue name/, name)
  type(/^Location/, 'Level 1')
  type('Opens at', '07:00')
  type('Closes at', '18:00')
  type('Layout 1', 'theatre')
  type('Capacity for layout 1', '120')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.userLoading = false
  mocks.loadLayouts.mockResolvedValue({ ok: true, layouts: [{ code: 'theatre', label: 'Theatre' }] })
  mocks.addVenue.mockResolvedValue({ ok: true, venueId: 'venue-1' })
})

describe('AC-046.1 — Venue Staff can add a venue with its details', () => {
  test('AC-046.1.24: Venue Staff add a venue and are told it is in the catalogue', async () => {
    renderPage()
    expect(screen.getByText('Loading layout options…')).toBeInTheDocument()
    await screen.findByLabelText(/^Venue name/)

    fillValidVenue()
    fireEvent.click(screen.getByRole('button', { name: 'Add venue' }))

    expect(await screen.findByText('Venue added')).toBeInTheDocument()
    expect(screen.getByText('Grand Hall')).toBeInTheDocument()
    expect(mocks.addVenue).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Grand Hall', layouts: [{ layout: 'theatre', capacity: 120 }],
    }))
    expect(screen.getByRole('link', { name: 'View venue availability' })).toHaveAttribute('href', '/venues/availability')
  })

  test('AC-046.1.25: "Add another venue" opens an empty form', async () => {
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    fillValidVenue()
    fireEvent.click(screen.getByRole('button', { name: 'Add venue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add another venue' }))

    expect(screen.getByLabelText(/^Venue name/)).toHaveValue('')
    expect(screen.getByLabelText('Layout 1')).toHaveValue('')
  })

  test('AC-046.1.26: a refused venue keeps the form as typed and shows why', async () => {
    mocks.addVenue.mockResolvedValue({ ok: false, reason: 'Another venue already has this name. Choose a different name.' })
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    fillValidVenue()
    fireEvent.click(screen.getByRole('button', { name: 'Add venue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Another venue already has this name.')
    expect(screen.getByLabelText(/^Venue name/)).toHaveValue('Grand Hall')
    expect(screen.queryByText('Venue added')).toBeNull()
  })

  test('AC-046.1.27: if the layout options cannot be loaded, the page says so instead of showing the form', async () => {
    mocks.loadLayouts.mockResolvedValue({ ok: false, reason: 'The layout options could not be loaded. Please reload the page.' })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('The layout options could not be loaded.')
    expect(screen.queryByLabelText(/^Venue name/)).toBeNull()
  })

  test('AC-046.1.28: leaving the page before the layout options arrive does not update it', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.loadLayouts.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderPage()
    await waitFor(() => expect(mocks.loadLayouts).toHaveBeenCalled())
    unmount()
    finish({ ok: true, layouts: [{ code: 'theatre', label: 'Theatre' }] })
    await Promise.resolve()
    expect(screen.queryByLabelText(/^Venue name/)).toBeNull()
  })
})

describe('AC-046.6 — only Venue Staff can add venues', () => {
  test.each(['coordinator', 'coordinator_lead', 'organiser', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-046.6.9: a %s is told adding venues is for Venue Staff, and nothing is loaded',
    (role) => {
      mocks.role = role
      renderPage()
      expect(screen.getByText('Adding venues is available to Venue Staff.')).toBeInTheDocument()
      expect(screen.queryByLabelText(/^Venue name/)).toBeNull()
      expect(mocks.loadLayouts).not.toHaveBeenCalled()
    },
  )

  test('AC-046.6.10: while the session is still loading, nothing is shown or loaded yet', () => {
    mocks.userLoading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.loadLayouts).not.toHaveBeenCalled()
  })
})
