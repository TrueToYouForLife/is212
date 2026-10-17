import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyRegistrationsPage } from '../pages/MyRegistrationsPage'
import { WaitlistListItem } from '../components/WaitlistListItem'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import type { MyWaitlistEntry } from '../types'

/** US16: the Attendee's waiting lists, in My registrations. */
const mocks = vi.hoisted(() => ({ loadMyRegistrations: vi.fn(), loadMyWaitlist: vi.fn(), leave: vi.fn() }))
vi.mock('../registrationService', () => ({
  loadMyRegistrations: mocks.loadMyRegistrations, withdrawRegistration: vi.fn(),
}))
vi.mock('../waitlistService', () => ({ loadMyWaitlist: mocks.loadMyWaitlist, leaveWaitlist: mocks.leave }))

const attendee: CurrentUser = {
  session: { userId: 'user-1', email: 'ann@example.test' },
  profile: { id: 'user-1', fullName: 'Ann One', role: 'attendee' },
  loading: false,
  refresh: vi.fn(),
}
const base: MyWaitlistEntry = {
  entryId: 'entry-1', eventId: 'event-1', eventName: 'Data Workshop', start: '2035-03-10T01:00:00Z',
  venue: null, status: 'waiting', position: 2, offerExpiresAt: null,
}
const onChanged = vi.fn()
const onStale = vi.fn()

function renderItem(entry: MyWaitlistEntry) {
  render(<MemoryRouter><ul><WaitlistListItem entry={entry} onChanged={onChanged} onStale={onStale} /></ul></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.loadMyRegistrations.mockResolvedValue({ ok: true, value: [] })
  mocks.leave.mockResolvedValue({ ok: true })
})

describe('AC-016.2: waiting in the queue', () => {
  test('AC-016.2.12: a waiting entry shows its position and a link to the event, and can be left', async () => {
    renderItem(base)
    expect(screen.getByRole('link', { name: 'Data Workshop' })).toHaveAttribute('href', '/events/open/event-1')
    expect(screen.getByText('2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Leave the waiting list' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(mocks.leave).toHaveBeenCalledWith('entry-1')
  })
})

describe('AC-016.3: an offered place', () => {
  test('AC-016.3.22: an open offer shows its deadline and links to where it is accepted', () => {
    renderItem({ ...base, status: 'offered', position: null, offerExpiresAt: '2099-03-05T01:00:00Z' })
    expect(screen.getByText(/a place is held for you until/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accept it' })).toHaveAttribute('href', '/events/open/event-1')
  })
})

describe('AC-016.4: an offer that was not accepted in time', () => {
  test('AC-016.4.13: an expired offer says so and has nothing to leave', () => {
    renderItem({ ...base, status: 'expired', position: null, offerExpiresAt: '2000-01-01T00:00:00Z' })
    expect(screen.getByText(/your offer expired/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave the waiting list' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accept it' })).not.toBeInTheDocument()
  })

  test('AC-016.4.14: an offer past its deadline that still reads offered is treated as expired', () => {
    renderItem({ ...base, status: 'offered', position: null, offerExpiresAt: '2000-01-01T00:00:00Z' })
    expect(screen.getByText(/your offer expired/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accept it' })).not.toBeInTheDocument()
  })
})

describe('AC-016.1: the Waiting lists section', () => {
  const renderPage = () => render(
    <SessionContext.Provider value={attendee}>
      <MemoryRouter><MyRegistrationsPage /></MemoryRouter>
    </SessionContext.Provider>,
  )

  test('AC-016.1.17: My registrations lists the waiting lists the Attendee is on', async () => {
    mocks.loadMyWaitlist.mockResolvedValue({ ok: true, value: [base] })
    renderPage()
    const section = await screen.findByRole('region', { name: 'Waiting lists' })
    expect(within(section).getByText('Data Workshop')).toBeInTheDocument()
  })

  test('AC-016.1.18: with no waiting lists, there is no Waiting lists section at all', async () => {
    mocks.loadMyWaitlist.mockResolvedValue({ ok: true, value: [] })
    renderPage()
    await screen.findByText('No registrations yet')
    expect(screen.queryByRole('region', { name: 'Waiting lists' })).not.toBeInTheDocument()
  })
})
