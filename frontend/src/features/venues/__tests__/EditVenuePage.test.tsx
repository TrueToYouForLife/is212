import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EditVenuePage } from '../pages/EditVenuePage'

const mocks = vi.hoisted(() => ({
  role: 'venue_staff' as string,
  userLoading: false,
  loadVenue: vi.fn(),
  loadLayouts: vi.fn(),
  update: vi.fn(),
  retire: vi.fn(),
}))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: { id: 'user-1', role: mocks.role } }),
}))
vi.mock('../venueManagementService', () => ({
  loadVenueForEdit: mocks.loadVenue,
  loadLayoutOptions: mocks.loadLayouts,
  updateVenue: mocks.update,
  retireVenue: mocks.retire,
}))

const VENUE = {
  id: 'venue-1', name: 'Grand Hall', location: 'Level 1', status: 'active', opensAt: '07:00', closesAt: '24:00',
  accessibility: ['wheelchair_access'], facilities: ['projector'],
  layouts: [{ layout: 'theatre', capacity: 120 }], version: 'v1',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/venues/venue-1/edit']}>
      <Routes><Route path="/venues/:id/edit" element={<EditVenuePage />} /></Routes>
    </MemoryRouter>,
  )
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.userLoading = false
  mocks.loadVenue.mockResolvedValue({ ok: true, venue: VENUE })
  mocks.loadLayouts.mockResolvedValue({ ok: true, layouts: [{ code: 'theatre', label: 'Theatre' }, { code: 'classroom', label: 'Classroom' }] })
  mocks.update.mockResolvedValue({ ok: true, flagged: 0 })
  mocks.retire.mockResolvedValue({ ok: true, flagged: 0 })
})

