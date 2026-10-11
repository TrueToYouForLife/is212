import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyRegistrationsPage } from '../pages/MyRegistrationsPage'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import type { MyRegistration } from '../types'

const mocks = vi.hoisted(() => ({ loadMyRegistrations: vi.fn(), withdrawRegistration: vi.fn() }))
vi.mock('../registrationService', () => ({
  loadMyRegistrations: mocks.loadMyRegistrations,
  withdrawRegistration: mocks.withdrawRegistration,
}))

const attendee: CurrentUser = {
  session: { userId: 'user-1', email: 'ann@example.test' },
  profile: { id: 'user-1', fullName: 'Ann One', role: 'attendee' },
  loading: false,
  refresh: vi.fn(),
}

const registrations: MyRegistration[] = [
  {
    registrationId: 'r-1', eventId: 'e-1', eventName: 'Data Workshop',
    start: '2035-03-10T01:00:00Z', end: '2035-03-10T09:00:00Z', venue: 'Main Hall (Level 1)',
    eventStatus: 'confirmed', eventStatusLabel: 'Confirmed',
    registrationStatus: 'registered', registrationStatusLabel: 'Registered',
  },
  {
    registrationId: 'r-2', eventId: 'e-2', eventName: 'Spring Gala',
    start: '2035-04-01T10:00:00Z', end: null, venue: null,
    eventStatus: 'cancelled', eventStatusLabel: 'Cancelled',
    registrationStatus: 'registered', registrationStatusLabel: 'Registered',
  },
]

function renderPage() {
  render(
    <SessionContext.Provider value={attendee}>
      <MemoryRouter>
        <MyRegistrationsPage />
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.loadMyRegistrations.mockResolvedValue({ ok: true, value: registrations })
})

describe('AC-015.7: the Attendee sees their registrations', () => {
  test('AC-015.7.6: each registration shows its event name, date, venue, event status and registration status', async () => {
    renderPage()

    const workshop = (await screen.findByText('Data Workshop')).closest('li')
    const gala = screen.getByText('Spring Gala').closest('li')
    if (!workshop || !gala) throw new Error('each registration should be a list item')

    expect(within(workshop).getByText(new RegExp(formatDateTime(registrations[0].start)))).toBeInTheDocument()
    expect(within(workshop).getByText('Main Hall (Level 1)')).toBeInTheDocument()
    expect(within(workshop).getByText(/Confirmed/)).toBeInTheDocument()
    expect(within(workshop).getByText(/Registered/)).toBeInTheDocument()

    expect(within(gala).getByText(new RegExp(formatDateTime(registrations[1].start)))).toBeInTheDocument()
    expect(within(gala).getByText('Venue to be confirmed')).toBeInTheDocument()
    expect(within(gala).getByText(/Cancelled/)).toBeInTheDocument()
    expect(within(gala).getByText(/Registered/)).toBeInTheDocument()
  })

  test('AC-015.7.7: says so when there are no registrations yet (boundary)', async () => {
    mocks.loadMyRegistrations.mockResolvedValue({ ok: true, value: [] })
    renderPage()

    expect(await screen.findByText('You have not registered for any events yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /events open for registration/i })).toHaveAttribute('href', '/events/open')
  })

  test('AC-015.7.8: a load error is shown', async () => {
    mocks.loadMyRegistrations.mockResolvedValue({ ok: false, reason: 'Events could not be loaded. Please try again.' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Events could not be loaded. Please try again.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  test('AC-015.7.10: after a load error, Try again loads the registrations', async () => {
    mocks.loadMyRegistrations
      .mockResolvedValueOnce({ ok: false, reason: 'Events could not be loaded. Please try again.' })
      .mockResolvedValue({ ok: true, value: registrations })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Data Workshop')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

const withdrawnRegistration: MyRegistration = {
  ...registrations[0], registrationId: 'r-3', eventName: 'Past Talk',
  registrationStatus: 'withdrawn', registrationStatusLabel: 'Withdrawn',
}
const workshopNowWithdrawn: MyRegistration = {
  ...registrations[0], registrationStatus: 'withdrawn', registrationStatusLabel: 'Withdrawn',
}

describe('AC-023: the Attendee withdraws from My registrations', () => {
  test('AC-023.1.10: Withdraw is offered only on a future, active, Confirmed registration', async () => {
    const started: MyRegistration = {
      ...registrations[0], registrationId: 'r-4', eventName: 'Started Meetup', start: '2020-01-01T00:00:00Z',
    }
    mocks.loadMyRegistrations.mockResolvedValue({
      ok: true, value: [registrations[0], registrations[1], withdrawnRegistration, started],
    })
    renderPage()

    const workshop = (await screen.findByText('Data Workshop')).closest('li')
    if (!workshop) throw new Error('each registration should be a list item')

    expect(screen.getAllByRole('button', { name: 'Withdraw' })).toHaveLength(1)
    expect(within(workshop).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
  })

  test('AC-023.3.5: after withdrawing, the row shows Withdrawn and no longer offers Withdraw', async () => {
    mocks.loadMyRegistrations
      .mockResolvedValueOnce({ ok: true, value: [registrations[0]] })
      .mockResolvedValue({ ok: true, value: [workshopNowWithdrawn] })
    mocks.withdrawRegistration.mockResolvedValue({ ok: true })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Your registration for Data Workshop has been withdrawn.')
    expect(await screen.findByText(/Registration: Withdrawn/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
  })

  test('AC-023.5.9: a registration already withdrawn elsewhere is explained and the list reloads', async () => {
    mocks.loadMyRegistrations
      .mockResolvedValueOnce({ ok: true, value: [registrations[0]] })
      .mockResolvedValue({ ok: true, value: [workshopNowWithdrawn] })
    mocks.withdrawRegistration.mockResolvedValue({
      ok: false, reason: 'This registration has already been withdrawn.', stale: true,
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This registration has already been withdrawn.')
    expect(await screen.findByText(/Registration: Withdrawn/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
  })
})
