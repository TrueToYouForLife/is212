import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OpenEventDetailsPage } from '../pages/OpenEventDetailsPage'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import type { OpenEventDetails } from '../types'

const mocks = vi.hoisted(() => ({ loadOpenEvent: vi.fn(), registerForEvent: vi.fn() }))

vi.mock('../registrationService', () => ({
  loadOpenEvent: mocks.loadOpenEvent,
  registerForEvent: mocks.registerForEvent,
}))

const details: OpenEventDetails = {
  id: 'event-1',
  name: 'Data Workshop',
  eventType: 'Workshop',
  start: '2035-03-10T01:00:00Z',
  end: '2035-03-10T09:00:00Z',
  venue: 'Main Hall (Level 1)',
  registered: false,
  description: 'Hands-on data workshop',
  programme: '09:00 Welcome; 10:00 Labs',
  prerequisites: 'Bring a laptop',
  full: false,
  waitlist: null,
}

const attendee: CurrentUser = {
  session: { userId: 'user-1', email: 'ann@example.test' },
  profile: { id: 'user-1', fullName: 'Ann One', role: 'attendee' },
  loading: false,
  refresh: vi.fn(),
}

function renderDetails() {
  render(
    <SessionContext.Provider value={attendee}>
      <MemoryRouter initialEntries={['/events/open/event-1']}>
        <Routes>
          <Route path="/events/open/:id" element={<OpenEventDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.loadOpenEvent.mockResolvedValue({ ok: true, value: details })
})

describe('AC-015.1: the Attendee views details of a confirmed event', () => {
  test('AC-015.1.8: shows the event, its prerequisites and the information needed to register', async () => {
    renderDetails()

    expect(await screen.findByRole('heading', { name: 'Data Workshop' })).toBeInTheDocument()
    expect(mocks.loadOpenEvent).toHaveBeenCalledWith('event-1')
    // Singapore time, through the shared formatter.
    expect(screen.getByText(new RegExp(formatDateTime(details.start)))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(formatDateTime(details.end)))).toBeInTheDocument()
    expect(screen.getByText('Main Hall (Level 1)')).toBeInTheDocument()
    expect(screen.getByText('Hands-on data workshop')).toBeInTheDocument()
    expect(screen.getByText('09:00 Welcome; 10:00 Labs')).toBeInTheDocument()
    expect(screen.getByText('Bring a laptop')).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /meet the prerequisites/i })).toBeInTheDocument()
  })

  test('AC-015.1.9: says so when there are no prerequisites and no venue yet (boundary)', async () => {
    mocks.loadOpenEvent.mockResolvedValue({ ok: true, value: { ...details, prerequisites: null, venue: null } })
    renderDetails()

    expect(await screen.findByText('No prerequisites for this event.')).toBeInTheDocument()
    expect(screen.getByText('Venue to be confirmed')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /meet the prerequisites/i })).not.toBeInTheDocument()
  })
})

describe('AC-015.4: registration is only offered where it is enabled', () => {
  test('AC-015.4.6: an event that is not open shows no form', async () => {
    mocks.loadOpenEvent.mockResolvedValue({ ok: false, reason: 'This event is not open for registration.' })
    renderDetails()

    expect(await screen.findByText('This event is not open for registration.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /events open for registration/i })).toHaveAttribute('href', '/events/open')
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument()
  })
})

describe('AC-015.5: an Attendee cannot register twice for the same event', () => {
  test('AC-015.5.6: someone already registered sees that, not the form', async () => {
    mocks.loadOpenEvent.mockResolvedValue({ ok: true, value: { ...details, registered: true } })
    renderDetails()

    expect(await screen.findByText("You're registered for this event.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my registrations/i })).toHaveAttribute('href', '/registrations')
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument()
  })
})