describe('AC-046.2 — Venue Staff can edit any of a venue’s details', () => {
  test('AC-046.2.23: the venue opens with its current details filled in', async () => {
    renderPage()
    expect(screen.getByText('Loading the venue…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Edit Grand Hall' })).toBeInTheDocument()
    expect(mocks.loadVenue).toHaveBeenCalledWith('venue-1')
    expect(screen.getByLabelText(/^Venue name/)).toHaveValue('Grand Hall')
    expect(screen.getByLabelText('Closes at')).toHaveValue('24:00')
    expect(screen.getByLabelText('Capacity for layout 1')).toHaveValue('120')
    expect(screen.getByLabelText('Wheelchair access')).toBeChecked()
  })

  test('AC-046.2.24: saving sends the edited details with the version the venue was opened at', async () => {
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    type(/^Venue name/, 'Grand Hall East')
    type('Capacity for layout 1', '90')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Venue updated')).toBeInTheDocument()
    expect(mocks.update).toHaveBeenCalledWith('venue-1', 'v1', expect.objectContaining({
      name: 'Grand Hall East', layouts: [{ layout: 'theatre', capacity: 90 }],
    }))
    expect(screen.getByText('No existing bookings needed a review.')).toBeInTheDocument()
  })

  test('AC-046.2.25: an edit someone else got to first is explained, and reloading shows their changes', async () => {
    mocks.update.mockResolvedValue({ ok: false, reason: 'Someone else changed this venue while you were editing.', stale: true })
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this venue')

    mocks.loadVenue.mockResolvedValue({ ok: true, venue: { ...VENUE, name: 'Renamed Hall', version: 'v2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reload the venue' }))
    expect(await screen.findByRole('heading', { name: 'Edit Renamed Hall' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('AC-046.2.26: any other refusal keeps the edits as typed and shows why, with no reload offered', async () => {
    mocks.update.mockResolvedValue({ ok: false, reason: 'Another venue already has this name. Choose a different name.' })
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    type(/^Venue name/, 'Taken Name')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Another venue already has this name.')
    expect(screen.getByLabelText(/^Venue name/)).toHaveValue('Taken Name')
    expect(screen.queryByRole('button', { name: 'Reload the venue' })).toBeNull()
  })

  test('AC-046.2.27: a feature the catalogue no longer offers is named before saving', async () => {
    mocks.loadVenue.mockResolvedValue({ ok: true, venue: { ...VENUE, facilities: ['projector', 'piano'] } })
    renderPage()
    expect(await screen.findByText(/This venue lists piano, which the catalogue no longer offers/)).toBeInTheDocument()
  })

  test('AC-046.2.28: a venue or layout options that cannot be loaded are reported instead of a form', async () => {
    mocks.loadVenue.mockResolvedValueOnce({ ok: false, reason: 'This venue could not be found. It may have been removed.' })
    const { unmount } = renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('This venue could not be found.')
    expect(screen.queryByLabelText(/^Venue name/)).toBeNull()
    unmount()
    mocks.loadLayouts.mockResolvedValueOnce({ ok: false, reason: 'The layout options could not be loaded. Please reload the page.' })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('The layout options could not be loaded.')
  })

  test('AC-046.2.29: "Edit again" reopens the venue as saved; leaving before it loads does not update the page', async () => {
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit again' }))
    expect(await screen.findByLabelText(/^Venue name/)).toBeInTheDocument()
    expect(mocks.loadVenue).toHaveBeenCalledTimes(2)

    let finish: (value: unknown) => void = () => undefined
    mocks.loadVenue.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const second = renderPage()
    second.unmount()
    finish({ ok: true, venue: VENUE })
    await Promise.resolve()
  })
})

describe('AC-046.4 — bookings an edit may have made unsuitable are flagged', () => {
  test.each([
    [1, '1 booking may no longer suit this venue, so their Coordinators have been asked to review them. No booking was changed.'],
    [3, '3 bookings may no longer suit this venue, so their Coordinators have been asked to review them. No booking was changed.'],
  ])('AC-046.4.16: after saving, Venue Staff are told %i booking(s) were sent for review and none was changed', async (flagged, message) => {
    mocks.update.mockResolvedValue({ ok: true, flagged })
    renderPage()
    await screen.findByLabelText(/^Venue name/)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})

describe('AC-046.6 — only Venue Staff can edit venues', () => {
  test.each(['coordinator', 'coordinator_lead', 'organiser', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-046.6.18: a %s is told editing venues is for Venue Staff, and nothing is loaded',
    (role) => {
      mocks.role = role
      renderPage()
      expect(screen.getByText('Editing venues is available to Venue Staff.')).toBeInTheDocument()
      expect(mocks.loadVenue).not.toHaveBeenCalled()
    },
  )

  test('AC-046.6.19: while the session is still loading, nothing is shown or loaded yet', async () => {
    mocks.userLoading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    await waitFor(() => expect(mocks.loadVenue).not.toHaveBeenCalled())
  })
})

describe('AC-046.5 — Venue Staff can retire a venue', () => {
  async function retire(note = 'Building closes') {
    await screen.findByLabelText(/^Venue name/)
    fireEvent.change(screen.getByLabelText('Why is it being retired?'), { target: { value: note } })
    fireEvent.click(screen.getByRole('button', { name: 'Retire venue…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm retirement' }))
  }

  test.each([
    [0, 'No existing bookings needed a review.'],
    [1, '1 booking at this venue have been sent to their Coordinators to find another venue. No booking was cancelled.'],
    [4, '4 bookings at this venue have been sent to their Coordinators to find another venue. No booking was cancelled.'],
  ])('AC-046.5.22: after retiring, Venue Staff are told the venue left search and %i booking(s) went for review', async (flagged, message) => {
    mocks.retire.mockResolvedValue({ ok: true, flagged })
    renderPage()
    await retire()
    expect(await screen.findByText('Venue retired')).toBeInTheDocument()
    expect(screen.getByText(/has been retired and no longer appears in venue search/)).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(mocks.retire).toHaveBeenCalledWith('venue-1', 'v1', 'Building closes')
  })

  test('AC-046.5.23: a retired venue opens saying so and why, with no way to retire it again', async () => {
    mocks.loadVenue.mockResolvedValue({ ok: true, venue: { ...VENUE, status: 'retired', retirementNote: 'Building closes' } })
    renderPage()
    expect(await screen.findByText(/This venue is retired \(Building closes\)\. It no longer appears in venue search/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retire venue…' })).toBeNull()
  })

  test('AC-046.5.24: a retired venue with no reason recorded still says it is retired', async () => {
    mocks.loadVenue.mockResolvedValue({ ok: true, venue: { ...VENUE, status: 'retired', retirementNote: null } })
    renderPage()
    expect(await screen.findByText('This venue is retired. It no longer appears in venue search and cannot take new bookings.')).toBeInTheDocument()
  })

  test('AC-046.5.25: a refused retirement is explained, with a reload when someone else changed the venue', async () => {
    mocks.retire.mockResolvedValueOnce({ ok: false, reason: 'Someone else changed this venue while you were editing.', stale: true })
    renderPage()
    await retire()
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this venue')
    expect(screen.getByRole('button', { name: 'Reload the venue' })).toBeInTheDocument()
    expect(screen.queryByText('Venue retired')).toBeNull()
  })
})
